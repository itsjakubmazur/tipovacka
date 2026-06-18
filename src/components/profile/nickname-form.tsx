"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1.5">
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
      {saved && <p className="text-sm text-neutral-600">Uloženo.</p>}
      <Button type="submit" variant="accent" disabled={saving}>
        {saving ? "Ukládám…" : "Uložit"}
      </Button>
    </form>
  );
}
