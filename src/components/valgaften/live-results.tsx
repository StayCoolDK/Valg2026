'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PARTIES, getParty, MAJORITY_SEATS, BLOC_COLORS, BLOC_NAMES, ELECTION_DATE } from '@/lib/constants';
import type { ElectionNightData } from '@/lib/types/election-night';
import type { Bloc } from '@/lib/types';
import { Radio, Clock, CheckCircle2, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

const POLL_INTERVAL = 30_000; // 30 seconds
const ELECTION_NIGHT_START = `${ELECTION_DATE}T20:00:00+01:00`;

const STATUS_LABELS: Record<ElectionNightData['status'], string> = {
  waiting: 'Venter på resultater',
  counting: 'Optælling i gang',
  preliminary: 'Foreløbigt resultat',
  final: 'Endeligt resultat',
};

export function LiveResults({ demo = false }: { demo?: boolean }) {
  const [data, setData] = useState<ElectionNightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const autoRefresh = true;

  const fetchData = useCallback(async () => {
    try {
      const url = demo ? '/api/valgaften?demo=true' : '/api/valgaften';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const json: ElectionNightData = await res.json();
        setData(json);
        setLastFetch(new Date());
      }
    } catch {
      // Silently fail — keep previous data
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Henter data...</span>
      </div>
    );
  }

  // Pre-election waiting state
  if (!data || data.status === 'waiting') {
    return <WaitingState />;
  }

  return (
    <div className="space-y-8">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-4">
        <Badge
          variant={data.status === 'counting' ? 'default' : 'secondary'}
          className={`text-sm px-3 py-1.5 ${data.status === 'counting' ? 'animate-pulse' : ''}`}
        >
          {data.status === 'counting' && <Radio className="h-3.5 w-3.5 mr-1.5" />}
          {data.status === 'final' && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
          {STATUS_LABELS[data.status]}
        </Badge>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {data.totalCounted.toFixed(1)}% optalt
        </div>

        <div className="text-sm text-muted-foreground">
          {data.totalVotes.toLocaleString('da-DK')} stemmer
        </div>

        <div className="text-sm text-muted-foreground">
          DST senest {new Date(data.lastUpdated).toLocaleTimeString('da-DK')}
        </div>

        <div className="text-sm text-muted-foreground">
          {data.reportedConstituencies}/{data.totalConstituencies || 10} storkredse rapporteret
        </div>

        {lastFetch && (
          <div className="text-xs text-muted-foreground ml-auto flex items-center gap-1.5">
            <button
              onClick={fetchData}
              className="hover:text-foreground transition-colors"
              title="Opdater nu"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
            Sidst opdateret {lastFetch.toLocaleTimeString('da-DK')}
          </div>
        )}
      </div>

      {data.hasPartialData ? (
        <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-950/20">
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
              <div>
                <p className="font-medium text-foreground">Der er delvise eller forsinkede data fra DST</p>
                <p className="text-muted-foreground">
                  {data.usingCachedFallback
                    ? 'Siden viser senest kendte officielle snapshot, fordi en frisk hentning fejlede. Tjek tidspunktet og advarslerne nedenfor.'
                    : 'Siden viser de bedste tilgængelige officielle tal lige nu. Tjek tidspunktet og storkredsstatus nedenfor.'}
                </p>
              </div>
            </div>
            {data.warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {data.warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Officielle DST-data er hentet uden kendte advarsler i denne opdatering.
        </div>
      )}

      {/* Counted progress bar */}
      <div className="space-y-1">
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${data.totalCounted}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right">
          {data.totalCounted.toFixed(1)}% af stemmerne optalt
        </p>
        <p className="text-xs text-muted-foreground text-right">
          DST-status: {data.sourceStatusText || 'Ingen status endnu'}
        </p>
      </div>

      {/* Bloc summary cards */}
      <BlocSummary results={data.partyResults} />

      {/* Main results chart */}
      <Card>
        <CardHeader>
          <CardTitle>Stemmefordeling</CardTitle>
          <CardDescription>Procent af stemmer per parti</CardDescription>
        </CardHeader>
        <CardContent>
          <ResultsBarChart results={data.partyResults} />
        </CardContent>
      </Card>

      {/* Seat allocation */}
      {data.partyResults.some((r) => r.seats > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Mandatfordeling</CardTitle>
            <CardDescription>
              Mandater tildelt ud fra aktuel optælling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SeatsBarChart results={data.partyResults} />
          </CardContent>
        </Card>
      )}

      {/* Party results table */}
      <Card>
        <CardHeader>
          <CardTitle>Detaljerede resultater</CardTitle>
          <CardDescription>Alle partier med stemmer, procent og ændring</CardDescription>
        </CardHeader>
        <CardContent>
          <ResultsTable results={data.partyResults} />
        </CardContent>
      </Card>

      {/* Constituency results */}
      {data.constituencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Storkredse</CardTitle>
            <CardDescription>Optællingsstatus per storkreds</CardDescription>
          </CardHeader>
          <CardContent>
            <ConstituencyGrid constituencies={data.constituencies} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WaitingState() {
  const electionDate = new Date(ELECTION_NIGHT_START);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const diff = electionDate.getTime() - now.getTime();
  const hasStarted = diff <= 0;
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
  const seconds = Math.max(0, Math.floor((diff % (1000 * 60)) / 1000));

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm">
          <Clock className="h-4 w-4" />
          {hasStarted ? 'Valgstederne er lukket' : 'Valgaften starter kl. 20:00'}
        </div>
        <h2 className="text-2xl font-bold">
          {hasStarted ? 'Venter på de første officielle resultater' : 'Resultater kommer snart'}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {hasStarted
            ? 'Danmarks Statistik har endnu ikke offentliggjort de første tal. Denne side tjekker automatisk for nye resultater hvert 30. sekund og skifter til livevisning, så snart de lander.'
            : 'Når valgstederne lukker kl. 20:00 den 24. marts 2026 begynder optællingen. Denne side opdateres automatisk med live-resultater fra Danmarks Statistik.'}
        </p>
      </div>

      {!hasStarted && (
        <div className="grid grid-cols-4 gap-4 text-center">
          {[
            { value: days, label: 'dage' },
            { value: hours, label: 'timer' },
            { value: minutes, label: 'min' },
            { value: seconds, label: 'sek' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-card border rounded-lg px-4 py-3 min-w-[4.5rem]">
              <div className="text-2xl font-bold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1 text-center">
        <p>Data leveres af Danmarks Statistik (dst.dk)</p>
        <p>Siden tjekker automatisk for nye resultater hvert 30. sekund</p>
        <p>Hvis DST er forsinket eller mangler enkelte feeds, bliver det vist tydeligt her.</p>
      </div>
    </div>
  );
}

function BlocSummary({ results }: { results: ElectionNightData['partyResults'] }) {
  const blocs: Record<Bloc, { seats: number; pct: number }> = {
    red: { seats: 0, pct: 0 },
    blue: { seats: 0, pct: 0 },
    unaligned: { seats: 0, pct: 0 },
  };

  for (const r of results) {
    const party = PARTIES.find((p) => p.letter === r.partyLetter);
    if (!party) continue;
    blocs[party.bloc].seats += r.seats;
    blocs[party.bloc].pct += r.pct;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {(['red', 'unaligned', 'blue'] as const).map((bloc) => (
        <Card key={bloc} className="border-l-4" style={{ borderLeftColor: BLOC_COLORS[bloc] }}>
          <CardHeader className="pb-2">
            <CardDescription>{BLOC_NAMES[bloc]}</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {blocs[bloc].seats > 0
                ? `${blocs[bloc].seats} mandater`
                : `${blocs[bloc].pct.toFixed(1)}%`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {blocs[bloc].pct.toFixed(1)}% af stemmerne
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ResultsBarChart({ results }: { results: ElectionNightData['partyResults'] }) {
  const data = results
    .filter((r) => r.pct > 0)
    .map((r) => {
      const party = getParty(r.partyLetter);
      return {
        name: party.shortName,
        letter: r.partyLetter,
        pct: r.pct,
        color: party.color,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 50, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fontWeight: 500, fill: 'var(--muted-foreground)' }}
          width={65}
          interval={0}
        />
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(1)}%`]}
          contentStyle={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#e5e5e5',
          }}
          labelStyle={{ color: '#e5e5e5' }}
          itemStyle={{ color: '#e5e5e5' }}
        />
        <ReferenceLine
          x={2}
          stroke="#ef4444"
          strokeDasharray="5 5"
          label={{
            value: 'Spærregrænse (2%)',
            position: 'top',
            fontSize: 10,
            fill: '#ef4444',
          }}
        />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell key={entry.letter} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SeatsBarChart({ results }: { results: ElectionNightData['partyResults'] }) {
  const data = results
    .filter((r) => r.seats > 0)
    .map((r) => {
      const party = getParty(r.partyLetter);
      return {
        name: party.shortName,
        letter: r.partyLetter,
        seats: r.seats,
        color: party.color,
      };
    })
    .sort((a, b) => b.seats - a.seats);

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fontWeight: 500, fill: 'var(--muted-foreground)' }}
          width={65}
          interval={0}
        />
        <Tooltip
          formatter={(value: number) => [`${value} mandater`]}
          contentStyle={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#e5e5e5',
          }}
          labelStyle={{ color: '#e5e5e5' }}
          itemStyle={{ color: '#e5e5e5' }}
        />
        <ReferenceLine
          x={MAJORITY_SEATS}
          stroke="#ef4444"
          strokeDasharray="5 5"
          label={{
            value: `Flertal (${MAJORITY_SEATS})`,
            position: 'top',
            fontSize: 10,
            fill: '#ef4444',
          }}
        />
        <Bar dataKey="seats" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell key={entry.letter} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ResultsTable({ results }: { results: ElectionNightData['partyResults'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium">Parti</th>
            <th className="text-left py-2 font-medium hidden sm:table-cell">Navn</th>
            <th className="text-right py-2 font-medium">Stemmer</th>
            <th className="text-right py-2 font-medium">Procent</th>
            <th className="text-right py-2 font-medium">Mandater</th>
            <th className="text-right py-2 font-medium">Ændring</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const party = getParty(r.partyLetter);
            return (
              <tr key={r.partyLetter} className="border-b last:border-0 hover:bg-muted/50">
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: party.color }}
                    />
                    <span className="font-bold">{r.partyLetter}</span>
                  </div>
                </td>
                <td className="py-2.5 text-muted-foreground hidden sm:table-cell">{party.name}</td>
                <td className="text-right py-2.5 font-mono tabular-nums">
                  {r.votes.toLocaleString('da-DK')}
                </td>
                <td className="text-right py-2.5 font-mono tabular-nums font-bold">
                  {r.pct.toFixed(1)}%
                </td>
                <td className="text-right py-2.5 font-mono tabular-nums font-bold">
                  {r.seats > 0 ? r.seats : '–'}
                </td>
                <td className="text-right py-2.5">
                  <ChangeIndicator change={r.change} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  if (Math.abs(change) < 0.1) {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground inline" />;
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-500 text-xs">
        <TrendingUp className="h-3.5 w-3.5" />
        +{change.toFixed(1)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-red-500 text-xs">
      <TrendingDown className="h-3.5 w-3.5" />
      {change.toFixed(1)}
    </span>
  );
}

function ConstituencyGrid({
  constituencies,
}: {
  constituencies: ElectionNightData['constituencies'];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {constituencies.map((c) => {
        const topParties = [...c.results].sort((a, b) => b.pct - a.pct).slice(0, 3);
        return (
          <div key={c.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{c.name}</span>
              <Badge
                variant={c.counted >= 100 ? 'default' : 'secondary'}
                className="text-xs"
              >
                {c.counted.toFixed(0)}%
              </Badge>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${c.counted}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-xs">
              {topParties.map((p) => {
                const party = getParty(p.partyLetter);
                return (
                  <div key={p.partyLetter} className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: party.color }}
                    />
                    <span className="font-medium">{party.shortName}</span>
                    <span className="text-muted-foreground">{p.pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
