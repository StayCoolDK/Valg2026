'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPartyColor } from '@/lib/constants';
import type { Poll, PartyLetter } from '@/lib/types';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

interface PollsTableClientProps {
  polls: Poll[];
  instituteNames: string[];
  partyOrder: PartyLetter[];
}

type SortKey = 'date' | PartyLetter;
type SortDir = 'asc' | 'desc';

export function PollsTableClient({ polls, instituteNames, partyOrder }: PollsTableClientProps) {
  const [selectedInstitute, setSelectedInstitute] = useState('alle');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState(false);
  const INITIAL_COUNT = 10;

  const filteredPolls = useMemo(() => {
    let filtered = polls;
    if (selectedInstitute !== 'alle') {
      filtered = polls.filter((p) => p.institute === selectedInstitute);
    }
    return [...filtered].sort((a, b) => {
      let cmp: number;
      if (sortKey === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        cmp = (a.results[sortKey] ?? 0) - (b.results[sortKey] ?? 0);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [polls, selectedInstitute, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alle meningsmålinger</CardTitle>
        <CardDescription>
          {filteredPolls.length} målinger · Klik på kolonneoverskrift for at sortere
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedInstitute} onValueChange={setSelectedInstitute}>
          <TabsList className="flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="alle" className="text-xs">Alle</TabsTrigger>
            {instituteNames.map((name) => (
              <TabsTrigger key={name} value={name} className="text-xs">
                {name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th
                  className="text-left py-2 font-medium cursor-pointer hover:text-foreground text-muted-foreground select-none"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Dato
                    {sortKey === 'date' && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </th>
                <th className="text-left py-2 font-medium text-muted-foreground">Institut</th>
                {partyOrder.map((letter) => (
                  <th
                    key={letter}
                    className="text-center py-2 px-1 font-medium cursor-pointer hover:text-foreground text-muted-foreground select-none"
                    onClick={() => handleSort(letter)}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getPartyColor(letter) }}
                      />
                      <span className="flex items-center gap-0.5">
                        {letter}
                        {sortKey === letter && <ArrowUpDown className="h-2.5 w-2.5" />}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(expanded ? filteredPolls : filteredPolls.slice(0, INITIAL_COUNT)).map((poll) => (
                <tr key={poll.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2 whitespace-nowrap">
                    {new Date(poll.date).toLocaleDateString('da-DK', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-2">
                    <Badge variant="secondary" className="font-normal text-xs">
                      {poll.institute}
                    </Badge>
                  </td>
                  {partyOrder.map((letter) => (
                    <td key={letter} className="text-center py-2 px-1 font-mono">
                      {poll.results[letter] != null
                        ? poll.results[letter]!.toFixed(1)
                        : <span className="text-muted-foreground">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

            {filteredPolls.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={partyOrder.length + 2} className="text-center py-8 text-muted-foreground">
                    Ingen målinger fundet for det valgte institut.
                  </td>
                </tr>
              </tbody>
            )}
          </table>

          {filteredPolls.length > INITIAL_COUNT && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full mt-3 py-2 text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
            >
              {expanded ? (
                <>Vis færre <ChevronUp className="h-4 w-4" /></>
              ) : (
                <>Vis alle {filteredPolls.length} målinger <ChevronDown className="h-4 w-4" /></>
              )}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
