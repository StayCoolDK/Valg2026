/**
 * Fetches the latest Danish opinion polls from Wikipedia.
 * Tries Danish Wikipedia first, falls back to English Wikipedia.
 * Returns [] if no article is found or parsing fails.
 */

import { Poll, PollingInstitute } from './types';

const DA_WIKI_API = 'https://da.wikipedia.org/w/api.php';
const EN_WIKI_API = 'https://en.wikipedia.org/w/api.php';

// Ordered list of (api, page) pairs to try
const SOURCES: [string, string][] = [
  [DA_WIKI_API, 'Meningsmålinger_forud_for_Folketingsvalget_2026'],
  [DA_WIKI_API, 'Meningsmålinger_forud_for_Folketingsvalget_2025'],
  [DA_WIKI_API, 'Meningsmålinger_forud_for_det_næste_Folketing'],
  [EN_WIKI_API, 'Opinion_polling_for_the_next_Danish_general_election'],
  [EN_WIKI_API, 'Opinion_polling_for_the_2026_Danish_general_election'],
];

const KNOWN_INSTITUTES: Record<string, PollingInstitute> = {
  voxmeter: 'Voxmeter',
  yougov: 'YouGov',
  'you gov': 'YouGov',
  epinion: 'Epinion',
  megafon: 'Megafon',
  verian: 'Verian',
  norstat: 'Norstat',
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

// Maps header text (lowercase) → party letter
const PARTY_HEADERS: Record<string, string> = {
  'a': 'A', 'socialdemokratiet': 'A',
  'b': 'B', 'radikale venstre': 'B', 'radikale': 'B',
  'c': 'C', 'konservative': 'C',
  'f': 'F', 'sf': 'F', 'socialistisk folkeparti': 'F',
  'h': 'H', 'borgernes parti': 'H',
  'i': 'I', 'liberal alliance': 'I', 'la': 'I',
  'm': 'M', 'moderaterne': 'M',
  'o': 'O', 'dansk folkeparti': 'O', 'df': 'O',
  'v': 'V', 'venstre': 'V',
  'æ': 'Æ', 'danmarksdemokraterne': 'Æ', 'dd': 'Æ',
  'ø': 'Ø', 'enhedslisten': 'Ø',
  'å': 'Å', 'alternativet': 'Å',
};

function parseDate(raw: string): string | null {
  const s = raw.trim().replace(/^\d{1,2}\.?\s*[–\-]\s*/, ''); // strip range prefix

  // "20. marts 2026" (Danish)
  const da = s.match(/(\d{1,2})\.\s*(\w+)\s+(\d{4})/);
  if (da) {
    const month = DANISH_MONTHS[da[2].toLowerCase()];
    if (month) return `${da[3]}-${String(month).padStart(2, '0')}-${da[1].padStart(2, '0')}`;
  }

  // "20 March 2026" or "13–20 March 2026" (English)
  const en = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (en) {
    const month = ENGLISH_MONTHS[en[2].toLowerCase()];
    if (month) return `${en[3]}-${String(month).padStart(2, '0')}-${en[1].padStart(2, '0')}`;
  }

  return null;
}

function parseWikitext(wikitext: string): Poll[] {
  const polls: Poll[] = [];

  // Split into tables
  const tables = wikitext.split(/\{\|/).slice(1);

  for (const table of tables) {
    const rows = table.split(/\n\|-\n?/);
    if (rows.length < 2) continue;

    // Parse header row (lines starting with !)
    const headerLines = rows[0]
      .split('\n')
      .filter(l => l.startsWith('!'))
      .flatMap(l => l.replace(/^!+/, '').split('!!'))
      .map(h => h.replace(/\[\[|\]\]|''/g, '').trim().toLowerCase());

    const partyCount = headerLines.filter(h => PARTY_HEADERS[h]).length;
    if (partyCount < 6) continue; // Not a poll table

    // Build column index → field map
    const colMap: Record<number, string> = {};
    headerLines.forEach((h, i) => {
      if (PARTY_HEADERS[h]) colMap[i] = PARTY_HEADERS[h];
      else if (/dato|date|felt|periode/i.test(h)) colMap[i] = 'date';
      else if (/institut|pollster|firma/i.test(h)) colMap[i] = 'institute';
      else if (/opdrag|client|kilde|medie|commissioner/i.test(h)) colMap[i] = 'source';
      else if (/størrelse|sample|stikprøve/i.test(h)) colMap[i] = 'sampleSize';
    });

    // Parse data rows
    for (const row of rows.slice(1)) {
      // Skip sub-headers (lines with only !)
      if (row.trim().startsWith('!')) continue;

      const cells = row
        .split('\n')
        .filter(l => l.startsWith('|') && !l.startsWith('|}'))
        .flatMap(l => l.replace(/^\|+/, '').split('||'))
        .map(c => c.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').replace(/\{\{[^}]*\}\}/g, '').replace(/\[\d+\]/g, '').trim());

      if (cells.length < 4) continue;

      const poll: Partial<Poll> & { results: Record<string, number> } = { results: {} };
      let hasDate = false, hasInstitute = false;

      cells.forEach((val, i) => {
        const field = colMap[i];
        if (!field || !val || /^[–\-—]$/.test(val)) return;

        if (field === 'date') {
          const d = parseDate(val);
          if (d) { poll.date = d; hasDate = true; }
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
      next: { revalidate: 1800 }, // Cache for 30 minutes
      headers: {
        'User-Agent': 'Valg2026/1.0 (https://github.com/StayCoolDK/Valg2026)',
      },
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
  console.log('[wiki-polls] No Wikipedia article found, using local data only');
  return [];
}
