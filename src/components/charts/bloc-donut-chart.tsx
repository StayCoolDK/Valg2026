'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SeatAllocation } from '@/lib/types';
import { PARTIES, BLOC_COLORS, BLOC_NAMES, MAJORITY_SEATS } from '@/lib/constants';

interface BlocDonutChartProps {
  allocations: SeatAllocation[];
  height?: number;
}

export function BlocDonutChart({ allocations, height = 300 }: BlocDonutChartProps) {
  const blocSeats = { red: 0, blue: 0, unaligned: 0 };

  for (const alloc of allocations) {
    const party = PARTIES.find((p) => p.letter === alloc.partyLetter);
    if (party) {
      blocSeats[party.bloc] += alloc.seats;
    }
  }

  const data = [
    { name: BLOC_NAMES.red, value: blocSeats.red, color: BLOC_COLORS.red },
    { name: BLOC_NAMES.unaligned, value: blocSeats.unaligned, color: BLOC_COLORS.unaligned },
    { name: BLOC_NAMES.blue, value: blocSeats.blue, color: BLOC_COLORS.blue },
  ];

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            startAngle={180}
            endAngle={-180}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} mandater`, name]}
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
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold">{total}</span>
        <span className="text-xs text-muted-foreground">mandater</span>
        <span className="text-[10px] text-muted-foreground">({MAJORITY_SEATS} for flertal)</span>
      </div>
      <div className="flex justify-center gap-6 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="font-medium">{d.value}</span>
            <span className="text-muted-foreground">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
