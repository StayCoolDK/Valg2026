import type { PartyLetter, SeatAllocation } from '../types';
import { TOTAL_SEATS, THRESHOLD_PCT, PARTY_ORDER } from '../constants';

/**
 * D'Hondt method for proportional seat allocation.
 * Divides each party's votes by 1, 2, 3, ... and awards seats
 * to the highest quotients.
 */
export function dHondt(
  votes: Map<string, number>,
  totalSeats: number,
): Map<string, number> {
  const seats = new Map<string, number>();
  for (const key of votes.keys()) {
    seats.set(key, 0);
  }

  for (let s = 0; s < totalSeats; s++) {
    let bestParty = '';
    let bestQuotient = -1;

    for (const [party, voteCount] of votes) {
      const currentSeats = seats.get(party)!;
      const quotient = voteCount / (currentSeats + 1);
      if (quotient > bestQuotient) {
        bestQuotient = quotient;
        bestParty = party;
      }
    }

    if (bestParty) {
      seats.set(bestParty, seats.get(bestParty)! + 1);
    }
  }

  return seats;
}

/**
 * Allocate seats from vote shares (percentages).
 * Parties below the 2% threshold are filtered out and their
 * vote share is redistributed proportionally among qualifying parties.
 */
export function allocateSeats(
  voteShares: Record<PartyLetter, number>,
): SeatAllocation[] {
  // Filter parties meeting threshold
  const qualifying: { letter: PartyLetter; share: number }[] = [];
  let qualifyingTotal = 0;

  for (const letter of PARTY_ORDER) {
    const share = voteShares[letter] ?? 0;
    if (share >= THRESHOLD_PCT) {
      qualifying.push({ letter, share });
      qualifyingTotal += share;
    }
  }

  if (qualifying.length === 0) {
    return PARTY_ORDER.map((letter) => ({ partyLetter: letter, seats: 0 }));
  }

  // Redistribute to qualifying parties proportionally
  const votes = new Map<string, number>();
  for (const { letter, share } of qualifying) {
    const redistributed = (share / qualifyingTotal) * 100;
    votes.set(letter, redistributed);
  }

  const seatMap = dHondt(votes, TOTAL_SEATS);

  // Build result for all parties (including those below threshold with 0 seats)
  return PARTY_ORDER.map((letter) => ({
    partyLetter: letter,
    seats: seatMap.get(letter) ?? 0,
  }));
}
