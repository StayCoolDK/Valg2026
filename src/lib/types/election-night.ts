import { PartyLetter } from '../types';

/** A single constituency (storkreds) result */
export interface ConstituencyResult {
  id: string;
  name: string;
  /** Percentage of votes counted in this constituency (0-100) */
  counted: number;
  results: {
    partyLetter: PartyLetter;
    votes: number;
    pct: number;
  }[];
}

/** Aggregated national result from election night */
export interface ElectionNightData {
  /** ISO timestamp of last update */
  lastUpdated: string;
  /** ISO timestamp for when our API assembled this payload */
  fetchedAt: string;
  /** True if the payload is served from the last successful in-memory snapshot */
  usingCachedFallback: boolean;
  /** Origin of any fallback data */
  fallbackSource: 'none' | 'memory' | 'snapshot';
  /** Overall percentage of votes counted nationally (0-100) */
  totalCounted: number;
  /** Total valid votes counted so far */
  totalVotes: number;
  /** Human-readable DST status message */
  sourceStatusText: string;
  /** Number of storkredse with published results */
  reportedConstituencies: number;
  /** Total number of storkredse discovered in the DST overview feed */
  totalConstituencies: number;
  /** Whether the payload is incomplete or degraded */
  hasPartialData: boolean;
  /** Any warnings that should be surfaced in the UI */
  warnings: string[];
  /** National party results (aggregated) */
  partyResults: {
    partyLetter: PartyLetter;
    votes: number;
    pct: number;
    seats: number;
    /** Change vs. forecast/last election */
    change: number;
  }[];
  /** Per-constituency breakdowns */
  constituencies: ConstituencyResult[];
  /** Whether the election night is active */
  isLive: boolean;
  /** Status message */
  status: 'waiting' | 'counting' | 'preliminary' | 'final';
}

/** Demo data for pre-election preview */
export function createDemoData(): ElectionNightData {
  return {
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
}
