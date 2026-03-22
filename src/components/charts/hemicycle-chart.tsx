'use client';

import { useState, useEffect } from 'react';
import { SeatAllocation, PartyLetter } from '@/lib/types';
import { PARTIES, PARTY_ORDER, TOTAL_SEATS, getPartyColor } from '@/lib/constants';

interface HemicycleChartProps {
  allocations: SeatAllocation[];
}

const VIEW_W = 600;
const VIEW_H = 340;
const CENTER_X = 300;
const CENTER_Y = 310;
const MIN_RADIUS = 100;
const MAX_RADIUS = 280;
const ROWS = 8;
const DOT_R = 8;

function generateHemicyclePositions(totalSeats: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  let seatsPlaced = 0;

  for (let row = 0; row < ROWS && seatsPlaced < totalSeats; row++) {
    const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * (row / (ROWS - 1));
    const circumference = Math.PI * radius;
    const seatsInRow = Math.min(
      Math.round(circumference / 22),
      totalSeats - seatsPlaced
    );

    for (let i = 0; i < seatsInRow && seatsPlaced < totalSeats; i++) {
      const angle = Math.PI - (Math.PI * (i + 0.5)) / seatsInRow;
      positions.push({
        x: CENTER_X + radius * Math.cos(angle),
        y: CENTER_Y - radius * Math.sin(angle),
      });
      seatsPlaced++;
    }
  }

  return positions;
}

export function HemicycleChart({ allocations }: HemicycleChartProps) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<{ name: string; letter: string; x: number; y: number } | null>(null);

  useEffect(() => setMounted(true), []);

  const positions = generateHemicyclePositions(TOTAL_SEATS);

  // Build seat-to-party mapping, ordered by bloc (left to right)
  const blocOrder: PartyLetter[] = [];
  for (const letter of PARTY_ORDER) {
    const party = PARTIES.find((p) => p.letter === letter);
    if (party?.bloc === 'red') blocOrder.push(letter);
  }
  for (const letter of PARTY_ORDER) {
    const party = PARTIES.find((p) => p.letter === letter);
    if (party?.bloc === 'unaligned') blocOrder.push(letter);
  }
  for (const letter of PARTY_ORDER) {
    const party = PARTIES.find((p) => p.letter === letter);
    if (party?.bloc === 'blue') blocOrder.push(letter);
  }

  const seatColors: { letter: PartyLetter; color: string; name: string }[] = [];
  for (const letter of blocOrder) {
    const alloc = allocations.find((a) => a.partyLetter === letter);
    const party = PARTIES.find((p) => p.letter === letter);
    if (alloc && party && alloc.seats > 0) {
      for (let i = 0; i < alloc.seats; i++) {
        seatColors.push({
          letter,
          color: party.color,
          name: party.name,
        });
      }
    }
  }

  while (seatColors.length < positions.length) {
    seatColors.push({ letter: 'A', color: '#e5e7eb', name: 'Ikke tildelt' });
  }

  if (!mounted) {
    return <div style={{ minHeight: 400 }} />;
  }

  // Tooltip positioning: keep within SVG bounds
  const tooltipWidth = 140;
  const tooltipHeight = 24;
  const tooltipX = hovered
    ? Math.max(tooltipWidth / 2, Math.min(VIEW_W - tooltipWidth / 2, hovered.x))
    : 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" style={{ minHeight: 350 }}>
        {positions.map((pos, i) => {
          const seat = seatColors[i];
          return (
            <circle
              key={i}
              cx={pos.x}
              cy={pos.y}
              r={DOT_R}
              fill={seat?.color ?? '#e5e7eb'}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
              className="cursor-pointer transition-opacity"
              opacity={hovered && hovered.name !== seat?.name ? 0.4 : 1}
              onMouseEnter={() => setHovered({ name: seat?.name ?? '', letter: seat?.letter ?? '', x: pos.x, y: pos.y })}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
        {hovered && (
          <g>
            <rect
              x={tooltipX - tooltipWidth / 2}
              y={hovered.y - 34}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={5}
              fill="rgba(0,0,0,0.85)"
            />
            <text
              x={tooltipX}
              y={hovered.y - 18}
              textAnchor="middle"
              fill="white"
              fontSize={13}
              fontWeight={500}
            >
              {hovered.letter} · {hovered.name}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
