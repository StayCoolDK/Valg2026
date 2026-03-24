#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_FILE = path.join(__dirname, '..', 'src', 'data', 'election-night-snapshots.json');

const DST_BASE_2026 = 'https://www.dst.dk/valg/Valg2546527';
const DST_BASE_2022 = 'https://www.dst.dk/valg/Valg1968094';
const FETCH_TIMEOUT_MS = 15000;
const FETCH_RETRIES = 3;
const DST_USER_AGENT = 'Valg2026SnapshotBot/1.0 (https://github.com/StayCoolDK/Valg2026)';
const KNOWN_LETTERS = new Set(['A', 'B', 'C', 'F', 'H', 'I', 'M', 'O', 'V', 'Æ', 'Ø', 'Å']);
const LAST_ELECTION_PCT = {
  A: 27.5,
  B: 3.8,
  C: 5.5,
  F: 8.3,
  H: 0,
  I: 7.9,
  M: 9.3,
  O: 2.6,
  V: 13.3,
  Æ: 8.1,
  Ø: 5.2,
  Å: 3.3,
};

function normalizeDstText(value) {
  const trimmed = value.replace(/^\uFEFF/, '').trim();
  if (!/[ÃÂï»¿]/.test(trimmed)) return trimmed;

  try {
    return Buffer.from(trimmed, 'latin1').toString('utf8').replace(/^\uFEFF/, '').trim();
  } catch {
    return trimmed;
  }
}

function attr(element, name) {
  const re = new RegExp(`(?:\\s|^)${name}="([^"]*)"`, 'i');
  return normalizeDstText(element.match(re)?.[1] ?? '');
}

function innerText(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  return normalizeDstText(xml.match(re)?.[1] ?? '');
}

function selfClosingTags(xml, tag) {
  const re = new RegExp(`<${tag}\\s[^>]*?/>|<${tag}\\s[^>]*?>[\\s\\S]*?</${tag}>`, 'gi');
  return xml.match(re) ?? [];
}

function parseResultFeed(xml) {
  const statusCode = parseInt(attr(xml, 'Kode') || '0', 10);
  const statusText = innerText(xml, 'Status');
  const lastUpdated = innerText(xml, 'SenestDannetIso') || innerText(xml, 'SenestRettetIso') || new Date().toISOString();
  const turnoutPct = parseFloat(innerText(xml, 'DeltagelsePct') || '0');
  const totalValid = parseInt(innerText(xml, 'IAltGyldigeStemmer') || '0', 10);
  const totalCast = parseInt(innerText(xml, 'IAltAfgivneStemmer') || '0', 10);

  const stedMatch = xml.match(/<Sted[^>]*>([^<]*)<\/Sted>/i);
  const stedName = stedMatch?.[1]?.trim() ?? '';

  const partiElements = selfClosingTags(xml, 'Parti');
  const parties = [];

  for (const el of partiElements) {
    const bogstav = attr(el, 'Bogstav');
    if (!bogstav || !KNOWN_LETTERS.has(bogstav)) continue;

    const votes = parseInt(attr(el, 'StemmerAntal') || '0', 10);
    const pct = parseFloat(attr(el, 'StemmerPct') || '0');
    const seats = parseInt(attr(el, 'Mandater') || '0', 10);

    parties.push({
      partyLetter: bogstav,
      votes,
      pct,
      seats,
      change: pct - (LAST_ELECTION_PCT[bogstav] ?? 0),
    });
  }

  return {
    statusCode,
    statusText,
    lastUpdated,
    turnoutPct,
    totalValid,
    totalCast,
    parties: parties.sort((a, b) => b.pct - a.pct),
    stedName,
  };
}

function parseOverviewFeed(xml, baseUrl) {
  const heleLandetMatch = xml.match(/<HeleLandet[^>]*filnavn="([^"]*)"[^>]*\/?>/i);
  const nationalFile = heleLandetMatch?.[1] ?? 'valgdag_0.xml';
  const nationalUrl = nationalFile.startsWith('http') ? nationalFile : `${baseUrl}/xml/${nationalFile}`;

  const storkredsUrls = [];
  const storkredsMatches = xml.match(/<Storkreds\s[^>]*>/gi) ?? [];

  for (const sk of storkredsMatches) {
    const id = attr(sk, 'storkreds_id') || attr(sk, 'Id');
    const name = attr(sk, 'Navn');
    const filnavn = attr(sk, 'filnavn');
    if (!id || !filnavn) continue;

    storkredsUrls.push({
      id,
      name,
      url: filnavn.startsWith('http') ? filnavn : `${baseUrl}/xml/${filnavn}`,
    });
  }

  return { nationalUrl, storkredsUrls };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchXml(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': DST_USER_AGENT,
          Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (response.ok) {
        return { xml: normalizeDstText(await response.text()), warning: null };
      }

      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.name : 'Unknown error';
    }

    if (attempt < FETCH_RETRIES) {
      await sleep(250 * attempt);
    }
  }

  return {
    xml: null,
    warning: `Kunne ikke hente ${url.split('/').slice(-1)[0]} fra DST (${lastError ?? 'ukendt fejl'}).`,
  };
}

function mapElectionStatus(statusCode, statusText, totalCast) {
  const normalized = statusText.toLowerCase();

  if (statusCode === 0 && totalCast === 0) return 'waiting';
  if (statusCode === 12 || normalized.includes('endeligt')) return 'final';
  if (statusCode >= 11 || normalized.includes('foreløbigt')) return 'preliminary';
  if (totalCast > 0 || normalized.includes('optæll')) return 'counting';
  return 'waiting';
}

async function fetchElectionNight(baseUrl) {
  const fetchedAt = new Date().toISOString();
  const warnings = [];

  const overviewResult = await fetchXml(`${baseUrl}/xml/valgdag.xml`);
  if (overviewResult.warning) warnings.push(overviewResult.warning);
  if (!overviewResult.xml) {
    return { ok: false, data: null, warnings };
  }

  const { nationalUrl, storkredsUrls } = parseOverviewFeed(overviewResult.xml, baseUrl);

  const nationalResult = await fetchXml(nationalUrl);
  if (nationalResult.warning) warnings.push(nationalResult.warning);
  if (!nationalResult.xml) {
    return { ok: false, data: null, warnings };
  }

  const national = parseResultFeed(nationalResult.xml);
  if (national.statusCode === 0) {
    return {
      ok: true,
      data: {
        lastUpdated: national.lastUpdated,
        fetchedAt,
        usingCachedFallback: false,
        fallbackSource: 'none',
        totalCounted: 0,
        totalVotes: 0,
        sourceStatusText: national.statusText,
        reportedConstituencies: 0,
        totalConstituencies: storkredsUrls.length,
        hasPartialData: warnings.length > 0,
        warnings: [...new Set(warnings)],
        partyResults: [],
        constituencies: [],
        isLive: false,
        status: 'waiting',
      },
      warnings,
    };
  }

  const constituencies = [];
  let reportedConstituencies = 0;

  const storkredsResults = await Promise.allSettled(
    storkredsUrls.map(async (storkreds) => {
      const result = await fetchXml(storkreds.url);
      if (result.warning) warnings.push(result.warning);
      if (!result.xml) return null;

      const parsed = parseResultFeed(result.xml);
      if (parsed.statusCode === 0) return null;

      return {
        id: storkreds.id,
        name: storkreds.name || parsed.stedName,
        counted: parsed.turnoutPct > 0 ? 100 : 0,
        results: parsed.parties.map((party) => ({
          partyLetter: party.partyLetter,
          votes: party.votes,
          pct: party.pct,
        })),
      };
    })
  );

  for (const result of storkredsResults) {
    if (result.status === 'fulfilled' && result.value) {
      constituencies.push(result.value);
      reportedConstituencies += 1;
    }
  }

  const status = mapElectionStatus(national.statusCode, national.statusText, national.totalCast);
  const totalCounted =
    status === 'final'
      ? 100
      : storkredsUrls.length > 0
        ? (reportedConstituencies / storkredsUrls.length) * 100
        : national.totalCast > 0
          ? 1
          : 0;

  return {
    ok: true,
    data: {
      lastUpdated: national.lastUpdated,
      fetchedAt,
      usingCachedFallback: false,
      fallbackSource: 'none',
      totalCounted,
      totalVotes: national.totalValid || national.totalCast,
      sourceStatusText: national.statusText,
      reportedConstituencies,
      totalConstituencies: storkredsUrls.length,
      hasPartialData:
        warnings.length > 0 || (storkredsUrls.length > 0 && reportedConstituencies < storkredsUrls.length),
      warnings: [...new Set(warnings)],
      partyResults: national.parties,
      constituencies: constituencies.sort((a, b) => a.name.localeCompare(b.name, 'da')),
      isLive: status !== 'waiting',
      status,
    },
    warnings,
  };
}

async function loadExistingSnapshot() {
  if (!existsSync(SNAPSHOT_FILE)) {
    return { updatedAt: new Date(0).toISOString(), live: null, demoDst: null };
  }

  return JSON.parse(await readFile(SNAPSHOT_FILE, 'utf8'));
}

function normalizeForComparison(store) {
  return {
    live: store.live
      ? {
          ...store.live,
          fetchedAt: null,
        }
      : null,
    demoDst: store.demoDst
      ? {
          ...store.demoDst,
          fetchedAt: null,
        }
      : null,
  };
}

async function main() {
  const existing = await loadExistingSnapshot();

  const [liveResult, demoDstResult] = await Promise.all([
    fetchElectionNight(DST_BASE_2026),
    fetchElectionNight(DST_BASE_2022),
  ]);

  const nextStore = {
    updatedAt: new Date().toISOString(),
    live: liveResult.ok ? liveResult.data : existing.live,
    demoDst: demoDstResult.ok ? demoDstResult.data : existing.demoDst,
  };

  if (!nextStore.live && !nextStore.demoDst) {
    console.error('Kunne ikke hente nogen valgaften-snapshots fra DST.');
    process.exit(0);
  }

  const previousComparable = normalizeForComparison(existing);
  const nextComparable = normalizeForComparison(nextStore);

  if (JSON.stringify(previousComparable) === JSON.stringify(nextComparable)) {
    console.log('Ingen ændringer i valgaften-snapshot.');
    process.exit(0);
  }

  await writeFile(`${SNAPSHOT_FILE}`, `${JSON.stringify(nextStore, null, 2)}\n`, 'utf8');
  console.log('Opdaterede valgaften-snapshot.');
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
