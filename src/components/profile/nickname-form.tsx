"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NicknameForm({
  userId,
  initialNickname,
}: {
  userId: string;
  initialNickname: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [nickname, setNickname] = useState(initialNickname);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error } = await supabase
      .from("profiles")
      .update({ nickname })
      .eq("id", userId);

    setSaving(false);
    if (error) {
      setError("Uložení se nepodařilo, zkus to znovu.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 p-4 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60"
    >
      <div className="flex max-w-sm flex-col gap-1.5">
        <Label htmlFor="nickname">Přezdívka</Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setSaved(false);
          }}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && (
        <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
          <Check className="size-4" />
          Uloženo.
        </p>
      )}
      <Button type="submit" variant="accent" disabled={saving} className="self-start">
        {saving ? "Ukládám…" : "Uložit"}
      </Button>
    </form>
  );
}
