"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pragueLocalToUtcIso, utcIsoToPragueLocalInput } from "@/lib/time";

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Chystá se" },
  { value: "locked", label: "Uzamčeno" },
  { value: "completed", label: "Vyhodnoceno" },
];

export function EventSettingsForm({
  eventId,
  initialLockAt,
  initialAutoLock,
  initialStatus,
}: {
  eventId: string;
  initialLockAt: string | null;
  initialAutoLock: boolean;
  initialStatus: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [lockAt, setLockAt] = useState(
    initialLockAt ? utcIsoToPragueLocalInput(initialLockAt) : ""
  );
  const [autoLock, setAutoLock] = useState(initialAutoLock);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("events")
      .update({
        lock_at: lockAt ? pragueLocalToUtcIso(lockAt) : null,
        auto_lock: autoLock,
        status,
      })
      .eq("id", eventId);

    setSaving(false);
    if (error) {
      setError("Uložení se nepodařilo.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
      <p className="text-sm font-semibold">Nastavení galavečera</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lock_at">Uzamčení tipů (český čas)</Label>
          <Input
            id="lock_at"
            type="datetime-local"
            value={lockAt}
            onChange={(e) => setLockAt(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Stav</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoLock}
          onChange={(e) => setAutoLock(e.target.checked)}
        />
        Automaticky uzamknout v čase výše
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="accent" disabled={saving} className="self-start">
        {saving ? "Ukládám…" : "Uložit"}
      </Button>
    </form>
  );
}
