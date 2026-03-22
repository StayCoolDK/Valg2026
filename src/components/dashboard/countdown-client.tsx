'use client';

import { useEffect, useState } from 'react';

interface CountdownClientProps {
  electionDate: string;
}

export function CountdownClient({ electionDate }: CountdownClientProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    passed: boolean;
  } | null>(null);

  useEffect(() => {
    function calc() {
      const now = Date.now();
      const target = new Date(electionDate + 'T08:00:00+01:00').getTime();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, passed: true });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        passed: false,
      });
    }
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [electionDate]);

  if (!timeLeft) return null;

  if (timeLeft.passed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium">
          Valgstederne er åbne — god valgdag!
        </div>
        <p className="text-xs text-white/50">Valgstederne lukker kl. 20:00</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex items-center gap-4 px-6 py-3 rounded-xl bg-muted">
        <div className="text-center">
          <div className="text-2xl font-bold">{timeLeft.days}</div>
          <div className="text-xs text-muted-foreground">dage</div>
        </div>
        <div className="text-muted-foreground">:</div>
        <div className="text-center">
          <div className="text-2xl font-bold">{timeLeft.hours}</div>
          <div className="text-xs text-muted-foreground">timer</div>
        </div>
        <div className="text-muted-foreground">:</div>
        <div className="text-center">
          <div className="text-2xl font-bold">{timeLeft.minutes}</div>
          <div className="text-xs text-muted-foreground">min</div>
        </div>
      </div>
      <p className="text-xs text-white/50">Til valgstederne åbner kl. 8:00</p>
    </div>
  );
}
