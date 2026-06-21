"use client";

import { useEffect, useState } from "react";

function splitRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function DigitalCountdown({ lockAt }: { lockAt: string }) {
  const target = new Date(lockAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining <= 0) return null;

  const { hours, minutes, seconds } = splitRemaining(remaining);

  return (
    <div className="rounded-xl border border-white/10 bg-black/75 px-4 py-3 text-white shadow-lg shadow-black/20 backdrop-blur-lg">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-neutral-400">
        Zbývající čas
      </p>
      <div className="mt-2 flex items-center justify-center gap-3">
        {[
          { value: hours, label: "Hodin" },
          { value: minutes, label: "Minut" },
          { value: seconds, label: "Vteřin" },
        ].map((unit, i) => (
          <div key={unit.label} className="flex items-center gap-3">
            {i > 0 && <span className="text-3xl font-bold tabular-nums text-neutral-500">:</span>}
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold tabular-nums">{pad(unit.value)}</span>
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                {unit.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
