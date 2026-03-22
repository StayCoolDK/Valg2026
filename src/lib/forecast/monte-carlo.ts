import type {
  PartyLetter,
  WeightedAverage,
  SeatRange,
  BlocProbability,
  ThresholdRisk,
} from '../types';
import { PARTIES, PARTY_ORDER, MAJORITY_SEATS, THRESHOLD_PCT } from '../constants';
import { allocateSeats } from './seat-allocator';

const DEFAULT_SIMULATION_COUNT = 10_000;
const BLOC_SHOCK_STD = 0.5;

// ---- Seeded PRNG (mulberry32) for deterministic results ----

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Box-Muller normal random ----

let spareReady = false;
let spare = 0;
let rng: () => number = Math.random;

function normalRandom(mean: number, stdDev: number): number {
  if (spareReady) {
    spareReady = false;
    return spare * stdDev + mean;
  }

  let u: number, v: number, s: number;
  do {
    u = rng() * 2 - 1;
    v = rng() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);

  const mul = Math.sqrt((-2 * Math.log(s)) / s);
  spare = v * mul;
  spareReady = true;
  return u * mul * stdDev + mean;
}

// ---- Helpers ----

function getBlocForParty(letter: PartyLetter): 'red' | 'blue' | 'unaligned' {
  const party = PARTIES.find((p) => p.letter === letter);
  return party?.bloc ?? 'unaligned';
}

function median(arr: number[]): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const frac = idx - lower;
  if (lower + 1 >= sorted.length) return sorted[lower];
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower]);
}

/**
 * Run Monte Carlo simulations to produce seat ranges,
 * bloc probabilities, and threshold risk assessments.
 */
export function runSimulations(
  averages: WeightedAverage[],
  count: number = DEFAULT_SIMULATION_COUNT,
): {
  seatRanges: SeatRange[];
  blocProbabilities: BlocProbability;
  thresholdRisks: ThresholdRisk[];
} {
  // Seed PRNG for deterministic results (avoids hydration mismatch)
  rng = mulberry32(42);
  spareReady = false;

  const avgMap = new Map<PartyLetter, WeightedAverage>();
  for (const avg of averages) {
    avgMap.set(avg.partyLetter, avg);
  }

  // Storage for per-party seat outcomes
  const seatResults = new Map<PartyLetter, number[]>();
  // Per-party threshold count
  const thresholdCounts = new Map<PartyLetter, number>();
  for (const letter of PARTY_ORDER) {
    seatResults.set(letter, []);
    thresholdCounts.set(letter, 0);
  }

  // Bloc seat accumulators
  const redSeatTotals: number[] = [];
  const blueSeatTotals: number[] = [];
  const mSeatTotals: number[] = [];
  let redMajorityCount = 0;
  let blueMajorityCount = 0;
  let redWithMCount = 0;
  let blueWithMCount = 0;

  for (let sim = 0; sim < count; sim++) {
    // Draw correlated bloc shocks
    const redShock = normalRandom(0, BLOC_SHOCK_STD);
    const blueShock = normalRandom(0, BLOC_SHOCK_STD);

    // Draw random vote shares
    const draws: Record<string, number> = {};
    let total = 0;

    for (const letter of PARTY_ORDER) {
      const avg = avgMap.get(letter);
      if (!avg || avg.mean <= 0) {
        draws[letter] = 0;
        continue;
      }

      // Base draw from normal distribution
      const stdDev = Math.max(avg.stdDev, 0.3);
      let draw = normalRandom(avg.mean, stdDev);

      // Apply correlated bloc shock
      const bloc = getBlocForParty(letter);
      if (bloc === 'red') draw += redShock;
      else if (bloc === 'blue') draw += blueShock;

      // Clamp to non-negative
      draw = Math.max(0, draw);
      draws[letter] = draw;
      total += draw;
    }

    // Normalize to 100%
    if (total > 0) {
      for (const letter of PARTY_ORDER) {
        draws[letter] = (draws[letter] / total) * 100;
      }
    }

    // Track threshold
    for (const letter of PARTY_ORDER) {
      if (draws[letter] >= THRESHOLD_PCT) {
        thresholdCounts.set(letter, thresholdCounts.get(letter)! + 1);
      }
    }

    // Allocate seats
    const voteShares = {} as Record<PartyLetter, number>;
    for (const letter of PARTY_ORDER) {
      voteShares[letter] = draws[letter];
    }

    const allocation = allocateSeats(voteShares);

    let redSeats = 0;
    let blueSeats = 0;
    let mSeats = 0;

    for (const { partyLetter, seats } of allocation) {
      seatResults.get(partyLetter)!.push(seats);

      const bloc = getBlocForParty(partyLetter);
      if (bloc === 'red') redSeats += seats;
      else if (bloc === 'blue') blueSeats += seats;
      if (partyLetter === 'M') mSeats = seats;
    }

    redSeatTotals.push(redSeats);
    blueSeatTotals.push(blueSeats);
    mSeatTotals.push(mSeats);

    if (redSeats >= MAJORITY_SEATS) redMajorityCount++;
    if (blueSeats >= MAJORITY_SEATS) blueMajorityCount++;
    if (redSeats + mSeats >= MAJORITY_SEATS) redWithMCount++;
    if (blueSeats + mSeats >= MAJORITY_SEATS) blueWithMCount++;
  }

  // Assemble seat ranges
  const seatRanges: SeatRange[] = PARTY_ORDER.map((letter) => {
    const seats = seatResults.get(letter)!;
    return {
      partyLetter: letter,
      median: Math.round(median(seats)),
      p5: Math.round(percentile(seats, 5)),
      p25: Math.round(percentile(seats, 25)),
      p75: Math.round(percentile(seats, 75)),
      p95: Math.round(percentile(seats, 95)),
      meetsThreshold: thresholdCounts.get(letter)! / count,
    };
  });

  // Bloc probabilities
  const blocProbabilities: BlocProbability = {
    redMajority: redMajorityCount / count,
    blueMajority: blueMajorityCount / count,
    redWithM: redWithMCount / count,
    blueWithM: blueWithMCount / count,
    redSeatsMedian: Math.round(median(redSeatTotals)),
    blueSeatsMedian: Math.round(median(blueSeatTotals)),
    mSeatsMedian: Math.round(median(mSeatTotals)),
  };

  // Threshold risks
  const thresholdRisks: ThresholdRisk[] = PARTY_ORDER.map((letter) => {
    const avg = avgMap.get(letter);
    const currentAverage = avg?.mean ?? 0;
    const probabilityAboveThreshold = thresholdCounts.get(letter)! / count;

    let riskLevel: 'safe' | 'watch' | 'danger';
    if (probabilityAboveThreshold >= 0.95) {
      riskLevel = 'safe';
    } else if (probabilityAboveThreshold >= 0.5) {
      riskLevel = 'watch';
    } else {
      riskLevel = 'danger';
    }

    return {
      partyLetter: letter,
      currentAverage: Math.round(currentAverage * 100) / 100,
      probabilityAboveThreshold: Math.round(probabilityAboveThreshold * 1000) / 1000,
      riskLevel,
    };
  });

  return { seatRanges, blocProbabilities, thresholdRisks };
}
