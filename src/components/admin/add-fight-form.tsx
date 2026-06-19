"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const WEIGHT_CLASSES = [
  "Strawweight",
  "Flyweight",
  "Bantamweight",
  "Featherweight",
  "Lightweight",
  "Welterweight",
  "Middleweight",
  "Light Heavyweight",
  "Heavyweight",
];

export function AddFightForm({
  eventId,
  fighters,
  nextCardOrder,
}: {
  eventId: string;
  fighters: { id: string; name: string }[];
  nextCardOrder: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [fighterAName, setFighterAName] = useState("");
  const [fighterBName, setFighterBName] = useState("");
  const [weightClass, setWeightClass] = useState(WEIGHT_CLASSES[4]);
  const [rounds, setRounds] = useState("3");
  const [isTitleFight, setIsTitleFight] = useState(false);
  const [isMainEvent, setIsMainEvent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolveFighterId(name: string): Promise<string | null> {
    const existing = fighters.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("fighters")
      .insert({ name: name.trim() })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fighterAName.trim() || !fighterBName.trim()) return;

    setSaving(true);
    setError(null);

    const [fighterAId, fighterBId] = await Promise.all([
      resolveFighterId(fighterAName),
      resolveFighterId(fighterBName),
    ]);

    if (!fighterAId || !fighterBId) {
      setSaving(false);
      setError("Nepodařilo se najít/vytvořit zápasníky.");
      return;
    }

    const { error } = await supabase.from("fights").insert({
      event_id: eventId,
      fighter_a_id: fighterAId,
      fighter_b_id: fighterBId,
      weight_class: weightClass,
      rounds: Number(rounds),
      is_title_fight: isTitleFight,
      is_main_event: isMainEvent,
      card_order: nextCardOrder,
      status: "scheduled",
    });

    setSaving(false);
    if (error) {
      setError("Vytvoření zápasu se nepodařilo.");
      return;
    }
    setFighterAName("");
    setFighterBName("");
    setIsTitleFight(false);
    setIsMainEvent(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
      <p className="text-sm font-semibold">Přidat zápas</p>
      <datalist id="fighter-names">
        {fighters.map((f) => (
          <option key={f.id} value={f.name} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fighter_a">Zápasník A</Label>
          <Input
            id="fighter_a"
            list="fighter-names"
            value={fighterAName}
            onChange={(e) => setFighterAName(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fighter_b">Zápasník B</Label>
          <Input
            id="fighter_b"
            list="fighter-names"
            value={fighterBName}
            onChange={(e) => setFighterBName(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weight_class">Váhová kategorie</Label>
          <select
            id="weight_class"
            value={weightClass}
            onChange={(e) => setWeightClass(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-sm"
          >
            {WEIGHT_CLASSES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rounds">Počet kol</Label>
          <Input
            id="rounds"
            type="number"
            min={1}
            max={5}
            value={rounds}
            onChange={(e) => setRounds(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isTitleFight} onChange={(e) => setIsTitleFight(e.target.checked)} />
          Titulový zápas
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isMainEvent} onChange={(e) => setIsMainEvent(e.target.checked)} />
          Main event
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="accent" disabled={saving} className="self-start">
        {saving ? "Vytvářím…" : "Přidat zápas"}
      </Button>
    </form>
  );
}
