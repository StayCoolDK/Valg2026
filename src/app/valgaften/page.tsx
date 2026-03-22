import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { LiveResults } from '@/components/valgaften/live-results';
import { Radio } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Valgaften — Live resultater',
  description: 'Følg folketingsvalget live med resultater direkte fra Danmarks Statistik.',
};

export default function ValgaftenPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Radio className="h-7 w-7 text-red-500" />
            Valgaften
          </h1>
          <p className="text-muted-foreground">
            Live resultater fra folketingsvalget — data fra Danmarks Statistik
          </p>
        </div>
        <Badge variant="outline" className="self-start text-xs">
          dst.dk/valg
        </Badge>
      </div>

      <LiveResults />
    </div>
  );
}
