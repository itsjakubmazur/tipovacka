"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Row = { userId: string; nickname: string; paid: boolean };

/** Self-report "zaplaceno" state for the startovné pool - one button
 * for the viewer's own row ("Zaplatil/a jsem"), plus a plain "kdo
 * dluží" line naming whoever else hasn't paid yet. A superadmin can
 * additionally tap a name in that line to mark it paid on someone
 * else's behalf (e.g. cash handed over in person); regular tippers
 * only ever touch their own row. No payment actually happens here,
 * it's just a shared, visible tally. */
export function PayoutStatus({
  eventId,
  currentUserId,
  isSuperadmin,
  rows: initialRows,
  aside,
  note,
}: {
  eventId: string;
  currentUserId: string;
  isSuperadmin: boolean;
  rows: Row[];
  /** the QR code, pinned to the left - everything else stacks beside it so
   * the card doesn't grow a tall empty strip next to a 112px square */
  aside?: React.ReactNode;
  /** account number or whatever the viewer needs to know before paying */
  note?: React.ReactNode;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(initialRows);

  async function setPaid(userId: string, next: boolean) {
    setRows((prev) => prev.map((r) => (r.userId === userId ? { ...r, paid: next } : r)));
    await supabase
      .from("event_payouts")
      .upsert(
        { event_id: eventId, user_id: userId, paid: next, paid_at: next ? new Date().toISOString() : null },
        { onConflict: "event_id,user_id" }
      );
  }

  const myRow = rows.find((r) => r.userId === currentUserId);
  const unpaid = rows.filter((r) => !r.paid && r.userId !== currentUserId);

  return (
    <div className="flex items-start gap-3">
      {aside}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
      {note && <div className="text-xs text-neutral-600 dark:text-neutral-400">{note}</div>}
      {myRow && (
        <Button
          type="button"
          variant={myRow.paid ? "outline" : "accent"}
          size="sm"
          onClick={() => setPaid(currentUserId, !myRow.paid)}
          className="self-start"
        >
          {myRow.paid && <Check className="size-4" strokeWidth={3} />}
          {myRow.paid ? "Zaplaceno" : "Zaplatil/a jsem"}
        </Button>
      )}

      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        {unpaid.length === 0 ? (
          "Všichni ostatní mají zaplaceno."
        ) : (
          <>
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Dluží: </span>
            {unpaid.map((row, i) => (
              <span key={row.userId}>
                {isSuperadmin ? (
                  <button
                    type="button"
                    onClick={() => setPaid(row.userId, true)}
                    className="underline decoration-dotted underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
                  >
                    {row.nickname}
                  </button>
                ) : (
                  row.nickname
                )}
                {i < unpaid.length - 1 && ", "}
              </span>
            ))}
          </>
        )}
      </p>
      </div>
    </div>
  );
}
