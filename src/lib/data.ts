import pollsData from '@/data/polls.json';
import { Poll } from './types';

export function getPolls(): Poll[] {
  return pollsData as Poll[];
}

export function getLatestPolls(count: number = 10): Poll[] {
  const polls = getPolls();
  return polls
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, count);
}

export function getPollsByInstitute(institute: string): Poll[] {
  return getPolls().filter((p) => p.institute === institute);
}

export function getPollsInRange(startDate: string, endDate: string): Poll[] {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return getPolls().filter((p) => {
    const d = new Date(p.date).getTime();
    return d >= start && d <= end;
  });
}
