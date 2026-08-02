"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section-heading";

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
    <Section title="Vytvořit skupinu">
    <form onSubmit={handleSubmit} className="glass-surface flex flex-col gap-3 rounded-xl border p-4">
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
    </Section>
  );
}
