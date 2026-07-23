"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, LogOut, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GroupDetailActions({
  groupId,
  groupName,
  inviteCode,
  userId,
}: {
  groupId: string;
  groupName: string;
  inviteCode: string;
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [copied, setCopied] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareText = `Přidej se ke mně do skupiny „${groupName}" v Tipovačce. Zvací kód: ${inviteCode}`;

  async function copyCode() {
    try {
      // Prefer the native share sheet on mobile, fall back to clipboard.
      if (navigator.share) {
        await navigator.share({ text: shareText });
        return;
      }
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // user dismissed the share sheet, or clipboard blocked - no-op
    }
  }

  async function leave() {
    setLeaving(true);
    setError(null);
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);
    setLeaving(false);
    if (error) {
      setError("Odchod se nepodařil, zkus to znovu.");
      return;
    }
    router.push("/groups");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          Zvací kód: <span className="font-mono font-semibold text-black dark:text-white">{inviteCode}</span>
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1 rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium transition-colors hover:border-accent hover:text-yellow-700 dark:border-neutral-600 dark:hover:text-accent"
        >
          {copied ? (
            <>
              <Check className="size-3.5" /> Zkopírováno
            </>
          ) : (
            <>
              {typeof navigator !== "undefined" && "share" in navigator ? (
                <Share2 className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              Sdílet pozvánku
            </>
          )}
        </button>
      </div>

      {!confirmingLeave ? (
        <button
          type="button"
          onClick={() => setConfirmingLeave(true)}
          className="flex items-center gap-1 self-start text-xs font-medium text-neutral-500 transition-colors hover:text-red-600 dark:text-neutral-400"
        >
          <LogOut className="size-3.5" />
          Opustit skupinu
        </button>
      ) : (
        <div className="flex flex-col gap-2 self-start rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm">Opravdu chceš opustit „{groupName}“?</p>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" size="sm" disabled={leaving} onClick={leave}>
              {leaving ? "Odcházím…" : "Opustit"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={leaving}
              onClick={() => setConfirmingLeave(false)}
            >
              Zůstat
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
