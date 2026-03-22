import pollsData from '@/data/polls.json';
import { Poll } from './types';
import { fetchWikiPolls } from './wiki-polls';

/**
 * Returns all polls, merging live Wikipedia data with the local seed file.
 * Wikipedia data is fetched fresh by Next.js ISR every 30 minutes — no redeploy needed.
 */
export async function getPolls(): Promise<Poll[]> {
  const local = pollsData as Poll[];

  try {
    const wikiPolls = await fetchWikiPolls();
    if (wikiPolls.length === 0) return local;

    // Merge: local data takes precedence (preserves manual corrections)
    const localIds = new Set(local.map(p => p.id));
    const newPolls = wikiPolls.filter(p => !localIds.has(p.id));

    if (newPolls.length > 0) {
      console.log(`[data] ${newPolls.length} new poll(s) from Wikipedia`);
    }

    return [...local, ...newPolls].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch {
    return local;
  }
}

export async function getLatestPolls(count = 10): Promise<Poll[]> {
  const polls = await getPolls();
  return polls.slice(0, count);
}

export async function getPollsByInstitute(institute: string): Promise<Poll[]> {
  const polls = await getPolls();
  return polls.filter(p => p.institute === institute);
}

export async function getPollsInRange(startDate: string, endDate: string): Promise<Poll[]> {
  const polls = await getPolls();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return polls.filter(p => {
    const d = new Date(p.date).getTime();
    return d >= start && d <= end;
  });
}
