import { NextRequest, NextResponse } from 'next/server';
import { PARTIES } from '@/lib/constants';
import type { PartyLetter } from '@/lib/types';
import type { ElectionNightData, ConstituencyResult } from '@/lib/types/election-night';

// 2026 Folketingsvalg feed (live from dst.dk/valg/xml.htm)
const DST_BASE_2026 = 'https://www.dst.dk/valg/Valg2546527';
// 2022 Folketingsvalg feed (for demo/testing with ?demo=true)
const DST_BASE_2022 = 'https://www.dst.dk/valg/Valg1968094';

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
  totalCounted: 0,
  totalVotes: 0,
  partyResults: [],
  constituencies: [],
  isLive: false,
  status: 'waiting',
};

async function fetchXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return normalizeDstText(await res.text());
  } catch {
    // fail silently
  }
  return null;
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
  const demo = request.nextUrl.searchParams.get('demo') === 'true';
  const base = demo ? DST_BASE_2022 : DST_BASE_2026;

  try {
    // Step 1: Fetch the overview feed to discover result feed URLs
    const overviewXml = await fetchXml(`${base}/xml/valgdag.xml`);
    if (!overviewXml) {
      return NextResponse.json(EMPTY_RESULT);
    }

    const { nationalUrl, storkredsUrls } = parseOverviewFeed(overviewXml, base);

    // Step 2: Fetch the national result feed
    const nationalXml = await fetchXml(nationalUrl);
    if (!nationalXml) {
      return NextResponse.json(EMPTY_RESULT);
    }

    const national = parseResultFeed(nationalXml);

    // Status 0 = no results yet
    if (national.statusCode === 0) {
      return NextResponse.json({
        ...EMPTY_RESULT,
        lastUpdated: national.lastUpdated,
      });
    }

    // Step 3: Fetch storkreds results in parallel
    const constituencies: ConstituencyResult[] = [];
    let reportedConstituencies = 0;
    if (storkredsUrls.length > 0) {
      const storkredsResults = await Promise.allSettled(
        storkredsUrls.map(async (sk) => {
          const xml = await fetchXml(sk.url);
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
      totalCounted,
      totalVotes: national.totalValid || national.totalCast,
      partyResults: national.parties,
      constituencies,
      isLive: status !== 'waiting',
      status,
    };

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(EMPTY_RESULT, { status: 200 });
  }
}
