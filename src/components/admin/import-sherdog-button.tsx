"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { triggerSherdogImport } from "@/app/admin/events/[id]/actions";

export function ImportSherdogButton({
  eventId,
  mode,
  label,
  disabled,
}: {
  eventId: string;
  mode: "card" | "results";
  label: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await triggerSherdogImport(eventId, mode);
      setMessage(
        result.error ?? "Spuštěno na GitHubu — za chvíli obnov stránku a zkontroluj kartu."
      );
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" disabled={disabled || pending} onClick={handleClick}>
        {pending ? "Spouštím…" : label}
      </Button>
      {message && <p className="text-sm text-neutral-500 dark:text-neutral-300">{message}</p>}
    </div>
  );
}
