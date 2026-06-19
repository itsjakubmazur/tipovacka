"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export function LockCountdown({ lockAt }: { lockAt: string }) {
  const target = new Date(lockAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => setRemaining(target - Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining <= 0) return null;

  return (
    <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
      Uzávěrka tipů za {formatRemaining(remaining)}
    </p>
  );
}
