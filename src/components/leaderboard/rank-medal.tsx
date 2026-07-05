import { Medal } from "lucide-react";
import { cn } from "@/lib/utils";

// gold / silver / bronze, in the same lucide stroke style as the nav icons
const MEDAL_COLORS = [
  "text-yellow-500 dark:text-[#FFD400]",
  "text-neutral-400 dark:text-neutral-300",
  "text-amber-700 dark:text-amber-600",
];

/** Rank indicator for leaderboard rows: medal icon for the podium,
 * plain number for everyone else. */
export function RankMedal({ rank }: { rank: number }) {
  if (rank >= 1 && rank <= 3) {
    return (
      <span className="flex w-6 shrink-0 justify-center" aria-label={`${rank}. místo`}>
        <Medal className={cn("size-5", MEDAL_COLORS[rank - 1])} strokeWidth={2.25} />
      </span>
    );
  }
  return (
    <span className="w-6 shrink-0 text-center text-sm font-bold text-neutral-500 dark:text-neutral-300">
      {rank}.
    </span>
  );
}
