import { NextRequest, NextResponse } from 'next/server';
import { PARTIES } from '@/lib/constants';
import type { PartyLetter } from '@/lib/types';
import type { ElectionNightData, ConstituencyResult } from '@/lib/types/election-night';
import snapshotStore from '@/data/election-night-snapshots.json';

export const runtime = 'nodejs';

// 2026 Folketingsvalg feed (live from dst.dk/valg/xml.htm)
const DST_BASE_2026 = 'https://www.dst.dk/valg/Valg2546527';
// 2022 Folketingsvalg feed (for demo/testing with ?demo=true)
const DST_BASE_2022 = 'https://www.dst.dk/valg/Valg1968094';
const FETCH_TIMEOUT_MS = 4000;
const FETCH_RETRIES = 1;
const DST_USER_AGENT = 'Valg2026/1.0 (https://github.com/StayCoolDK/Valg2026)';

type SnapshotStore = {
  updatedAt: string;
  live: ElectionNightData | null;
  demoDst: ElectionNightData | null;
};

const SNAPSHOTS = snapshotStore as SnapshotStore;

// Known party letters we care about
const KNOWN_LETTERS = new Set<string>(['A','B','C','F','H','I','M','O','V','Æ','Ø','Å']);

function normalizeDstText(value: string): string {
  const trimmed = value.replace(/^\uFEFF/, '').trim();
  if (!/[ÃÂï»¿]/.test(trimmed)) return trimmed;

  try {
    return Buffer.from(trimmed, 'latin1').toString('utf8').replace(/^\uFEFF/, '').trim();
  } catch {
    return trimmed;
  }
}

function attr(element: string, name: string): string {
  // Use word boundary or start-of-attribute to avoid partial matches (e.g. "filnavn" matching "Navn")
  const re = new RegExp(`(?:\\s|^)${name}="([^"]*)"`, 'i');
  return normalizeDstText(element.match(re)?.[1] ?? '');
}

function innerText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  return normalizeDstText(xml.match(re)?.[1] ?? '');
}

function selfClosingTags(xml: string, tag: string): string[] {
  // Match both self-closing <Tag ... /> and block <Tag ...>...</Tag>
  const re = new RegExp(`<${tag}\\s[^>]*?/>|<${tag}\\s[^>]*?>[\\s\\S]*?</${tag}>`, 'gi');
  return xml.match(re) ?? [];
}

/**
 * Parse a single DST result feed XML (e.g. valgdag_0.xml for national results).
 * DST uses attributes on self-closing <Parti /> elements:
 *   <Parti Id="..." Bogstav="A" Navn="..." StemmerAntal="..." StemmerPct="..." Mandater="..." />
 */
function parseResultFeed(xml: string): {
  statusCode: number;
  statusText: string;
  lastUpdated: string;
  turnoutPct: number;
  eligible: number;
  parties: ElectionNightData['partyResults'];
  totalValid: number;
  totalCast: number;
  stedType: string;
  stedName: string;
  stedId: string;
} {
  const statusCode = parseInt(attr(xml, 'Kode') || '0', 10);
  const statusText = innerText(xml, 'Status');
  const lastUpdated = innerText(xml, 'SenestDannetIso') || innerText(xml, 'SenestRettetIso') || new Date().toISOString();
  const turnoutPct = parseFloat(innerText(xml, 'DeltagelsePct') || '0');
  const eligible = parseInt(innerText(xml, 'Stemmeberettigede') || '0', 10);
  const totalValid = parseInt(innerText(xml, 'IAltGyldigeStemmer') || '0', 10);
  const totalCast = parseInt(innerText(xml, 'IAltAfgivneStemmer') || '0', 10);

  // Parse <Sted> element
  const stedMatch = xml.match(/<Sted[^>]*>([^<]*)<\/Sted>/i);
  const stedEl = stedMatch?.[0] ?? '';
  const stedType = attr(stedEl, 'Type');
  const stedName = stedMatch?.[1]?.trim() ?? '';
  const stedId = attr(stedEl, 'Id');

  const partiElements = selfClosingTags(xml, 'Parti');
  const parties: ElectionNightData['partyResults'] = [];

  for (const el of partiElements) {
    const bogstav = attr(el, 'Bogstav');
    if (!bogstav || !KNOWN_LETTERS.has(bogstav)) continue;

    const partyLetter = bogstav as PartyLetter;
    const votes = parseInt(attr(el, 'StemmerAntal') || '0', 10);
    const pct = parseFloat(attr(el, 'StemmerPct') || '0');
    const seats = parseInt(attr(el, 'Mandater') || '0', 10);

    const partyDef = PARTIES.find((p) => p.letter === partyLetter);
    parties.push({
      partyLetter,
      votes,
      pct,
      seats,
      change: pct - (partyDef?.lastElectionPct ?? 0),
    });
  }

  return {
    statusCode,
    statusText,
    lastUpdated,
    turnoutPct,
    eligible,
    parties: parties.sort((a, b) => b.pct - a.pct),
    totalValid,
    totalCast,
    stedType,
    stedName,
    stedId,
  };
}

/**
 * Parse the overview feed (valgdag.xml) to extract storkreds result feed URLs.
 * Each Storkreds element has a filnavn attribute with the URL.
 */
function parseOverviewFeed(xml: string, baseUrl: string): {
  nationalUrl: string;
  storkredsUrls: { id: string; name: string; url: string }[];
} {
  // Find the national-level (HeleLandet) result feed
  const heleLandetMatch = xml.match(/<HeleLandet[^>]*filnavn="([^"]*)"[^>]*\/?>/i);
  const nationalFile = heleLandetMatch?.[1] ?? 'valgdag_0.xml';
  const nationalUrl = nationalFile.startsWith('http') ? nationalFile : `${baseUrl}/xml/${nationalFile}`;

  // Parse Storkreds elements for constituency feeds
  const storkredsUrls: { id: string; name: string; url: string }[] = [];
  // Match Storkreds elements (both self-closing and block)
  const storkredsMatches = xml.match(/<Storkreds\s[^>]*>/gi) ?? [];
  for (const sk of storkredsMatches) {
    const id = attr(sk, 'storkreds_id') || attr(sk, 'Id');
    const name = attr(sk, 'Navn');
    const filnavn = attr(sk, 'filnavn');
    if (id && filnavn) {
      storkredsUrls.push({
        id,
        name,
        url: filnavn.startsWith('http') ? filnavn : `${baseUrl}/xml/${filnavn}`,
      });
    }
  }

  return { nationalUrl, storkredsUrls };
}

const EMPTY_RESULT: ElectionNightData = {
  lastUpdated: new Date().toISOString(),
  fetchedAt: new Date().toISOString(),
  usingCachedFallback: false,
  fallbackSource: 'none',
  totalCounted: 0,
  totalVotes: 0,
  sourceStatusText: '',
  reportedConstituencies: 0,
  totalConstituencies: 0,
  hasPartialData: false,
  warnings: [],
  partyResults: [],
  constituencies: [],
  isLive: false,
  status: 'waiting',
};

const DEMO_RESULT: ElectionNightData = {
  lastUpdated: '2022-11-02T10:05:31',
  fetchedAt: new Date().toISOString(),
  usingCachedFallback: false,
  fallbackSource: 'none',
  totalCounted: 100,
  totalVotes: 3533379,
  sourceStatusText: 'Foreløbigt resultat (lokal demo)',
  reportedConstituencies: 3,
  totalConstituencies: 3,
  hasPartialData: false,
  warnings: [],
  partyResults: [
    { partyLetter: 'A', votes: 973244, pct: 27.5, seats: 0, change: 0 },
    { partyLetter: 'V', votes: 470289, pct: 13.3, seats: 0, change: 0 },
    { partyLetter: 'M', votes: 327659, pct: 9.3, seats: 0, change: 0 },
    { partyLetter: 'F', votes: 292915, pct: 8.3, seats: 0, change: 0 },
    { partyLetter: 'Æ', votes: 285614, pct: 8.1, seats: 0, change: 0 },
    { partyLetter: 'I', votes: 278098, pct: 7.9, seats: 0, change: 0 },
    { partyLetter: 'C', votes: 194808, pct: 5.5, seats: 0, change: 0 },
    { partyLetter: 'Ø', votes: 182305, pct: 5.2, seats: 0, change: 0.1 },
    { partyLetter: 'B', votes: 133802, pct: 3.8, seats: 0, change: 0 },
    { partyLetter: 'Å', votes: 117629, pct: 3.3, seats: 0, change: 0 },
    { partyLetter: 'O', votes: 93100, pct: 2.6, seats: 0, change: 0 },
  ],
  constituencies: [
    {
      id: '13',
      name: 'Bornholms Storkreds',
      counted: 100,
      results: [
        { partyLetter: 'A', votes: 8730, pct: 35.3 },
        { partyLetter: 'V', votes: 4641, pct: 18.8 },
        { partyLetter: 'F', votes: 1589, pct: 6.4 },
        { partyLetter: 'Æ', votes: 1590, pct: 6.4 },
        { partyLetter: 'O', votes: 1552, pct: 6.3 },
      ],
    },
    {
      id: '10',
      name: 'Københavns Storkreds',
      counted: 100,
      results: [
        { partyLetter: 'A', votes: 86611, pct: 19.0 },
        { partyLetter: 'Ø', votes: 62640, pct: 13.8 },
        { partyLetter: 'F', votes: 52020, pct: 11.4 },
        { partyLetter: 'M', votes: 42966, pct: 9.4 },
        { partyLetter: 'Å', votes: 42797, pct: 9.4 },
      ],
    },
    {
      id: '17',
      name: 'Østjyllands Storkreds',
      counted: 100,
      results: [
        { partyLetter: 'A', votes: 135679, pct: 26.8 },
        { partyLetter: 'V', votes: 66294, pct: 13.1 },
        { partyLetter: 'I', votes: 49372, pct: 9.8 },
        { partyLetter: 'F', votes: 45352, pct: 9.0 },
        { partyLetter: 'M', votes: 43972, pct: 8.7 },
      ],
    },
  ],
  isLive: true,
  status: 'preliminary',
};

const SNAPSHOT_CACHE = new Map<string, ElectionNightData>();

function getStoredSnapshot(cacheKey: string): ElectionNightData | null {
  const snapshot = cacheKey === 'demo-dst' ? SNAPSHOTS.demoDst : cacheKey === 'live' ? SNAPSHOTS.live : null;
  if (!snapshot) return null;

  return {
    ...snapshot,
    warnings: Array.from(new Set(snapshot.warnings)),
    usingCachedFallback: true,
    fallbackSource: 'snapshot',
    hasPartialData: snapshot.hasPartialData || snapshot.warnings.length > 0,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchXml(url: string): Promise<{ xml: string | null; warning: string | null }> {
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': DST_USER_AGENT,
          'Accept': 'application/xml,text/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (res.ok) {
        return { xml: normalizeDstText(await res.text()), warning: null };
      }

      lastError = `HTTP ${res.status}`;
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

function mapElectionStatus(
  statusCode: number,
  statusText: string,
  totalCast: number
): ElectionNightData['status'] {
  const normalized = statusText.toLowerCase();

  if (statusCode === 0 && totalCast === 0) return 'waiting';
  if (statusCode === 12 || normalized.includes('endeligt')) return 'final';
  if (statusCode >= 11 || normalized.includes('foreløbigt')) return 'preliminary';
  if (totalCast > 0 || normalized.includes('optæll')) return 'counting';
  return 'waiting';
}

export async function GET(request: NextRequest) {
  const demoParam = request.nextUrl.searchParams.get('demo');
  const useLocalDemo = demoParam === 'true' || demoParam === 'local';
  const useDstDemo = demoParam === 'dst';
  const demo = useLocalDemo || useDstDemo;
  const base = demo ? DST_BASE_2022 : DST_BASE_2026;
  const cacheKey = useDstDemo ? 'demo-dst' : demo ? 'demo' : 'live';
  const fetchedAt = new Date().toISOString();
  const warnings: string[] = [];
  const fallback = SNAPSHOT_CACHE.get(cacheKey) ?? getStoredSnapshot(cacheKey);

  if (useLocalDemo) {
    const demoPayload: ElectionNightData = {
      ...DEMO_RESULT,
      fetchedAt,
      usingCachedFallback: false,
      fallbackSource: 'none',
      warnings: [],
    };

    return NextResponse.json(demoPayload, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  const respondWithFallback = (extraWarnings: string[]) => {
    if (!fallback) {
      return NextResponse.json(
        {
          ...EMPTY_RESULT,
          fetchedAt,
          usingCachedFallback: false,
          fallbackSource: 'none',
          hasPartialData: true,
          warnings: Array.from(new Set(extraWarnings)),
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    return NextResponse.json(
      {
        ...fallback,
        fetchedAt,
        usingCachedFallback: fallback.fallbackSource !== 'none',
        hasPartialData: true,
        warnings: Array.from(new Set([
          ...fallback.warnings,
          fallback.fallbackSource === 'snapshot'
            ? `Viser senest deployede snapshot fra ${SNAPSHOTS.updatedAt} pga. DST-hentefejl i runtime.`
            : 'Viser senest kendte succesfulde DST-svar pga. midlertidig hentefejl.',
          ...extraWarnings,
        ])),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  };

  try {
    // Step 1: Fetch the overview feed to discover result feed URLs
    const overviewResult = await fetchXml(`${base}/xml/valgdag.xml`);
    if (overviewResult.warning) warnings.push(overviewResult.warning);
    const overviewXml = overviewResult.xml;
    if (!overviewXml) {
      return respondWithFallback(warnings);
    }

    const { nationalUrl, storkredsUrls } = parseOverviewFeed(overviewXml, base);

    // Step 2: Fetch the national result feed
    const nationalResult = await fetchXml(nationalUrl);
    if (nationalResult.warning) warnings.push(nationalResult.warning);
    const nationalXml = nationalResult.xml;
    if (!nationalXml) {
      if (!fallback) {
        return NextResponse.json(
          {
            ...EMPTY_RESULT,
            fetchedAt,
            totalConstituencies: storkredsUrls.length,
            hasPartialData: true,
            fallbackSource: 'none',
            warnings,
          },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
      }
      return respondWithFallback(warnings);
    }

    const national = parseResultFeed(nationalXml);

    // Status 0 = no results yet
    if (national.statusCode === 0) {
      return NextResponse.json(
        {
          ...EMPTY_RESULT,
          fetchedAt,
          usingCachedFallback: false,
          fallbackSource: 'none',
          lastUpdated: national.lastUpdated,
          sourceStatusText: national.statusText,
          totalConstituencies: storkredsUrls.length,
          warnings,
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    // Step 3: Fetch storkreds results in parallel
    const constituencies: ConstituencyResult[] = [];
    let reportedConstituencies = 0;
    if (storkredsUrls.length > 0) {
      const storkredsResults = await Promise.allSettled(
        storkredsUrls.map(async (sk) => {
          const { xml, warning } = await fetchXml(sk.url);
          if (warning) warnings.push(warning);
          if (!xml) return null;
          const result = parseResultFeed(xml);
          if (result.statusCode === 0) return null;
          return {
            id: sk.id,
            name: sk.name || result.stedName,
            counted: result.turnoutPct > 0 ? 100 : 0, // DST doesn't give partial % per storkreds on valgaften
            results: result.parties.map((p) => ({
              partyLetter: p.partyLetter,
              votes: p.votes,
              pct: p.pct,
            })),
          } satisfies ConstituencyResult;
        })
      );

      for (const r of storkredsResults) {
        if (r.status === 'fulfilled' && r.value) {
          constituencies.push(r.value);
          reportedConstituencies += 1;
        }
      }
    }

    const status = mapElectionStatus(
      national.statusCode,
      national.statusText,
      national.totalCast
    );

    const totalCounted =
      status === 'final'
        ? 100
        : storkredsUrls.length > 0
          ? (reportedConstituencies / storkredsUrls.length) * 100
          : national.totalCast > 0
            ? 1
            : 0;

    const data: ElectionNightData = {
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
      warnings: Array.from(new Set(warnings)),
      partyResults: national.parties,
      constituencies: constituencies.sort((a, b) => a.name.localeCompare(b.name, 'da')),
      isLive: status !== 'waiting',
      status,
    };

    SNAPSHOT_CACHE.set(cacheKey, data);

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return respondWithFallback([
      'Valgaften-data kunne ikke behandles korrekt. API bruger fallback-svar.',
    ]);
  }
}
