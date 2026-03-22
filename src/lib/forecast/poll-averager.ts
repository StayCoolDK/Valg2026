import type { Poll, PartyLetter, WeightedAverage, PollingInstitute } from '../types';
import { PARTY_ORDER, INSTITUTE_MAP } from '../constants';

const HALF_LIFE_DAYS = 14;
const TREND_WINDOW_DAYS = 7;
const TREND_WINDOW_30D = 30;
const LN2 = Math.LN2;

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return (new Date(b).getTime() - new Date(a).getTime()) / msPerDay;
}

function recencyWeight(pollDate: string, referenceDate: string): number {
  const age = daysBetween(pollDate, referenceDate);
  if (age < 0) return 0;
  return Math.exp((-LN2 * age) / HALF_LIFE_DAYS);
}

function qualityWeight(instituteName: PollingInstitute): number {
  const profile = INSTITUTE_MAP.get(instituteName);
  return profile?.qualityRating ?? 0.8;
}

function houseEffect(instituteName: PollingInstitute, party: PartyLetter): number {
  const profile = INSTITUTE_MAP.get(instituteName);
  return profile?.houseEffects[party] ?? 0;
}

/**
 * Compute weighted averages for all parties from a set of polls.
 * Uses exponential recency decay, pollster quality weighting,
 * house effects correction, and a 7-day trend calculation.
 */
export function computeWeightedAverages(
  polls: Poll[],
  referenceDate?: string,
): WeightedAverage[] {
  if (polls.length === 0) {
    return PARTY_ORDER.map((letter) => ({
      partyLetter: letter,
      mean: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      trend: 'stable' as const,
      trendMagnitude: 0,
      trend7d: 'stable' as const,
      trendMagnitude7d: 0,
      trend30d: 'stable' as const,
      trendMagnitude30d: 0,
    }));
  }

  const refDate = referenceDate ?? polls.reduce(
    (latest, p) => (p.date > latest ? p.date : latest),
    polls[0].date,
  );

  const results: WeightedAverage[] = [];

  for (const letter of PARTY_ORDER) {
    const observations: { value: number; weight: number; date: string }[] = [];

    for (const poll of polls) {
      const raw = poll.results[letter];
      if (raw === undefined) continue;

      const corrected = raw - houseEffect(poll.institute, letter);
      const w = recencyWeight(poll.date, refDate) * qualityWeight(poll.institute);
      if (w <= 0) continue;

      observations.push({ value: corrected, weight: w, date: poll.date });
    }

    if (observations.length === 0) {
      results.push({
        partyLetter: letter,
        mean: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        trend: 'stable',
        trendMagnitude: 0,
        trend7d: 'stable' as const,
        trendMagnitude7d: 0,
        trend30d: 'stable' as const,
        trendMagnitude30d: 0,
      });
      continue;
    }

    // Weighted mean
    let sumW = 0;
    let sumWx = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const obs of observations) {
      sumW += obs.weight;
      sumWx += obs.weight * obs.value;
      if (obs.value < minVal) minVal = obs.value;
      if (obs.value > maxVal) maxVal = obs.value;
    }

    const mean = sumW > 0 ? sumWx / sumW : 0;

    // Weighted standard deviation
    let sumWd2 = 0;
    for (const obs of observations) {
      sumWd2 += obs.weight * (obs.value - mean) ** 2;
    }
    const stdDev = sumW > 0 ? Math.sqrt(sumWd2 / sumW) : 0;

    const TREND_THRESHOLD = 0.3;

    const computeTrend = (windowDays: number): { trend: 'up' | 'down' | 'stable'; trendMagnitude: number } => {
      const cutoff = new Date(
        new Date(refDate).getTime() - windowDays * 86_400_000,
      ).toISOString().slice(0, 10);
      const recent = observations.filter((o) => o.date >= cutoff);
      const older = observations.filter((o) => o.date < cutoff);
      if (recent.length === 0 || older.length === 0) {
        return { trend: 'stable' as const, trendMagnitude: 0 };
      }
      const recentMean =
        recent.reduce((s, o) => s + o.weight * o.value, 0) /
        recent.reduce((s, o) => s + o.weight, 0);
      const olderMean =
        older.reduce((s, o) => s + o.weight * o.value, 0) /
        older.reduce((s, o) => s + o.weight, 0);
      const diff = recentMean - olderMean;
      return {
        trend: diff > TREND_THRESHOLD ? 'up' : diff < -TREND_THRESHOLD ? 'down' : 'stable' as const,
        trendMagnitude: Math.round(diff * 100) / 100,
      };
    };

    const t7 = computeTrend(TREND_WINDOW_DAYS);
    const t30 = computeTrend(TREND_WINDOW_30D);

    results.push({
      partyLetter: letter,
      mean: Math.round(mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      min: Math.round(minVal * 100) / 100,
      max: Math.round(maxVal * 100) / 100,
      trend: t7.trend,
      trendMagnitude: t7.trendMagnitude,
      trend7d: t7.trend,
      trendMagnitude7d: t7.trendMagnitude,
      trend30d: t30.trend,
      trendMagnitude30d: t30.trendMagnitude,
    });
  }

  return results;
}
