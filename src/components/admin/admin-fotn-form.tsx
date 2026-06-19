"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type FightOption = { id: string; fighter_a: { name: string }; fighter_b: { name: string } };

export function AdminFotnForm({
  eventId,
  fights,
  initialFightId,
}: {
  eventId: string;
  fights: FightOption[];
  initialFightId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [fightId, setFightId] = useState(initialFightId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("events")
      .update({ actual_fotn_fight_id: fightId || null })
      .eq("id", eventId);

    if (updateError) {
      setSaving(false);
      setError("Uložení se nepodařilo.");
      return;
    }

    const { error: recalcError } = await supabase.rpc("recalculate_bonus_points", {
      p_event_id: eventId,
    });
    setSaving(false);
    if (recalcError) {
      setError("Výsledek uložen, ale přepočet bodů se nepodařil.");
      return;
    }
    router.refresh();
  }

  if (fights.length === 0) return null;

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase text-neutral-500">
          Fight of the Night
        </label>
        <select
          value={fightId}
          onChange={(e) => setFightId(e.target.value)}
          className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
        >
          <option value="">—</option>
          {fights.map((fight) => (
            <option key={fight.id} value={fight.id}>
              {fight.fighter_a.name} vs {fight.fighter_b.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" variant="accent" disabled={saving}>
        {saving ? "Ukládám…" : "Uložit FOTN"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
