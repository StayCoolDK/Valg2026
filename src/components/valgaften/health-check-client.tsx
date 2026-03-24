'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ServerCog } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ElectionNightData } from '@/lib/types/election-night';

type HealthState = {
  label: string;
  url: string;
  loading: boolean;
  ok: boolean;
  error: string | null;
  data: ElectionNightData | null;
};

const ENDPOINTS: Array<Pick<HealthState, 'label' | 'url'>> = [
  { label: 'Live 2026', url: '/api/valgaften' },
  { label: 'Demo 2022 (lokal)', url: '/api/valgaften?demo=true' },
  { label: 'Demo 2022 (DST)', url: '/api/valgaften?demo=dst' },
];

function buildInitialState(): HealthState[] {
  return ENDPOINTS.map((endpoint) => ({
    ...endpoint,
    loading: true,
    ok: false,
    error: null,
    data: null,
  }));
}

export function HealthCheckClient() {
  const [checks, setChecks] = useState<HealthState[]>(buildInitialState);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function runChecks() {
    setChecks((current) => current.map((check) => ({ ...check, loading: true, error: null })));

    const results = await Promise.all(
      ENDPOINTS.map(async (endpoint) => {
        try {
          const res = await fetch(endpoint.url, { cache: 'no-store' });
          if (!res.ok) {
            return {
              ...endpoint,
              loading: false,
              ok: false,
              error: `HTTP ${res.status}`,
              data: null,
            } satisfies HealthState;
          }

          const data: ElectionNightData = await res.json();
          return {
            ...endpoint,
            loading: false,
            ok: true,
            error: null,
            data,
          } satisfies HealthState;
        } catch (error) {
          return {
            ...endpoint,
            loading: false,
            ok: false,
            error: error instanceof Error ? error.message : 'Ukendt fejl',
            data: null,
          } satisfies HealthState;
        }
      })
    );

    setChecks(results);
    setLastRefresh(new Date());
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runChecks();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="text-xs">
          Intern driftskontrol
        </Badge>
        <button
          onClick={runChecks}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Kør check igen
        </button>
        {lastRefresh && (
          <p className="text-sm text-muted-foreground">
            Sidst kørt {lastRefresh.toLocaleTimeString('da-DK')}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {checks.map((check) => (
          <Card key={check.url}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ServerCog className="h-4 w-4" />
                    {check.label}
                  </CardTitle>
                  <CardDescription>{check.url}</CardDescription>
                </div>
                <Badge variant={check.ok ? 'secondary' : 'destructive'}>
                  {check.loading ? 'Checker...' : check.ok ? (check.data?.usingCachedFallback ? 'Fallback' : 'OK') : 'Fejl'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {check.error ? (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <p>{check.error}</p>
                </div>
              ) : check.data ? (
                <>
                  <div className="flex items-start gap-2 text-sm">
                    {check.data.hasPartialData ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    )}
                    <div className="space-y-1 text-muted-foreground">
                      <p>Status: <span className="text-foreground">{check.data.status}</span></p>
                      <p>DST-status: <span className="text-foreground">{check.data.sourceStatusText || 'Ingen'}</span></p>
                      <p>Senest opdateret hos DST: <span className="text-foreground">{new Date(check.data.lastUpdated).toLocaleString('da-DK')}</span></p>
                      <p>Rapporterede storkredse: <span className="text-foreground">{check.data.reportedConstituencies}/{check.data.totalConstituencies}</span></p>
                      <p>Warnings: <span className="text-foreground">{check.data.warnings.length}</span></p>
                      <p>Fallback: <span className="text-foreground">{check.data.usingCachedFallback ? 'Ja' : 'Nej'}</span></p>
                    </div>
                  </div>

                  {check.data.warnings.length > 0 && (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {check.data.warnings.map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  )}

                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                    {JSON.stringify(check.data, null, 2)}
                  </pre>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen data modtaget endnu.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
