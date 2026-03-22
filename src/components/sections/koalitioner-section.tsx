'use client';

import { useState, useMemo } from 'react';
import { getPolls } from '@/lib/data';
import { runForecast, computeCoalitions } from '@/lib/forecast/forecast-engine';
import { PARTIES, PARTY_ORDER, MAJORITY_SEATS } from '@/lib/constants';
import { PartyLetter } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

const PRESET_COALITIONS = [
  { id: 'rod', name: 'Rød blok', parties: ['Ø', 'F', 'A', 'B', 'Å'] as PartyLetter[] },
  { id: 'bla', name: 'Blå blok', parties: ['V', 'C', 'I', 'Æ', 'O', 'H'] as PartyLetter[] },
  { id: 'rod-m', name: 'Rød + M', parties: ['Ø', 'F', 'A', 'B', 'Å', 'M'] as PartyLetter[] },
  { id: 'bla-m', name: 'Blå + M', parties: ['V', 'C', 'I', 'Æ', 'O', 'H', 'M'] as PartyLetter[] },
  { id: 'svm', name: 'SVM', parties: ['A', 'V', 'M'] as PartyLetter[] },
  { id: 'sfr', name: 'S + SF + R', parties: ['A', 'F', 'B'] as PartyLetter[] },
];

export function KoalitionerSection() {
  const [selected, setSelected] = useState<Set<PartyLetter>>(new Set());

  const polls = useMemo(() => getPolls(), []);
  const forecast = useMemo(() => runForecast(polls), [polls]);
  const coalitions = useMemo(() => computeCoalitions(forecast), [forecast]);
  const seatMap = useMemo(
    () => new Map(forecast.seatAllocations.map((a) => [a.partyLetter, a.seats])),
    [forecast]
  );

  const toggleParty = (letter: PartyLetter) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  };

  const totalSeats = Array.from(selected).reduce(
    (sum, letter) => sum + (seatMap.get(letter) ?? 0),
    0
  );
  const hasMajority = totalSeats >= MAJORITY_SEATS;

  return (
    <div className="space-y-6">
      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COALITIONS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => setSelected(new Set(preset.parties))}
            className="px-4 py-2 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            {preset.name}
          </button>
        ))}
        <button
          onClick={() => setSelected(new Set())}
          className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
        >
          Nulstil
        </button>
      </div>

      {/* Party selector */}
      <Card>
        <CardHeader>
          <CardTitle>Vælg partier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {PARTY_ORDER.map((letter) => {
              const party = PARTIES.find((p) => p.letter === letter)!;
              const seats = seatMap.get(letter) ?? 0;
              const isSelected = selected.has(letter);
              if (seats === 0) return null;

              return (
                <button
                  key={letter}
                  onClick={() => toggleParty(letter)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: party.color }}
                    >
                      {party.letter}
                    </span>
                    <span className="text-sm font-medium truncate">{party.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary ml-auto" />}
                  </div>
                  <div className="text-lg font-bold">{seats}</div>
                  <div className="text-xs text-muted-foreground">mandater</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      <Card className={hasMajority ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/10' : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/10'}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold">
                {totalSeats} mandater
              </div>
              <p className="text-muted-foreground mt-1">
                {hasMajority
                  ? `Flertal! ${totalSeats - MAJORITY_SEATS} mandater over grænsen.`
                  : `Mangler ${MAJORITY_SEATS - totalSeats} mandater for flertal.`}
              </p>
            </div>
            <div className={`text-6xl ${hasMajority ? 'text-green-500' : 'text-red-500'}`}>
              {hasMajority ? <Check className="h-16 w-16" /> : <X className="h-16 w-16" />}
            </div>
          </div>

          <div className="mt-4 relative h-6 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (totalSeats / MAJORITY_SEATS) * 100)}%`,
                backgroundColor: hasMajority ? '#22c55e' : '#ef4444',
              }}
            />
            <div
              className="absolute inset-y-0 border-r-2 border-dashed border-foreground/50"
              style={{ left: `${(MAJORITY_SEATS / 175) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span>
            <span>{MAJORITY_SEATS} (flertal)</span>
            <span>175</span>
          </div>
        </CardContent>
      </Card>

      {/* Preset scenarios */}
      <Card>
        <CardHeader>
          <CardTitle>Koalitionsscenarier</CardTitle>
          <CardDescription>
            Baseret på prognosemodel med sandsynlighedsberegning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {coalitions.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="flex gap-1 mt-1">
                    {c.parties.map((letter) => {
                      const party = PARTIES.find((p) => p.letter === letter);
                      return (
                        <span
                          key={letter}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: party?.color }}
                        >
                          {letter}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">{c.totalSeats} mandater</div>
                  <Badge variant={c.hasMajority ? 'default' : 'secondary'}>
                    {(c.probability * 100).toFixed(0)} % sandsynlighed
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
