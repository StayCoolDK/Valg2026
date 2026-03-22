'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { SeatAllocation, PartyLetter } from '@/lib/types';
import { PARTIES, MAJORITY_SEATS, getPartyColor, PARTY_ORDER } from '@/lib/constants';

interface SeatBarChartProps {
  allocations: SeatAllocation[];
  height?: number;
  horizontal?: boolean;
}

export function SeatBarChart({
  allocations,
  height = 350,
  horizontal = true,
}: SeatBarChartProps) {
  const data = PARTY_ORDER
    .map((letter) => {
      const alloc = allocations.find((a) => a.partyLetter === letter);
      const party = PARTIES.find((p) => p.letter === letter);
      return {
        letter,
        name: party?.name ?? letter,
        seats: alloc?.seats ?? 0,
        color: getPartyColor(letter),
      };
    })
    .filter((d) => d.seats > 0)
    .sort((a, b) => b.seats - a.seats);

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 15, fontWeight: 600, fill: 'var(--foreground)' }}
            width={180}
            interval={0}
          />
          <Tooltip
            formatter={(value: number) => [`${value} mandater`]}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
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

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
        <Tooltip
          formatter={(value: number) => [`${value} mandater`]}
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--card-foreground)',
          }}
          labelStyle={{ color: 'var(--card-foreground)' }}
          itemStyle={{ color: 'var(--card-foreground)' }}
        />
        <Bar dataKey="seats" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.letter} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
