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
  /** Overall percentage of votes counted nationally (0-100) */
  totalCounted: number;
  /** Total valid votes counted so far */
  totalVotes: number;
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
    totalCounted: 0,
    totalVotes: 0,
    partyResults: [],
    constituencies: [],
    isLive: false,
    status: 'waiting',
  };
}
