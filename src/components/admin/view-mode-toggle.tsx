"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setViewMode } from "@/app/admin/actions";

export function ViewModeToggle({ initialMode }: { initialMode: "user" | "admin" }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = mode === "admin" ? "user" : "admin";
    startTransition(async () => {
      await setViewMode(next);
      setMode(next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="text-sm font-semibold">Zobrazení webu</p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {mode === "admin"
          ? "Vidíš i návrhy galavečerů, které ostatní ještě nevidí."
          : "Vidíš web stejně jako normální tipér."}
      </p>
      <Button
        type="button"
        variant={mode === "admin" ? "outline" : "accent"}
        size="sm"
        disabled={pending}
        onClick={toggle}
        className="self-start"
      >
        {mode === "admin" ? <Eye className="size-4" /> : <ShieldCheck className="size-4" />}
        {pending ? "Přepínám…" : mode === "admin" ? "Přepnout na normální zobrazení" : "Přepnout na superadmin zobrazení"}
      </Button>
    </div>
  );
}
