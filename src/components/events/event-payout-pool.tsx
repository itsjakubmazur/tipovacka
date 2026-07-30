import Link from "next/link";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PayoutStatus } from "@/components/events/payout-status";
import { QrPayment } from "@/components/events/qr-payment";
import { czAccountToIban } from "@/lib/cz-payment";

const STARTOVNE_CZK = 50;

/** Startovné settlement card: winner-takes-all pool at 50 Kč per
 * tipping participant, settled peer-to-peer (bank transfer, outside
 * the app) - shown once the gala is fully graded. Only renders with
 * at least two participants (nothing to settle otherwise). */
export async function EventPayoutPool({
  eventId,
  eventLabel,
  currentUserId,
  isSuperadmin,
}: {
  eventId: string;
  eventLabel: string;
  currentUserId: string;
  isSuperadmin: boolean;
}) {
  const supabase = await createClient();

  // the ranked board and the paid-checklist rows are independent, so
  // fetch them together instead of one after another
  const [{ data: rows }, { data: payoutRows }] = await Promise.all([
    supabase
      .from("event_leaderboard")
      .select("user_id, nickname, points, fights_correct_winner, perfect_card, earliest_prediction_at")
      .eq("event_id", eventId)
      .order("points", { ascending: false })
      .order("fights_correct_winner", { ascending: false })
      .order("perfect_card", { ascending: false })
      .order("earliest_prediction_at", { ascending: true, nullsFirst: false }),
    supabase.from("event_payouts").select("user_id, paid").eq("event_id", eventId),
  ]);

  if (!rows || rows.length < 2) return null;

  const [winner, ...others] = rows;
  const pot = others.length * STARTOVNE_CZK;
  const winnerName = winner.nickname ?? "Bez přezdívky";

  // only the winner's bank account is left, and it needs the winner id
  const { data: winnerProfile } = await supabase
    .from("profiles")
    .select("bank_account")
    .eq("id", winner.user_id)
    .single();

  const paidByUser = new Map((payoutRows ?? []).map((r) => [r.user_id, r.paid]));
  const payoutStatusRows = others.map((o) => ({
    userId: o.user_id,
    nickname: o.nickname ?? "Bez přezdívky",
    paid: paidByUser.get(o.user_id) ?? false,
  }));

  const isWinner = currentUserId === winner.user_id;
  const bankAccount = winnerProfile?.bank_account ?? null;
  const iban = bankAccount ? czAccountToIban(bankAccount) : null;

  return (
    // Compact on purpose: this card shares a sidebar with the timeline and the
    // kecárna, and the old version - a headline, a duplicate "pošli 50 Kč
    // <winner>" line, the QR on its own row, then the button and the debtors
    // under a divider - was tall enough to push the whole column into its own
    // scrollbar. Amount and recipient are each stated once, and the QR carries
    // the account number, the button and the debtors alongside it.
    <div className="flex flex-col gap-2.5 rounded-xl border border-yellow-600/60 bg-accent/10 p-3.5 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-accent/50 dark:shadow-black/60">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Wallet className="size-4 text-yellow-600 dark:text-accent" />
          Startovné
        </p>
        <p className="text-sm">
          Vyhrál/a <strong>{winnerName}</strong> a bere <strong>{pot} Kč</strong>
          <span className="text-neutral-600 dark:text-neutral-400">
            {" "}
            · {STARTOVNE_CZK} Kč od {others.length} tipérů
          </span>
        </p>
      </div>

      <PayoutStatus
        eventId={eventId}
        currentUserId={currentUserId}
        isSuperadmin={isSuperadmin}
        rows={payoutStatusRows}
        aside={
          !isWinner && bankAccount && iban ? (
            <QrPayment
              account={bankAccount}
              amountCzk={STARTOVNE_CZK}
              message={eventLabel}
              size={112}
            />
          ) : undefined
        }
        note={
          isWinner ? (
            bankAccount ? (
              <>
                Ostatní ti pošlou {STARTOVNE_CZK} Kč na{" "}
                <span className="font-mono">{bankAccount}</span>.
              </>
            ) : (
              <>
                <Link href="/profile" className="underline">
                  Nastav si číslo účtu v profilu
                </Link>
                , ať ti ostatní mají kam poslat výhru.
              </>
            )
          ) : bankAccount && iban ? (
            // the QR next to it already says "scan me"; all that's left is the
            // number, for anyone typing it in by hand
            <span className="font-mono">{bankAccount}</span>
          ) : (
            <>Čekáme, až si {winnerName} doplní číslo účtu v profilu.</>
          )
        }
      />
    </div>
  );
}
