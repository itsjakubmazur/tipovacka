"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Superadmin management of the shared registration invite code -
 * shows the current one (copy button for passing it on) and lets it be
 * rotated any time it leaks. Existing accounts are unaffected by a
 * rotation; only future registrations need the new code. */
export function InviteCodeCard() {
  const supabase = createClient();
  const [code, setCode] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("admin_get_invite_code").then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError("Kód se nepodařilo načíst.");
      else setCode(data as string);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareInvite() {
    if (!code) return;
    const url = window.location.origin;
    const text = `Přidej se do naší tipovačky na OKTAGON! Zaregistruj se na ${url} a použij zvací kód: ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "OKTAGON GARÁŽ Tipovačka", text });
        return;
      } catch {
        return; // user closed the share sheet
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function save() {
    const trimmed = draft.trim();
    if (trimmed.length < 6) {
      setError("Kód musí mít aspoň 6 znaků.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc("admin_set_invite_code", { new_code: trimmed });
    setSaving(false);
    if (error) {
      setError("Uložení se nepodařilo.");
      return;
    }
    setCode(trimmed);
    setEditing(false);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 p-4 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <KeyRound className="size-4 text-yellow-600 dark:text-accent" />
        Zvací kód pro registraci
      </p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Bez tohoto kódu se nikdo nový nezaregistruje. Když se prokecne, prostě ho tady změň —
        stávajících účtů se to nijak nedotkne.
      </p>

      {!editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-950">
            {code ?? "…"}
          </span>
          <Button type="button" variant="accent" size="sm" onClick={shareInvite} disabled={!code}>
            <Share2 className="size-4" />
            Pozvat kámoše
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={copy} disabled={!code}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Zkopírováno" : "Kopírovat"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Změnit
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nový kód (min. 6 znaků)"
            className="max-w-56"
          />
          <Button type="button" variant="accent" size="sm" onClick={save} disabled={saving}>
            {saving ? "Ukládám…" : "Uložit"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
            Zrušit
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
