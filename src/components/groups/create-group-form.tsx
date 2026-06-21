"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateGroupForm() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);
    const { data, error } = await supabase.rpc("create_group", { p_name: name.trim() });
    setSaving(false);
    if (error || !data?.[0]) {
      setError("Vytvoření skupiny se nepodařilo.");
      return;
    }
    router.push(`/groups/${data[0].id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="text-sm font-semibold">Vytvořit skupinu</p>
      <Input
        placeholder="Název skupiny"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="accent" disabled={saving} className="self-start">
        {saving ? "Vytvářím…" : "Vytvořit"}
      </Button>
    </form>
  );
}
