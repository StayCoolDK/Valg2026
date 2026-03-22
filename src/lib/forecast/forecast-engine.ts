import type {
  Poll,
  PartyLetter,
  ForecastResult,
  CoalitionScenario,
} from '../types';
import { MAJORITY_SEATS } from '../constants';
import { computeWeightedAverages } from './poll-averager';
import { allocateSeats } from './seat-allocator';
import { runSimulations } from './monte-carlo';

const SIMULATION_COUNT = 10_000;

interface CoalitionPreset {
  id: string;
  name: string;
  parties: PartyLetter[];
}

const COALITION_PRESETS: CoalitionPreset[] = [
  { id: 'rod-blok', name: 'Rød blok', parties: ['Ø', 'F', 'A', 'B', 'Å'] },
  { id: 'bla-blok', name: 'Blå blok', parties: ['V', 'C', 'I', 'Æ', 'O', 'H'] },
  { id: 'rod-blok-m', name: 'Rød blok + M', parties: ['Ø', 'F', 'A', 'B', 'Å', 'M'] },
  { id: 'bla-blok-m', name: 'Blå blok + M', parties: ['V', 'C', 'I', 'Æ', 'O', 'H', 'M'] },
  { id: 'svm', name: 'SVM-fortsættelse', parties: ['A', 'V', 'M'] },
  { id: 's-sf-r', name: 'S + SF + R', parties: ['A', 'F', 'B'] },
  { id: 'bred-bla', name: 'Bred blå', parties: ['V', 'C', 'I', 'M'] },
];

/**
 * Run the full forecast pipeline: weighted averaging, seat allocation,
 * Monte Carlo simulation.
 */
export function runForecast(polls: Poll[]): ForecastResult {
  const weightedAverages = computeWeightedAverages(polls);

  // Point-estimate seat allocation from weighted means
  const voteShares = {} as Record<PartyLetter, number>;
  for (const avg of weightedAverages) {
    voteShares[avg.partyLetter] = avg.mean;
  }
  const seatAllocations = allocateSeats(voteShares);

  // Monte Carlo simulations
  const { seatRanges, blocProbabilities, thresholdRisks } = runSimulations(
    weightedAverages,
    SIMULATION_COUNT,
  );

  return {
    timestamp: new Date().toISOString(),
    pollsUsed: polls.length,
    weightedAverages,
    seatAllocations,
    seatRanges,
    blocProbabilities,
    thresholdRisks,
    simulationCount: SIMULATION_COUNT,
  };
}

/**
 * Compute coalition scenarios from a forecast result.
 * Uses the seat ranges from Monte Carlo to estimate each
 * coalition's total seats and probability of majority.
 */
export function computeCoalitions(
  forecast: ForecastResult,
): CoalitionScenario[] {
  const seatMap = new Map(
    forecast.seatAllocations.map((s) => [s.partyLetter, s.seats]),
  );
  const rangeMap = new Map(
    forecast.seatRanges.map((r) => [r.partyLetter, r]),
  );

  return COALITION_PRESETS.map((preset) => {
    // Sum point-estimate seats
    const totalSeats = preset.parties.reduce(
      (sum, letter) => sum + (seatMap.get(letter) ?? 0),
      0,
    );

    // Estimate majority probability from median + spread
    // Use the p25 sum as a conservative check: if even the lower
    // quartile sum meets majority, probability is high.
    const p25Sum = preset.parties.reduce(
      (sum, letter) => sum + (rangeMap.get(letter)?.p25 ?? 0),
      0,
    );
    const p75Sum = preset.parties.reduce(
      (sum, letter) => sum + (rangeMap.get(letter)?.p75 ?? 0),
      0,
    );
    const medianSum = preset.parties.reduce(
      (sum, letter) => sum + (rangeMap.get(letter)?.median ?? 0),
      0,
    );

    // Approximate probability using linear interpolation between p25 and p75
    let probability: number;
    if (p25Sum >= MAJORITY_SEATS) {
      probability = 0.95;
    } else if (p75Sum < MAJORITY_SEATS) {
      probability = 0.05;
    } else if (medianSum >= MAJORITY_SEATS) {
      // Between 0.5 and 0.95 based on how far above majority
      const margin = medianSum - MAJORITY_SEATS;
      const spread = p75Sum - p25Sum;
      probability = Math.min(0.95, 0.5 + (margin / Math.max(spread, 1)) * 0.45);
    } else {
      // Between 0.05 and 0.5
      const deficit = MAJORITY_SEATS - medianSum;
      const spread = p75Sum - p25Sum;
      probability = Math.max(0.05, 0.5 - (deficit / Math.max(spread, 1)) * 0.45);
    }

    return {
      id: preset.id,
      name: preset.name,
      parties: preset.parties,
      totalSeats,
      probability: Math.round(probability * 1000) / 1000,
      hasMajority: totalSeats >= MAJORITY_SEATS,
    };
  });
}
