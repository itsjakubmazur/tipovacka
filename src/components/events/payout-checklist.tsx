"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Row = { userId: string; nickname: string; paid: boolean };

/** Self-report "zaplaceno" checklist for the startovné pool - each
 * person toggles their own row, admins can toggle anyone's (e.g. cash
 * handed over in person). No payment actually happens here, it's just
 * a shared, visible tally. */
export function PayoutChecklist({
  eventId,
  currentUserId,
  isAdmin,
  rows: initialRows,
}: {
  eventId: string;
  currentUserId: string;
  isAdmin: boolean;
  rows: Row[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(initialRows);

  async function toggle(userId: string, next: boolean) {
    setRows((prev) => prev.map((r) => (r.userId === userId ? { ...r, paid: next } : r)));
    await supabase
      .from("event_payouts")
      .upsert(
        { event_id: eventId, user_id: userId, paid: next, paid_at: next ? new Date().toISOString() : null },
        { onConflict: "event_id,user_id" }
      );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const canToggle = row.userId === currentUserId || isAdmin;
        return (
          <button
            key={row.userId}
            type="button"
            disabled={!canToggle}
            onClick={() => toggle(row.userId, !row.paid)}
            className={cn(
              "flex items-center gap-2 text-left text-sm",
              canToggle ? "cursor-pointer" : "cursor-default"
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded border",
                row.paid
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-neutral-400 dark:border-neutral-500"
              )}
            >
              {row.paid && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className={cn(row.paid && "text-neutral-400 line-through dark:text-neutral-500")}>
              {row.nickname}
            </span>
          </button>
        );
      })}
    </div>
  );
}
