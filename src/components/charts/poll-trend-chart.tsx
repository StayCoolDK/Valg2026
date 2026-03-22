'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { Poll, PartyLetter } from '@/lib/types';
import { PARTIES, PARTY_ORDER, THRESHOLD_PCT, getPartyColor } from '@/lib/constants';
import { useMemo, useState } from 'react';

interface PollTrendChartProps {
  polls: Poll[];
  height?: number;
  showThreshold?: boolean;
  selectedParties?: PartyLetter[];
}

export function PollTrendChart({
  polls,
  height = 400,
  showThreshold = true,
  selectedParties,
}: PollTrendChartProps) {
  const [hiddenParties, setHiddenParties] = useState<Set<PartyLetter>>(new Set());

  const data = useMemo(() => {
    const sorted = [...polls].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return sorted.map((poll) => ({
      date: poll.date,
      institute: poll.institute,
      ...poll.results,
    }));
  }, [polls]);

  const visibleParties = useMemo(() => {
    const parties = selectedParties ?? PARTY_ORDER;
    return parties.filter((p) => !hiddenParties.has(p));
  }, [selectedParties, hiddenParties]);

  const toggleParty = (letter: PartyLetter) => {
    setHiddenParties((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) {
        next.delete(letter);
      } else {
        next.add(letter);
      }
      return next;
    });
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const partiesToShow = selectedParties ?? PARTY_ORDER;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 'auto']}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickFormatter={(v: number) => `${v}%`}
            width={45}
          />
          <Tooltip
            labelFormatter={(label: string) => {
              const d = new Date(label);
              return d.toLocaleDateString('da-DK', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
            }}
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)}%`,
              PARTIES.find((p) => p.letter === name)?.name ?? name,
            ]}
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
          {showThreshold && (
            <ReferenceLine
              y={THRESHOLD_PCT}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{
                value: 'Spærregrænse (2%)',
                position: 'right',
                fontSize: 10,
                fill: '#ef4444',
              }}
            />
          )}
          {partiesToShow.map((letter) => (
            <Line
              key={letter}
              type="monotone"
              dataKey={letter}
              stroke={getPartyColor(letter)}
              strokeWidth={visibleParties.includes(letter) ? 2 : 0}
              dot={false}
              connectNulls
              hide={hiddenParties.has(letter)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {partiesToShow.map((letter) => {
          const party = PARTIES.find((p) => p.letter === letter);
          if (!party) return null;
          const isHidden = hiddenParties.has(letter);
          return (
            <button
              key={letter}
              onClick={() => toggleParty(letter)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-opacity ${
                isHidden ? 'opacity-30' : 'opacity-100'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: party.color }}
              />
              {party.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
