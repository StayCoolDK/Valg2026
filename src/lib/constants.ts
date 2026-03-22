import { Party, PartyLetter, Bloc, InstituteProfile } from './types';

export const ELECTION_DATE = '2026-03-24';
export const TOTAL_SEATS = 175;
export const MAJORITY_SEATS = 90;
export const THRESHOLD_PCT = 2.0;

export const PARTIES: Party[] = [
  {
    letter: 'A',
    name: 'Socialdemokratiet',
    shortName: 'Soc.dem.',
    leader: 'Mette Frederiksen',
    color: '#A82721',
    bloc: 'red',
    lastElectionPct: 27.5,
    lastElectionSeats: 50,
  },
  {
    letter: 'B',
    name: 'Radikale Venstre',
    shortName: 'Rad. V.',
    leader: 'Martin Lidegaard',
    color: '#733280',
    bloc: 'red',
    lastElectionPct: 3.8,
    lastElectionSeats: 7,
  },
  {
    letter: 'C',
    name: 'Det Konservative Folkeparti',
    shortName: 'Kons.',
    leader: 'Mona Juul',
    color: '#00583C',
    bloc: 'blue',
    lastElectionPct: 5.5,
    lastElectionSeats: 10,
  },
  {
    letter: 'F',
    name: 'Socialistisk Folkeparti',
    shortName: 'SF',
    leader: 'Pia Olsen Dyhr',
    color: '#E4007E',
    bloc: 'red',
    lastElectionPct: 8.3,
    lastElectionSeats: 15,
  },
  {
    letter: 'H',
    name: 'Borgernes Parti',
    shortName: 'Borg.',
    leader: 'Lars Boje Mathiesen',
    color: '#0F1F3D',
    bloc: 'blue',
    lastElectionPct: 0,
    lastElectionSeats: 0,
  },
  {
    letter: 'I',
    name: 'Liberal Alliance',
    shortName: 'LA',
    leader: 'Alex Vanopslagh',
    color: '#00AEEF',
    bloc: 'blue',
    lastElectionPct: 7.9,
    lastElectionSeats: 14,
  },
  {
    letter: 'M',
    name: 'Moderaterne',
    shortName: 'Mod.',
    leader: 'Lars Løkke Rasmussen',
    color: '#7B2D8E',
    bloc: 'unaligned',
    lastElectionPct: 9.3,
    lastElectionSeats: 16,
  },
  {
    letter: 'O',
    name: 'Dansk Folkeparti',
    shortName: 'DF',
    leader: 'Morten Messerschmidt',
    color: '#E7AE08',
    bloc: 'blue',
    lastElectionPct: 2.6,
    lastElectionSeats: 5,
  },
  {
    letter: 'V',
    name: 'Venstre',
    shortName: 'Venstre',
    leader: 'Troels Lund Poulsen',
    color: '#002883',
    bloc: 'blue',
    lastElectionPct: 13.3,
    lastElectionSeats: 23,
  },
  {
    letter: 'Æ',
    name: 'Danmarksdemokraterne',
    shortName: 'DD',
    leader: 'Inger Støjberg',
    color: '#00594C',
    bloc: 'blue',
    lastElectionPct: 8.1,
    lastElectionSeats: 14,
  },
  {
    letter: 'Ø',
    name: 'Enhedslisten',
    shortName: 'Enh.',
    leader: 'Pelle Dragsted',
    color: '#D0004D',
    bloc: 'red',
    lastElectionPct: 5.1,
    lastElectionSeats: 9,
  },
  {
    letter: 'Å',
    name: 'Alternativet',
    shortName: 'Alt.',
    leader: 'Franciska Rosenkilde',
    color: '#2ECC71',
    bloc: 'red',
    lastElectionPct: 3.3,
    lastElectionSeats: 6,
  },
];

export const PARTY_MAP = new Map<PartyLetter, Party>(
  PARTIES.map((p) => [p.letter, p])
);

export function getParty(letter: PartyLetter): Party {
  return PARTY_MAP.get(letter)!;
}

export function getPartyColor(letter: PartyLetter): string {
  return PARTY_MAP.get(letter)?.color ?? '#888888';
}

export function getBlocParties(bloc: Bloc): Party[] {
  return PARTIES.filter((p) => p.bloc === bloc);
}

export const BLOC_COLORS: Record<Bloc, string> = {
  red: '#C0392B',
  blue: '#2471A3',
  unaligned: '#7B2D8E',
};

export const BLOC_NAMES: Record<Bloc, string> = {
  red: 'Rød blok',
  blue: 'Blå blok',
  unaligned: 'Moderaterne',
};

export const PARTY_ORDER: PartyLetter[] = [
  'Ø', 'F', 'A', 'B', 'Å', 'M', 'V', 'C', 'I', 'Æ', 'O', 'H',
];

export const INSTITUTES: InstituteProfile[] = [
  {
    name: 'Voxmeter',
    client: 'Ritzau',
    methodology: 'Telefon + web',
    typicalSampleSize: 1000,
    frequency: 'Ugentlig',
    qualityRating: 0.9,
    houseEffects: { A: 0.3, V: -0.2, I: 0.1, F: -0.1 },
  },
  {
    name: 'Epinion',
    client: 'DR',
    methodology: 'Web + telefon',
    typicalSampleSize: 5500,
    frequency: 'Løbende',
    qualityRating: 0.95,
    houseEffects: { A: -0.2, V: 0.3, Ø: 0.2, F: 0.1 },
  },
  {
    name: 'Megafon',
    client: 'TV 2 / Politiken',
    methodology: 'Telefon + web',
    typicalSampleSize: 1200,
    frequency: 'Hver 2. uge',
    qualityRating: 0.88,
    houseEffects: { A: 0.1, I: -0.3, O: 0.2 },
  },
  {
    name: 'Verian',
    client: 'Berlingske',
    methodology: 'Telefon',
    typicalSampleSize: 1000,
    frequency: 'Ugentlig',
    qualityRating: 0.92,
    houseEffects: { A: -0.1, V: 0.2, C: 0.1 },
  },
  {
    name: 'YouGov',
    client: 'B.T.',
    methodology: 'Online panel',
    typicalSampleSize: 1500,
    frequency: 'Ugentlig',
    qualityRating: 0.85,
    houseEffects: { A: -0.4, I: 0.3, Ø: -0.2, O: 0.3 },
  },
  {
    name: 'Norstat',
    client: 'Altinget',
    methodology: 'Web',
    typicalSampleSize: 1000,
    frequency: 'Månedlig',
    qualityRating: 0.82,
    houseEffects: {},
  },
];

export const INSTITUTE_MAP = new Map(INSTITUTES.map((i) => [i.name, i]));
