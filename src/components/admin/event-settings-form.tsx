"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pragueLocalToUtcIso, utcIsoToPragueLocalInput } from "@/lib/time";

const STATUS_OPTIONS = [
  { value: "draft", label: "Návrh (skryté tipérům)" },
  { value: "upcoming", label: "Chystá se / probíhá" },
  { value: "completed", label: "Vyhodnoceno" },
];

function effectiveStatusLabel(status: string, lockAt: string): string {
  if (status === "draft") return "Návrh (skryté tipérům)";
  if (status === "completed") return "Vyhodnoceno";
  const locked = lockAt ? new Date(lockAt) <= new Date() : false;
  return locked ? "Uzamčeno" : "Chystá se";
}

export function EventSettingsForm({
  eventId,
  initialName,
  initialLocation,
  initialLockAt,
  initialAutoLock,
  initialStatus,
}: {
  eventId: string;
  initialName: string;
  initialLocation: string | null;
  initialLockAt: string | null;
  initialAutoLock: boolean;
  initialStatus: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(initialName);
  const [location, setLocation] = useState(initialLocation ?? "");
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
        name,
        location: location || null,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg shadow-black/20 dark:border-neutral-700 dark:bg-neutral-800 dark:shadow-black/60">
      <p className="text-sm font-semibold">Nastavení galavečera</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Název</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Místo</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
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
            className="h-10 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-300">
        Aktuální stav pro tipéry: <strong>{effectiveStatusLabel(status, lockAt)}</strong>
        {status !== "draft" && status !== "completed" && " (řídí se časem uzamčení tipů výše, ne polem Stav)"}
      </p>
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
