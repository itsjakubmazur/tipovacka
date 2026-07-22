"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pragueLocalToUtcIso } from "@/lib/time";

export function AddEventForm() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const utcDate = pragueLocalToUtcIso(eventDate);
    const { error } = await supabase.from("events").insert({
      number: number ? Number(number) : null,
      name: name || (number ? `OKTAGON ${number}` : "Galavečer"),
      event_date: utcDate,
      lock_at: utcDate,
      location: location || null,
    });

    setSaving(false);
    if (error) {
      setError("Vytvoření se nepodařilo.");
      return;
    }
    setNumber("");
    setName("");
    setEventDate("");
    setLocation("");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-sm font-semibold"
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        Nový galavečer
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="number">Číslo OKTAGONu</Label>
              <Input id="number" type="number" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Název (pokud bez čísla)</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event_date">Datum a čas (český čas)</Label>
              <Input
                id="event_date"
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Místo</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" variant="accent" disabled={saving} className="self-start">
            {saving ? "Vytvářím…" : "Vytvořit galavečer"}
          </Button>
        </form>
      )}
    </div>
  );
}
