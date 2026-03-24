/**
 * Fetches the latest Danish opinion polls from Wikipedia.
 *
 * The article organises polls in multiple tables, one per quarter.
 * Section headings like "=== Januar-marts 2026 ===" carry the year context.
 * We walk the wikitext in order: headings update the current year,
 * tables are parsed using that year.
 */

import { Poll, PollingInstitute } from './types';

const DA_WIKI_API = 'https://da.wikipedia.org/w/api.php';
const EN_WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_REVALIDATE_SECONDS = 300;

const SOURCES: [string, string][] = [
  [DA_WIKI_API, 'Meningsmålinger_forud_for_folketingsvalget_2026'],
  [DA_WIKI_API, 'Meningsmålinger_forud_for_Folketingsvalget_2026'],
  [DA_WIKI_API, 'Meningsmålinger_forud_for_folketingsvalget_2025'],
  [DA_WIKI_API, 'Meningsmålinger_forud_for_det_næste_Folketing'],
  [EN_WIKI_API, 'Opinion_polling_for_the_next_Danish_general_election'],
];

const KNOWN_INSTITUTES: Record<string, PollingInstitute> = {
  voxmeter: 'Voxmeter',
  yougov: 'YouGov',
  epinion: 'Epinion',
  megafon: 'Megafon',
  verian: 'Verian',
  norstat: 'Norstat',
  gallup: 'Gallup',
};

const INSTITUTE_TO_SOURCE: Record<string, string> = {
  Voxmeter: 'Ritzau',
  YouGov: 'B.T.',
  Epinion: 'DR',
  Megafon: 'TV 2',
  Verian: 'Berlingske',
  Norstat: 'Altinget',
};

const DANISH_MONTHS: Record<string, number> = {
  januar: 1, februar: 2, marts: 3, april: 4,
  maj: 5, juni: 6, juli: 7, august: 8,
  september: 9, oktober: 10, november: 11, december: 12,
};

const ENGLISH_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

const PARTY_HEADERS: Record<string, string> = {
  'a': 'A', 'b': 'B', 'c': 'C', 'f': 'F', 'h': 'H',
  'i': 'I', 'm': 'M', 'o': 'O', 'v': 'V', 'æ': 'Æ',
  'ø': 'Ø', 'å': 'Å',
};

function normalizeWikiCell(raw: string): string {
  const withoutMarkup = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/gi, '$2')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/'{2,}/g, '')
    .trim();

  const content = withoutMarkup.includes('|')
    ? withoutMarkup.split('|').pop() ?? withoutMarkup
    : withoutMarkup;

  return content.replace(/\s+/g, ' ').trim();
}

/** Parse "22. marts" or "22 March" → {day, month}. Strips range prefix "14.–". */
function parseDayMonth(raw: string): { day: number; month: number } | null {
  const s = raw.trim().replace(/^\d{1,2}\.?\s*[–\-]\s*/, '');

  // Danish: "22. marts"
  const da = s.match(/^(\d{1,2})\.?\s+(\w+)/);
  if (da) {
    const month = DANISH_MONTHS[da[2].toLowerCase()] ?? ENGLISH_MONTHS[da[2].toLowerCase()];
    if (month) return { day: parseInt(da[1]), month };
  }
  return null;
}

/**
 * Parses wikitext tables. The wikitext is split into sections by heading markers
 * (== ... ==). Each section heading that contains a 4-digit year updates the
 * current year context used when parsing the next table.
 */
function parseWikitext(wikitext: string): Poll[] {
  const polls: Poll[] = [];
  let currentYear = 2022;

  // Split by either a heading line or a table block
  // We process line by line to track headings and table blocks
  const lines = wikitext.split('\n');
  let inTable = false;
  let tableLines: string[] = [];
  let headerCols: Record<number, string> = {};

  const flushTable = () => {
    if (tableLines.length === 0) return;

    // Parse collected table lines
    const rows = tableLines.join('\n').split(/^\|-/m);
    if (rows.length < 2) { tableLines = []; return; }

    // Parse header
    const headerRow = rows[0];
    const rawHeaders = headerRow
      .split('\n')
      .filter(l => l.trimStart().startsWith('!'))
      .flatMap(l => l.replace(/^!+/, '').split('!!'))
      .map(h => normalizeWikiCell(h).toLowerCase());

    headerCols = {};
    rawHeaders.forEach((h, i) => {
      if (PARTY_HEADERS[h]) headerCols[i] = PARTY_HEADERS[h];
      else if (/publiceret|dato|date|felt|periode/i.test(h)) headerCols[i] = 'date';
      else if (/analyseinstitut|institut|pollster/i.test(h)) headerCols[i] = 'institute';
      else if (/størrelse|sample|stikprøve/i.test(h)) headerCols[i] = 'sampleSize';
    });

    const partyCount = Object.values(headerCols).filter(v => v.length <= 2).length;
    if (partyCount < 6) { tableLines = []; return; }

    // Parse data rows
    for (const row of rows.slice(1)) {
      if (row.trim().startsWith('!')) continue;

      const cells = row
        .split('\n')
        .filter(l => l.trimStart().startsWith('|') && !l.trimStart().startsWith('|}'))
        .flatMap(l => l.replace(/^\|+/, '').split('||'))
        .map(c => normalizeWikiCell(c));

      if (cells.length < 4) continue;

      const poll: Partial<Poll> & { results: Record<string, number> } = { results: {} };
      let hasDate = false, hasInstitute = false;

      cells.forEach((val, i) => {
        const field = headerCols[i];
        if (!field || !val || /^[–\-—]$/.test(val)) return;

        if (field === 'date') {
          const dm = parseDayMonth(val);
          if (dm) {
            poll.date = `${currentYear}-${String(dm.month).padStart(2, '0')}-${String(dm.day).padStart(2, '0')}`;
            hasDate = true;
          }
        } else if (field === 'institute') {
          const canonical = KNOWN_INSTITUTES[val.toLowerCase().trim()];
          if (canonical) {
            poll.institute = canonical;
            poll.source = INSTITUTE_TO_SOURCE[canonical] ?? '';
            hasInstitute = true;
          }
        } else if (field === 'source' && !poll.source) {
          poll.source = val;
        } else if (field === 'sampleSize') {
          const n = parseInt(val.replace(/[^0-9]/g, ''));
          if (!isNaN(n)) poll.sampleSize = n;
        } else if (field.length <= 2) {
          const n = parseFloat(val.replace(',', '.'));
          if (!isNaN(n)) poll.results[field] = n;
        }
      });

      if (!hasDate || !hasInstitute || Object.keys(poll.results).length < 6) continue;
      poll.id = `${poll.date}-${poll.institute!.toLowerCase().replace(/\s+/g, '')}`;
      polls.push(poll as Poll);
    }

    tableLines = [];
  };

  for (const line of lines) {
    // Check for section heading (== ... ==) containing a year
    const headingMatch = line.match(/^={2,4}\s*(.*?)\s*={2,4}\s*$/);
    if (headingMatch) {
      const yearMatch = headingMatch[1].match(/\b(20\d{2})\b/);
      if (yearMatch) currentYear = parseInt(yearMatch[1]);
      continue;
    }

    if (line.trimStart().startsWith('{|')) {
      inTable = true;
      tableLines = [];
      continue;
    }
    if (line.trimStart().startsWith('|}')) {
      flushTable();
      inTable = false;
      continue;
    }
    if (inTable) {
      tableLines.push(line);
    }
  }

  return polls;
}

async function fetchFromSource(apiUrl: string, pageTitle: string): Promise<Poll[] | null> {
  const url = new URL(apiUrl);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', pageTitle);
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: WIKI_REVALIDATE_SECONDS },
      headers: { 'User-Agent': 'Valg2026/1.0 (https://github.com/StayCoolDK/Valg2026)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    const wikitext: string = data?.parse?.wikitext ?? '';
    if (!wikitext) return null;
    const polls = parseWikitext(wikitext);
    return polls.length > 0 ? polls : null;
  } catch {
    return null;
  }
}

export async function fetchWikiPolls(): Promise<Poll[]> {
  for (const [apiUrl, pageTitle] of SOURCES) {
    const polls = await fetchFromSource(apiUrl, pageTitle);
    if (polls && polls.length > 0) {
      console.log(`[wiki-polls] Fetched ${polls.length} polls from: ${pageTitle}`);
      return polls;
    }
  }
  console.log('[wiki-polls] No Wikipedia source found, using local data');
  return [];
}
