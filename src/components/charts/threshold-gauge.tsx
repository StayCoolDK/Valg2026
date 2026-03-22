'use client';

import { ThresholdRisk } from '@/lib/types';
import { PARTIES, getPartyColor } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

interface ThresholdGaugeProps {
  risks: ThresholdRisk[];
}

export function ThresholdGauge({ risks }: ThresholdGaugeProps) {
  const relevantRisks = risks
    .filter((r) => r.riskLevel !== 'safe' || r.currentAverage < 5)
    .sort((a, b) => a.probabilityAboveThreshold - b.probabilityAboveThreshold);

  if (relevantRisks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen partier er i risiko for at falde under spærregrænsen.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {relevantRisks.map((risk) => {
        const party = PARTIES.find((p) => p.letter === risk.partyLetter);
        if (!party) return null;
        const pct = risk.probabilityAboveThreshold * 100;

        return (
          <div key={risk.partyLetter} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: party.color }}
                />
                <span className="text-sm font-medium">{party.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({risk.currentAverage.toFixed(1)}%)
                </span>
              </div>
              <Badge
                variant={
                  risk.riskLevel === 'safe'
                    ? 'default'
                    : risk.riskLevel === 'watch'
                    ? 'secondary'
                    : 'destructive'
                }
                className="text-xs"
              >
                {risk.riskLevel === 'safe'
                  ? 'Sikker'
                  : risk.riskLevel === 'watch'
                  ? 'Usikker'
                  : 'I fare'}
              </Badge>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor:
                    risk.riskLevel === 'safe'
                      ? '#22c55e'
                      : risk.riskLevel === 'watch'
                      ? '#eab308'
                      : '#ef4444',
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {pct.toFixed(0)}% sandsynlighed for at klare spærregrænsen
            </p>
          </div>
        );
      })}
    </div>
  );
}
