import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BlocDonutChart } from '@/components/charts/bloc-donut-chart';
import { SeatBarChart } from '@/components/charts/seat-bar-chart';
import { SeatRangeChart } from '@/components/charts/seat-range-chart';
import { HemicycleChart } from '@/components/charts/hemicycle-chart';
import { PollTrendChart } from '@/components/charts/poll-trend-chart';
import { ThresholdGauge } from '@/components/charts/threshold-gauge';
import { CountdownClient } from '@/components/dashboard/countdown-client';
import { PollsTableClient } from '@/components/polls/polls-table-client';
import { KoalitionerSection } from '@/components/sections/koalitioner-section';
import { getPolls } from '@/lib/data';
import { runForecast } from '@/lib/forecast/forecast-engine';
import {
  PARTIES, PARTY_ORDER, getParty,
  BLOC_COLORS, BLOC_NAMES, ELECTION_DATE, MAJORITY_SEATS, INSTITUTES,
} from '@/lib/constants';
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

// Re-render this page on the server every 5 minutes to pick up new polls
export const revalidate = 300;

/* ── Historiske valgdata ─────────────────────────────────── */

const ELECTIONS = [
  {
    year: 2022, date: '1. november 2022', turnout: 84.1,
    government: 'SVM-regeringen', primeMinister: 'Mette Frederiksen (A)',
    results: [
      { letter: 'A', pct: 27.5, seats: 50 }, { letter: 'V', pct: 13.3, seats: 23 },
      { letter: 'M', pct: 9.3, seats: 16 }, { letter: 'F', pct: 8.3, seats: 15 },
      { letter: 'Æ', pct: 8.1, seats: 14 }, { letter: 'I', pct: 7.9, seats: 14 },
      { letter: 'C', pct: 5.5, seats: 10 }, { letter: 'Ø', pct: 5.1, seats: 9 },
      { letter: 'B', pct: 3.8, seats: 7 }, { letter: 'Å', pct: 3.3, seats: 6 },
      { letter: 'O', pct: 2.6, seats: 5 },
    ],
  },
  {
    year: 2019, date: '5. juni 2019', turnout: 84.6,
    government: 'Socialdemokratiet (mindretalsregering)', primeMinister: 'Mette Frederiksen (A)',
    results: [
      { letter: 'A', pct: 25.9, seats: 48 }, { letter: 'V', pct: 23.4, seats: 43 },
      { letter: 'O', pct: 8.7, seats: 16 }, { letter: 'B', pct: 8.6, seats: 16 },
      { letter: 'F', pct: 7.7, seats: 14 }, { letter: 'Ø', pct: 6.9, seats: 13 },
      { letter: 'C', pct: 6.6, seats: 12 }, { letter: 'Å', pct: 3.0, seats: 5 },
      { letter: 'I', pct: 2.3, seats: 4 },
    ],
  },
  {
    year: 2015, date: '18. juni 2015', turnout: 85.9,
    government: 'Venstre (mindretalsregering)', primeMinister: 'Lars Løkke Rasmussen (V)',
    results: [
      { letter: 'A', pct: 26.3, seats: 47 }, { letter: 'O', pct: 21.1, seats: 37 },
      { letter: 'V', pct: 19.5, seats: 34 }, { letter: 'Ø', pct: 7.8, seats: 14 },
      { letter: 'I', pct: 7.5, seats: 13 }, { letter: 'Å', pct: 4.8, seats: 9 },
      { letter: 'B', pct: 4.6, seats: 8 }, { letter: 'F', pct: 4.2, seats: 7 },
      { letter: 'C', pct: 3.4, seats: 6 },
    ],
  },
  {
    year: 2011, date: '15. september 2011', turnout: 87.7,
    government: 'S-R-SF-regeringen', primeMinister: 'Helle Thorning-Schmidt (A)',
    results: [
      { letter: 'V', pct: 26.7, seats: 47 }, { letter: 'A', pct: 24.8, seats: 44 },
      { letter: 'O', pct: 12.3, seats: 22 }, { letter: 'B', pct: 9.5, seats: 17 },
      { letter: 'F', pct: 9.2, seats: 16 }, { letter: 'Ø', pct: 6.7, seats: 12 },
      { letter: 'I', pct: 5.0, seats: 9 }, { letter: 'C', pct: 4.9, seats: 8 },
    ],
  },
];

/* ── Side ────────────────────────────────────────────────── */

export default async function HomePage() {
  const polls = await getPolls();
  const forecast = runForecast(polls);
  const { blocProbabilities, seatAllocations, seatRanges, thresholdRisks, weightedAverages } = forecast;

  const seatMap = new Map(seatAllocations.map((s) => [s.partyLetter, s.seats]));
  const avgMap = new Map(weightedAverages.map((a) => [a.partyLetter, a]));

  const sortedPolls = [...polls].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const institutesWithData = new Set(polls.map((p) => p.institute));
  const instituteNames = INSTITUTES.map((i) => i.name).filter((n) => institutesWithData.has(n));

  const sortedAverages = PARTY_ORDER
    .map((letter) => weightedAverages.find((a) => a.partyLetter === letter))
    .filter((a) => a != null && a.mean >= 0.5);

  return (
    <div className="min-h-screen">
      {/* ─── §1 Hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(192,57,43,0.15),transparent_50%),radial-gradient(circle_at_70%_50%,rgba(36,113,163,0.15),transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28 text-center">
          <Badge variant="outline" className="mb-6 border-white/20 text-white/80 text-sm px-4 py-1.5">
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            24. marts 2026
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-4">
            Folketingsvalg 2026
          </h1>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10">
            {`Den ultimative valgprognose for det kommende folketingsvalg. Baseret på ${polls.length} meningsmålinger med statistisk modellering, Monte Carlo-simuleringer og d'Hondt-mandatberegning.`}
          </p>
          <CountdownClient electionDate={ELECTION_DATE} />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 space-y-20">

        {/* ─── §2 Blokoversigt ───────────────────────────── */}
        <section id="blokoversigt">
          <h2 className="text-2xl font-bold mb-2">Blokoversigt</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Dansk politik er delt i en rød og blå blok. Der kræves mindst {MAJORITY_SEATS} af 175 mandater for flertal.
          </p>

          {/* Bloc stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="border-l-4 bg-card shadow-lg" style={{ borderLeftColor: BLOC_COLORS.red }}>
              <CardHeader className="pb-2">
                <CardDescription>{BLOC_NAMES.red}</CardDescription>
                <CardTitle className="text-3xl font-bold">{blocProbabilities.redSeatsMedian} mandater</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {(blocProbabilities.redMajority * 100).toFixed(0)} % sandsynlighed for flertal alene
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 bg-card shadow-lg" style={{ borderLeftColor: BLOC_COLORS.unaligned }}>
              <CardHeader className="pb-2">
                <CardDescription>{BLOC_NAMES.unaligned}</CardDescription>
                <CardTitle className="text-3xl font-bold">{blocProbabilities.mSeatsMedian} mandater</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Tungen på vægtskålen</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 bg-card shadow-lg" style={{ borderLeftColor: BLOC_COLORS.blue }}>
              <CardHeader className="pb-2">
                <CardDescription>{BLOC_NAMES.blue}</CardDescription>
                <CardTitle className="text-3xl font-bold">{blocProbabilities.blueSeatsMedian} mandater</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {(blocProbabilities.blueMajority * 100).toFixed(0)} % sandsynlighed for flertal alene
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Folketingssalen</CardTitle>
                <CardDescription>175 mandater fordelt efter prognosen — hver prik er ét mandat</CardDescription>
              </CardHeader>
              <CardContent>
                <HemicycleChart allocations={seatAllocations} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mandatfordeling</CardTitle>
                <CardDescription>Estimeret mandattal per parti</CardDescription>
              </CardHeader>
              <CardContent>
                <SeatBarChart allocations={seatAllocations} height={400} />
              </CardContent>
            </Card>
          </div>

          {/* Majority scenarios + threshold */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Flertalsscenarier</CardTitle>
                <CardDescription>
                  Sandsynlighed baseret på {forecast.simulationCount.toLocaleString('da-DK')} simuleringer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  { label: 'Rød blok alene', prob: blocProbabilities.redMajority, color: BLOC_COLORS.red },
                  { label: 'Rød blok + M', prob: blocProbabilities.redWithM, color: BLOC_COLORS.red },
                  { label: 'Blå blok alene', prob: blocProbabilities.blueMajority, color: BLOC_COLORS.blue },
                  { label: 'Blå blok + M', prob: blocProbabilities.blueWithM, color: BLOC_COLORS.blue },
                ].map(({ label, prob, color }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="font-bold tabular-nums">{(prob * 100).toFixed(1)} %</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(prob * 100, 1)}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Spærregrænseanalyse</CardTitle>
                <CardDescription>Partier tæt på 2 %-grænsen</CardDescription>
              </CardHeader>
              <CardContent>
                <ThresholdGauge risks={thresholdRisks} />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ─── §3 Partier ────────────────────────────────── */}
        <section id="partier">
          <h2 className="text-2xl font-bold mb-2">Partier</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Klik på et parti for at se detaljeret historik og seneste målinger. Trend viser udviklingen over de seneste 30 dage.
          </p>

          {/* Party overview table */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Partioversigt</CardTitle>
              <CardDescription>Alle partier med gennemsnit, mandater og trend</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Parti</th>
                      <th className="text-left py-2 font-medium hidden sm:table-cell">Navn</th>
                      <th className="text-right py-2 font-medium">Gns. %</th>
                      <th className="text-right py-2 font-medium">Mandater</th>
                      <th className="text-right py-2 font-medium">7 dage</th>
                      <th className="text-right py-2 font-medium">30 dage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAverages.map((avg) => {
                      if (!avg) return null;
                      const party = getParty(avg.partyLetter);
                      const seats = seatMap.get(avg.partyLetter) ?? 0;
                      return (
                        <tr key={avg.partyLetter} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2.5">
                            <Link href={`/partier/${avg.partyLetter}`} className="flex items-center gap-2 hover:underline">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: party.color }} />
                              <span className="font-bold">{avg.partyLetter}</span>
                            </Link>
                          </td>
                          <td className="py-2.5 text-muted-foreground hidden sm:table-cell">
                            <Link href={`/partier/${avg.partyLetter}`} className="hover:underline">
                              {party.name}
                            </Link>
                          </td>
                          <td className="text-right py-2.5 font-mono">{avg.mean.toFixed(1)} %</td>
                          <td className="text-right py-2.5 font-mono font-bold">{seats}</td>
                          {([
                            { trend: avg.trend7d, mag: avg.trendMagnitude7d },
                            { trend: avg.trend30d, mag: avg.trendMagnitude30d },
                          ] as const).map((t, i) => (
                            <td key={i} className="text-right py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                {t.trend === 'up' && (
                                  <>
                                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                                    <span className="text-xs text-green-600">+{t.mag.toFixed(1)}</span>
                                  </>
                                )}
                                {t.trend === 'down' && (
                                  <>
                                    <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                                    <span className="text-xs text-red-600">{t.mag.toFixed(1)}</span>
                                  </>
                                )}
                                {t.trend === 'stable' && (
                                  <span className="text-xs text-muted-foreground">
                                    {t.mag > 0 ? '+' : ''}{t.mag.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Party cards grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {PARTY_ORDER.map((letter) => {
              const party = PARTIES.find((p) => p.letter === letter)!;
              const avg = avgMap.get(letter);
              const seats = seatMap.get(letter) ?? 0;
              if (!avg || avg.mean < 0.5) return null;

              return (
                <Link key={letter} href={`/partier/${letter}`}>
                  <Card className="hover:shadow-md transition-all cursor-pointer h-full overflow-hidden">
                    <div className="h-1.5" style={{ backgroundColor: party.color }} />
                    <CardContent className="pt-3 px-3 sm:pt-4 sm:px-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: party.color }}
                        >
                          {party.letter}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm leading-tight">{party.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{party.leader}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-2xl font-bold">{avg.mean.toFixed(1)} %</span>
                        <span className="text-xs text-muted-foreground">{seats} mandater</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ─── §4 Meningsmålinger ────────────────────────── */}
        <section id="meningsmaalinger">
          <h2 className="text-2xl font-bold mb-2">Meningsmålinger</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Data indsamles fra fem analyseinstitutter. Nyere målinger vægtes højere i prognosen.
          </p>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Trend over tid</CardTitle>
              <CardDescription>
                Alle partiers opbakning baseret på meningsmålinger.
                Stiplet linje viser 2 %-spærregrænsen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PollTrendChart polls={polls} height={500} showThreshold />
            </CardContent>
          </Card>

          <PollsTableClient
            polls={sortedPolls}
            instituteNames={instituteNames}
            partyOrder={PARTY_ORDER}
          />
        </section>

        {/* ─── §5 Prognose ───────────────────────────────── */}
        <section id="prognose">
          <h2 className="text-2xl font-bold mb-2">Prognose</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {`Baseret på ${forecast.pollsUsed} meningsmålinger og ${forecast.simulationCount.toLocaleString('da-DK')} simuleringer. Intervallet viser den sandsynlige rækkevidde — ikke en præcis forudsigelse.`}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Mandatinterval per parti</CardTitle>
                <CardDescription>Median med 5.–95. percentil fra simuleringer</CardDescription>
              </CardHeader>
              <CardContent>
                <SeatRangeChart ranges={seatRanges} height={420} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blokfordeling</CardTitle>
                <CardDescription>Fordeling af mandater mellem blokkene</CardDescription>
              </CardHeader>
              <CardContent>
                <BlocDonutChart allocations={seatAllocations} height={350} />
              </CardContent>
            </Card>
          </div>

          {/* Detailed forecast table */}
          <Card>
            <CardHeader>
              <CardTitle>Detaljeret prognose</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Parti</th>
                      <th className="text-right py-2 whitespace-nowrap">Gns. %</th>
                      <th className="text-right py-2 whitespace-nowrap">
                        <span className="sm:hidden">Mand.</span>
                        <span className="hidden sm:inline">Mandater (median)</span>
                      </th>
                      <th className="text-right py-2 whitespace-nowrap hidden sm:table-cell">Interval (5–95 %)</th>
                      <th className="text-right py-2 whitespace-nowrap">
                        <span className="sm:hidden">Spærre</span>
                        <span className="hidden sm:inline">Klarer grænsen</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PARTY_ORDER.map((letter) => {
                      const avg = weightedAverages.find((a) => a.partyLetter === letter);
                      const range = seatRanges.find((r) => r.partyLetter === letter);
                      const party = PARTIES.find((p) => p.letter === letter);
                      if (!avg || avg.mean < 0.5) return null;
                      return (
                        <tr key={letter} className="border-b last:border-0">
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 shrink-0 rounded-full" style={{ backgroundColor: party?.color }} />
                              <span className="font-medium">{party?.letter}</span>
                              <span className="text-muted-foreground hidden sm:inline">{party?.name}</span>
                            </div>
                          </td>
                          <td className="text-right py-2 font-mono whitespace-nowrap">{avg.mean.toFixed(1)} %</td>
                          <td className="text-right py-2 font-mono">{range?.median ?? 0}</td>
                          <td className="text-right py-2 font-mono text-muted-foreground hidden sm:table-cell">
                            {range?.p5}–{range?.p95}
                          </td>
                          <td className="text-right py-2">
                            <Badge variant={
                              (range?.meetsThreshold ?? 0) > 0.95 ? 'default' :
                              (range?.meetsThreshold ?? 0) > 0.5 ? 'secondary' : 'destructive'
                            }>
                              {((range?.meetsThreshold ?? 0) * 100).toFixed(0)} %
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── §6 Koalitioner ────────────────────────────── */}
        <section id="koalitioner">
          <h2 className="text-2xl font-bold mb-2">Koalitionsbygger</h2>
          <p className="text-muted-foreground mb-6">
            Vælg partier og se, om de kan danne flertal
          </p>
          <KoalitionerSection polls={polls} />
        </section>

        {/* ─── §7 Historik ───────────────────────────────── */}
        <section id="historik">
          <h2 className="text-2xl font-bold mb-2">Historik</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Officielle resultater fra de seneste folketingsvalg. Brug til at sammenligne med den nuværende prognose.
          </p>

          <div className="space-y-6">
            {ELECTIONS.map((election) => (
              <Card key={election.year}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Folketingsvalget {election.year}</CardTitle>
                      <CardDescription>{election.date} · Valgdeltagelse: {election.turnout} %</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {election.primeMinister}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Regering: {election.government}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {election.results.map((r) => {
                      const party = PARTIES.find((p) => p.letter === r.letter);
                      return (
                        <div key={r.letter} className="p-3 rounded-lg bg-muted/50 text-center">
                          <div className="flex items-center justify-center gap-1.5 mb-1">
                            <span
                              className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                              style={{ backgroundColor: party?.color ?? '#888' }}
                            >
                              {r.letter}
                            </span>
                            <span className="text-xs font-medium">{party?.name ?? r.letter}</span>
                          </div>
                          <div className="text-lg font-bold">{r.pct} %</div>
                          <div className="text-xs text-muted-foreground">{r.seats} mandater</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ─── §8 Metodologi ─────────────────────────────── */}
        <section id="metodologi">
          <h2 className="text-2xl font-bold mb-6">Metodologi</h2>
          <p className="text-muted-foreground mb-6">
            Sådan fungerer vores valgprognosemodel
          </p>

          <div className="max-w-4xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Vægtet gennemsnit af meningsmålinger</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <p>
                  Modellen beregner et vægtet gennemsnit af alle tilgængelige meningsmålinger.
                  Hver måling vægtes ud fra to faktorer:
                </p>
                <ul>
                  <li>
                    <strong>Aktualitet:</strong> Nyere målinger vægtes højere end ældre.
                    Vi bruger en eksponentiel aftagende vægtfunktion med en halveringstid på 14 dage.
                  </li>
                  <li>
                    <strong>Instituttets kvalitet:</strong> Hvert analyseinstitut tildeles en
                    kvalitetsscore baseret på historisk præcision, metodik og stikprøvestørrelse.
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. House effects-korrektion</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <p>
                  Forskellige analyseinstitutter har systematiske afvigelser (&quot;house effects&quot;).
                  Vi estimerer disse ved at sammenligne institutterne med de faktiske
                  valgresultater fra 2019 og 2022.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Mandatberegning (d&apos;Hondt)</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <p>
                  Stemmeandelene konverteres til mandater via d&apos;Hondts metode — en
                  forenkling af det danske valgsystem. Partier under 2 % filtreres fra.
                  Denne tilgang giver typisk et resultat inden for 1–2 mandater af den fulde beregning.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4. Monte Carlo-simulering</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <p>
                  For at kvantificere usikkerheden kører vi <strong>10.000 simuleringer</strong>.
                  I hver simulering trækker vi tilfældige stemmeandele fra en normalfordeling
                  med korreleret blokstøj, normaliserer til 100 % og beregner mandater via d&apos;Hondt.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>5. Spærregrænseanalyse</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <p>
                  For partier tæt på 2 %-grænsen beregner vi, hvor stor en andel af simuleringerne
                  partiet klarer spærregrænsen. Risiko klassificeres som sikker (&gt;95 %), usikker (50–95 %) eller i fare (&lt;50 %).
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>6. Datakilder</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <p>Data stammer fra:</p>
                <ul>
                  <li><strong>Voxmeter</strong> for Ritzau — ugentlige målinger</li>
                  <li><strong>Epinion</strong> for DR — løbende, 5.000+ interviews</li>
                  <li><strong>Megafon</strong> for TV 2 / Politiken</li>
                  <li><strong>Verian</strong> for Berlingske</li>
                  <li><strong>YouGov</strong> for B.T. — online panel</li>
                </ul>
                <Separator className="my-4" />
                <p className="text-muted-foreground text-xs">
                  Modellen er inspireret af FiveThirtyEight og er et uafhængigt projekt
                  uden tilknytning til medierne eller analyseinstitutterne.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

      </div>
    </div>
  );
}
