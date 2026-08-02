"use client";

import { Fragment } from "react";
import { useFlipList } from "@/lib/use-flip-list";
import { cn } from "@/lib/utils";

export type LiveBoardRow = {
  userId: string;
  rank: number;
  nickname: string;
  points: number;
  gapToNext: number;
  isMe: boolean;
  /** the "…" gap shown before the viewer's own row when they sit outside the top */
  separatorBefore?: boolean;
};

/** The running order during a gala. Client-side purely so rows can slide past
 * each other when the board reshuffles under you (the page refreshes live as
 * results land) - the first render is never animated. */
export function LiveMiniBoard({ rows }: { rows: LiveBoardRow[] }) {
  const rowRef = useFlipList(rows.map((r) => r.userId));

  return (
    <>
      {rows.map((row) => (
        <Fragment key={row.userId}>
          {row.separatorBefore && (
            <p className="pl-6 text-xs text-neutral-400 dark:text-neutral-500">…</p>
          )}
          <div
            ref={rowRef(row.userId)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-1.5 py-0.5 text-sm",
              row.isMe && "glass-accent-soft font-semibold"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                {row.rank}.
              </span>
              <span className="truncate">{row.nickname}</span>
              {row.isMe && (
                <span className="shrink-0 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  (ty)
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              {row.gapToNext > 0 && (
                <span className="text-[11px] font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                  −{row.gapToNext}
                </span>
              )}
              <span className="font-bold tabular-nums">{row.points}</span>
            </span>
          </div>
        </Fragment>
      ))}
    </>
  );
}
