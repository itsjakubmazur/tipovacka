"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pragueLocalToUtcIso } from "@/lib/time";

export function AddEventForm() {
  const router = useRouter();
  const supabase = createClient();

  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [sherdogUrl, setSherdogUrl] = useState("");
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
      sherdog_event_url: sherdogUrl || null,
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
    setSherdogUrl("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
      <p className="text-sm font-semibold">Nový galavečer</p>
      <div className="grid grid-cols-2 gap-3">
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
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="sherdog_url">Odkaz na Sherdog</Label>
          <Input
            id="sherdog_url"
            placeholder="https://www.sherdog.com/events/..."
            value={sherdogUrl}
            onChange={(e) => setSherdogUrl(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="accent" disabled={saving} className="self-start">
        {saving ? "Vytvářím…" : "Vytvořit galavečer"}
      </Button>
    </form>
  );
}
