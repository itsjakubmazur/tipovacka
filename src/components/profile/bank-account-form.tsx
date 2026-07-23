"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCzechAccount } from "@/lib/cz-payment";

export function BankAccountForm({
  userId,
  initialAccount,
}: {
  userId: string;
  initialAccount: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [account, setAccount] = useState(initialAccount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = account.trim();
    if (trimmed && !parseCzechAccount(trimmed)) {
      setError("Formát čísla účtu nesedí - očekávám např. 19-2000145399/0800.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    const { error } = await supabase
      .from("profiles")
      .update({ bank_account: trimmed || null })
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">Číslo účtu pro výhry</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Když vyhraješ startovné za galavečer, ostatní hráči uvidí QR platbu na tenhle účet — ale až
          po vyhodnocení a jen ti, kdo ti mají poslat peníze. Nikde jinde se nezobrazuje a můžeš ho
          nechat prázdný.
        </p>
      </div>
      <div className="flex max-w-sm flex-col gap-1.5">
        <Label htmlFor="bank-account">Číslo účtu</Label>
        <Input
          id="bank-account"
          value={account}
          placeholder="19-2000145399/0800"
          onChange={(e) => {
            setAccount(e.target.value);
            setSaved(false);
          }}
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
