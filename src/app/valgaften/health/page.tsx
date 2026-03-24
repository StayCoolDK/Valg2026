import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Activity } from 'lucide-react';
import { HealthCheckClient } from '@/components/valgaften/health-check-client';

export const metadata: Metadata = {
  title: 'Valgaften — Driftsstatus',
  description: 'Intern driftsstatus for valgaften-feed og fallback-adfærd.',
};

export default function ValgaftenHealthPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="space-y-3">
        <Link href="/valgaften" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Tilbage til valgaften
        </Link>
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Activity className="h-7 w-7 text-primary" />
            Valgaften driftsstatus
          </h1>
          <p className="text-muted-foreground">
            Brug denne side til hurtigt at kontrollere live-feed, demo-feed, snapshot-fallback og advarsler før og under valgaftenen.
          </p>
        </div>
      </div>

      <HealthCheckClient />
    </div>
  );
}
