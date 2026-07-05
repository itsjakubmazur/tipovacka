import { redirect } from "next/navigation";

// The hall of fame lives on the leaderboard as a view tab now - this
// route only survives for old links.
export default function HallOfFameRedirect() {
  redirect("/leaderboard?view=history");
}
