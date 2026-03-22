export type PartyLetter = 'A' | 'B' | 'C' | 'F' | 'H' | 'I' | 'M' | 'O' | 'V' | 'Æ' | 'Ø' | 'Å';

export type Bloc = 'red' | 'blue' | 'unaligned';

export interface Party {
  letter: PartyLetter;
  name: string;
  shortName: string;
  leader: string;
  color: string;
  bloc: Bloc;
  lastElectionPct: number;
  lastElectionSeats: number;
}

export type PollingInstitute =
  | 'Voxmeter'
  | 'Epinion'
  | 'Megafon'
  | 'Verian'
  | 'YouGov'
  | 'Gallup'
  | 'Norstat';

export interface Poll {
  id: string;
  date: string;
  institute: PollingInstitute;
  source: string;
  sampleSize?: number;
  results: Partial<Record<PartyLetter, number>>;
}

export interface PollMeta {
  lastUpdated: string;
  totalPolls: number;
  latestPollDate: string;
}

export interface InstituteProfile {
  name: PollingInstitute;
  client: string;
  methodology: string;
  typicalSampleSize: number;
  frequency: string;
  qualityRating: number;
  houseEffects: Partial<Record<PartyLetter, number>>;
}

export interface WeightedAverage {
  partyLetter: PartyLetter;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  trend: 'up' | 'down' | 'stable';
  trendMagnitude: number;
  trend7d: 'up' | 'down' | 'stable';
  trendMagnitude7d: number;
  trend30d: 'up' | 'down' | 'stable';
  trendMagnitude30d: number;
}

export interface SeatAllocation {
  partyLetter: PartyLetter;
  seats: number;
}

export interface SeatRange {
  partyLetter: PartyLetter;
  median: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  meetsThreshold: number;
}

export interface BlocProbability {
  redMajority: number;
  blueMajority: number;
  redWithM: number;
  blueWithM: number;
  redSeatsMedian: number;
  blueSeatsMedian: number;
  mSeatsMedian: number;
}

export interface ThresholdRisk {
  partyLetter: PartyLetter;
  currentAverage: number;
  probabilityAboveThreshold: number;
  riskLevel: 'safe' | 'watch' | 'danger';
}

export interface ForecastResult {
  timestamp: string;
  pollsUsed: number;
  weightedAverages: WeightedAverage[];
  seatAllocations: SeatAllocation[];
  seatRanges: SeatRange[];
  blocProbabilities: BlocProbability;
  thresholdRisks: ThresholdRisk[];
  simulationCount: number;
}

export interface CoalitionScenario {
  id: string;
  name: string;
  parties: PartyLetter[];
  totalSeats: number;
  probability: number;
  hasMajority: boolean;
}

export interface ElectionResult {
  year: number;
  date: string;
  turnout: number;
  results: {
    partyLetter: PartyLetter;
    voteShare: number;
    seats: number;
  }[];
  government: string;
  primeMinister: string;
}
