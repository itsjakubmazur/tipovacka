"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinGroupForm() {
  const router = useRouter();
  const supabase = createClient();

  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setSaving(true);
    setError(null);
    const { data, error } = await supabase.rpc("join_group", { p_invite_code: code.trim() });
    setSaving(false);
    if (error) {
      // The RPC raises when the code matches no group; anything else is a
      // connection/permission hiccup worth distinguishing so people don't
      // keep retyping a code that's actually fine.
      setError(
        error.message.includes("Neplatný")
          ? "Takový kód nikam nevede. Zkontroluj překlepy — kód má 6 znaků."
          : "Připojení selhalo, zkus to za chvíli znovu."
      );
      return;
    }
    if (!data) {
      setError("Takový kód nikam nevede. Zkontroluj překlepy — kód má 6 znaků.");
      return;
    }
    router.push(`/groups/${data}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="text-sm font-semibold">Připojit se ke skupině</p>
      <Input
        placeholder="Kód skupiny"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="outline" disabled={saving} className="self-start">
        {saving ? "Připojuji…" : "Připojit se"}
      </Button>
    </form>
  );
}
