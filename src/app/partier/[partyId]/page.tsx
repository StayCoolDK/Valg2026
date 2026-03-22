import { getPolls } from '@/lib/data';
import { runForecast } from '@/lib/forecast/forecast-engine';
import { PARTIES, PARTY_ORDER, BLOC_NAMES } from '@/lib/constants';
import { PartyLetter } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PollTrendChart } from '@/components/charts/poll-trend-chart';
import { TrendingUp, TrendingDown, Minus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export function generateStaticParams() {
  return PARTY_ORDER.map((letter) => ({
    partyId: letter,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partyId: string }>;
}): Promise<Metadata> {
  const { partyId } = await params;
  const party = PARTIES.find((p) => p.letter === decodeURIComponent(partyId));
  return {
    title: party?.name ?? partyId,
  };
}

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ partyId: string }>;
}) {
  const { partyId } = await params;
  const party = PARTIES.find((p) => p.letter === decodeURIComponent(partyId));
  if (!party) notFound();

  const polls = await getPolls();
  const forecast = runForecast(polls);
  const avg = forecast.weightedAverages.find((a) => a.partyLetter === party.letter);
  const seats = forecast.seatAllocations.find((a) => a.partyLetter === party.letter)?.seats ?? 0;
  const range = forecast.seatRanges.find((r) => r.partyLetter === party.letter);
  const threshold = forecast.thresholdRisks.find((t) => t.partyLetter === party.letter);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Link href="/#partier" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tilbage til partier
      </Link>

      {/* Party header */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
          style={{ backgroundColor: party.color }}
        >
          {party.letter}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{party.name}</h1>
          <p className="text-muted-foreground">
            {party.leader} &middot; <Badge variant="outline">{BLOC_NAMES[party.bloc]}</Badge>
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{avg?.mean.toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">Vægtet gennemsnit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{seats}</div>
            <p className="text-sm text-muted-foreground">Mandater (estimat)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{range?.p5}–{range?.p95}</div>
            <p className="text-sm text-muted-foreground">Mandatinterval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-2">
              {avg?.trend === 'up' && <TrendingUp className="h-6 w-6 text-green-500" />}
              {avg?.trend === 'down' && <TrendingDown className="h-6 w-6 text-red-500" />}
              {avg?.trend === 'stable' && <Minus className="h-6 w-6 text-muted-foreground" />}
              <span className={`text-3xl font-bold ${avg?.trend === 'up' ? 'text-green-500' : avg?.trend === 'down' ? 'text-red-500' : ''}`}>
                {(avg?.trendMagnitude ?? 0) > 0 ? '+' : ''}{avg?.trendMagnitude.toFixed(1)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">7-dages trend</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>Meningsmålinger for {party.name}</CardTitle>
          <CardDescription>Udvikling over tid</CardDescription>
        </CardHeader>
        <CardContent>
          <PollTrendChart
            polls={polls}
            height={400}
            selectedParties={[party.letter as PartyLetter]}
            showThreshold={avg ? avg.mean < 5 : false}
          />
        </CardContent>
      </Card>

      {/* Comparison with 2022 */}
      <Card>
        <CardHeader>
          <CardTitle>Sammenlignet med valget 2022</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Valg 2022</div>
              <div className="text-2xl font-bold">{party.lastElectionPct}%</div>
              <div className="text-sm text-muted-foreground">{party.lastElectionSeats} mandater</div>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: party.color + '15' }}>
              <div className="text-sm text-muted-foreground mb-1">Nuværende prognose</div>
              <div className="text-2xl font-bold">{avg?.mean.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">{seats} mandater</div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <span className={`text-lg font-bold ${(avg?.mean ?? 0) > party.lastElectionPct ? 'text-green-600' : 'text-red-600'}`}>
              {(avg?.mean ?? 0) > party.lastElectionPct ? '+' : ''}
              {((avg?.mean ?? 0) - party.lastElectionPct).toFixed(1)} procentpoint
            </span>
            <span className="text-sm text-muted-foreground ml-2">
              ift. valget 2022
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
