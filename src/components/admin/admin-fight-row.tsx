"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { Method } from "@/lib/types";

const METHOD_OPTIONS: { value: Method; label: string }[] = [
  { value: "KO/TKO", label: "KO/TKO" },
  { value: "SUBMISSION", label: "Submise" },
  { value: "DECISION", label: "Rozhodnutí" },
];

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Naplánováno" },
  { value: "completed", label: "Odehráno" },
  { value: "cancelled", label: "Zrušeno" },
  { value: "no_contest", label: "No Contest" },
];

type FightRowData = {
  id: string;
  card_order: number;
  fighter_a: { id: string; name: string };
  fighter_b: { id: string; name: string };
  rounds: number;
  status: string;
  winner_fighter_id: string | null;
  method: Method | null;
  result_round: number | null;
};

export function AdminFightRow({
  fight,
  eventId,
  neighborUp,
  neighborDown,
}: {
  fight: FightRowData;
  eventId: string;
  neighborUp: { id: string; card_order: number } | null;
  neighborDown: { id: string; card_order: number } | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState(fight.status);
  const [winnerId, setWinnerId] = useState(fight.winner_fighter_id ?? "");
  const [method, setMethod] = useState<Method | "">(fight.method ?? "");
  const [round, setRound] = useState(fight.result_round?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(neighbor: { id: string; card_order: number } | null) {
    if (!neighbor) return;
    setSaving(true);
    await Promise.all([
      supabase.from("fights").update({ card_order: neighbor.card_order }).eq("id", fight.id),
      supabase.from("fights").update({ card_order: fight.card_order }).eq("id", neighbor.id),
    ]);
    setSaving(false);
    router.refresh();
  }

  async function saveResult(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const isDecision = method === "DECISION";
    const { error: updateError } = await supabase
      .from("fights")
      .update({
        status,
        winner_fighter_id: status === "completed" ? winnerId || null : null,
        method: status === "completed" ? method || null : null,
        result_round: status === "completed" && !isDecision && round ? Number(round) : null,
      })
      .eq("id", fight.id);

    if (updateError) {
      setSaving(false);
      setError("Uložení se nepodařilo.");
      return;
    }

    const { error: recalcError } = await supabase.rpc("recalculate_event_points", {
      p_event_id: eventId,
    });
    setSaving(false);
    if (recalcError) {
      setError("Výsledek uložen, ale přepočet bodů se nepodařil.");
      return;
    }
    router.refresh();
  }

  async function deleteFight() {
    if (!window.confirm(`Smazat zápas ${fight.fighter_a.name} vs ${fight.fighter_b.name}?`)) return;
    setSaving(true);
    const { error } = await supabase.from("fights").delete().eq("id", fight.id);
    setSaving(false);
    if (error) {
      setError("Smazání se nepodařilo.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <div className="flex items-center justify-between">
        <p className="font-semibold">
          {fight.fighter_a.name} vs {fight.fighter_b.name}
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="outline" disabled={!neighborUp || saving} onClick={() => move(neighborUp)}>
            ↑
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!neighborDown || saving} onClick={() => move(neighborDown)}>
            ↓
          </Button>
          <Button type="button" size="sm" variant="destructive" disabled={saving} onClick={deleteFight}>
            Smazat
          </Button>
        </div>
      </div>

      <form onSubmit={saveResult} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-300">Stav</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {status === "completed" && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-300">Vítěz</label>
              <select
                value={winnerId}
                onChange={(e) => setWinnerId(e.target.value)}
                className="h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
              >
                <option value="">—</option>
                <option value={fight.fighter_a.id}>{fight.fighter_a.name}</option>
                <option value={fight.fighter_b.id}>{fight.fighter_b.name}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-300">Způsob</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as Method)}
                className="h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
              >
                <option value="">—</option>
                {METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {method !== "DECISION" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-300">Kolo</label>
                <select
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  className="h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                >
                  <option value="">—</option>
                  {Array.from({ length: fight.rounds }, (_, i) => i + 1).map((r) => (
                    <option key={r} value={r}>
                      {r}.
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <Button type="submit" size="sm" variant="accent" disabled={saving}>
          {saving ? "Ukládám…" : "Uložit výsledek"}
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
