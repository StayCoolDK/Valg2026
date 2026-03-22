'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ErrorBar,
} from 'recharts';
import { SeatRange } from '@/lib/types';
import { PARTIES, PARTY_ORDER, getPartyColor } from '@/lib/constants';

interface SeatRangeChartProps {
  ranges: SeatRange[];
  height?: number;
}

interface ChartEntry {
  letter: string;
  name: string;
  median: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  low: number;
  high: number;
  color: string;
}

export function SeatRangeChart({ ranges, height = 400 }: SeatRangeChartProps) {
  const data: ChartEntry[] = PARTY_ORDER
    .reduce<ChartEntry[]>((acc, letter) => {
      const range = ranges.find((r) => r.partyLetter === letter);
      const party = PARTIES.find((p) => p.letter === letter);
      if (range && range.median > 0) {
        acc.push({
          letter,
          name: party?.name ?? letter,
          median: range.median,
          p5: range.p5,
          p25: range.p25,
          p75: range.p75,
          p95: range.p95,
          low: range.median - range.p5,
          high: range.p95 - range.median,
          color: getPartyColor(letter),
        });
      }
      return acc;
    }, [])
    .sort((a, b) => b.median - a.median);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fontWeight: 500, fill: 'var(--muted-foreground)' }}
          width={130}
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
        <Bar dataKey="median" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell key={entry.letter} fill={entry.color} />
          ))}
          <ErrorBar dataKey="high" direction="x" stroke="#666" width={4} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
