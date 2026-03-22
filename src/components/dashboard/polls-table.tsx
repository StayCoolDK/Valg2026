'use client';

import { useState, useMemo } from 'react';
import { Poll, PartyLetter } from '@/lib/types';
import { PARTY_ORDER, getPartyColor, INSTITUTES } from '@/lib/constants';

interface PollsTableProps {
  polls: Poll[];
}

export function PollsTable({ polls }: PollsTableProps) {
  const [filterInstitute, setFilterInstitute] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | PartyLetter>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let result = [...polls];
    if (filterInstitute !== 'all') {
      result = result.filter((p) => p.institute === filterInstitute);
    }
    result.sort((a, b) => {
      if (sortField === 'date') {
        return sortAsc
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      }
      const aVal = a.results[sortField] ?? 0;
      const bVal = b.results[sortField] ?? 0;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [polls, filterInstitute, sortField, sortAsc]);

  const handleSort = (field: 'date' | PartyLetter) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const institutes = Array.from(new Set(polls.map((p) => p.institute)));

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterInstitute('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            filterInstitute === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Alle
        </button>
        {institutes.map((inst) => (
          <button
            key={inst}
            onClick={() => setFilterInstitute(inst)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterInstitute === inst
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {inst}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th
                className="text-left py-2 cursor-pointer hover:text-primary"
                onClick={() => handleSort('date')}
              >
                Dato {sortField === 'date' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th className="text-left py-2">Institut</th>
              {PARTY_ORDER.map((letter) => (
                <th
                  key={letter}
                  className="text-right py-2 px-1 cursor-pointer hover:text-primary"
                  onClick={() => handleSort(letter)}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-0.5"
                    style={{ backgroundColor: getPartyColor(letter) }}
                  />
                  {letter}
                  {sortField === letter ? (sortAsc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((poll) => (
              <tr key={poll.id} className="border-b last:border-0 hover:bg-muted/50">
                <td className="py-1.5">
                  {new Date(poll.date).toLocaleDateString('da-DK', {
                    day: 'numeric',
                    month: 'short',
                    year: '2-digit',
                  })}
                </td>
                <td className="py-1.5">{poll.institute}</td>
                {PARTY_ORDER.map((letter) => (
                  <td key={letter} className="text-right py-1.5 px-1 font-mono">
                    {poll.results[letter] != null
                      ? poll.results[letter]!.toFixed(1)
                      : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Viser {filtered.length} af {polls.length} målinger
      </p>
    </div>
  );
}
