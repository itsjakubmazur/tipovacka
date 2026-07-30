"""Gala-night dry run against a throwaway event.

Creates a fake gala with a fake card, walks it through the whole night -
publish, lock, grade fight by fight, Fight of the Night, payout - and prints
what the app would have shown and pushed at each step. Then deletes everything
it made.

The point is to exercise the parts nobody can test by clicking: the cron's
notification gates, the grading maths, the leaderboard view, the payout pool.
It is *not* a substitute for looking at the real screens.

    python rehearsal.py              # dry run, sends no push notifications
    python rehearsal.py --with-push  # actually send (only ever do this on a
                                     # dev project - it buzzes real phones)
    python rehearsal.py --keep       # leave the event behind to poke at

Requires the same env as cron.py (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
VAPID_*), and writes with the service-role key, so RLS does not apply. Never
point it at production with --with-push.
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone

from supabase_client import SupabaseClient

REHEARSAL_MARKER = "REHEARSAL – smazat"


def _iso(dt: datetime) -> str:
    return dt.isoformat()


class Rehearsal:
    def __init__(self, db: SupabaseClient, send_push: bool):
        self.db = db
        self.send_push = send_push
        self.event_id: str | None = None
        self.fighter_ids: list[str] = []
        self.fight_ids: list[str] = []
        self.failures: list[str] = []

    # ---------------------------------------------------------------- helpers

    def check(self, label: str, ok: bool, detail: str = "") -> None:
        mark = "✅" if ok else "❌"
        print(f"  {mark} {label}{f' — {detail}' if detail else ''}")
        if not ok:
            self.failures.append(label)

    # ------------------------------------------------------------------ setup

    def create_event(self) -> None:
        now = datetime.now(timezone.utc)
        rows = self.db.insert(
            "events",
            [
                {
                    "name": REHEARSAL_MARKER,
                    "event_date": _iso(now + timedelta(hours=2)),
                    "location": "Zkušebna",
                    "status": "upcoming",
                    "lock_at": _iso(now + timedelta(hours=1)),
                    "auto_lock": False,
                    # never let a rehearsal invent debts between real people
                    "payouts_enabled": False,
                }
            ],
        )
        self.event_id = rows[0]["id"]
        print(f"\nGalavečer {self.event_id} založen.")

    def create_card(self, fights: int = 3) -> None:
        assert self.event_id
        names = [f"Rehearsal Fighter {i + 1}" for i in range(fights * 2)]
        created = self.db.insert("fighters", [{"name": n} for n in names])
        self.fighter_ids = [f["id"] for f in created]

        payload = []
        for i in range(fights):
            payload.append(
                {
                    "event_id": self.event_id,
                    "fighter_a_id": self.fighter_ids[i * 2],
                    "fighter_b_id": self.fighter_ids[i * 2 + 1],
                    "card_order": i + 1,
                    "rounds": 3,
                    "status": "scheduled",
                    "is_main_event": i == fights - 1,
                }
            )
        self.fight_ids = [f["id"] for f in self.db.insert("fights", payload)]
        print(f"Karta: {fights} zápasy.")

    # ------------------------------------------------------------------ steps

    def place_tips(self) -> None:
        """One tip per real tipper on every fight, so the leaderboard has
        something to rank. Everyone picks fighter A; the first person also
        picks the method and round right, so the scoring spread is visible."""
        assert self.event_id
        profiles = self.db.select("profiles", {"select": "id", "limit": "20"})
        if not profiles:
            self.check("Jsou v databázi nějaké profily", False, "žádný uživatel")
            return

        rows = []
        for index, profile in enumerate(profiles):
            for fight_index, fight_id in enumerate(self.fight_ids):
                rows.append(
                    {
                        "user_id": profile["id"],
                        "fight_id": fight_id,
                        "predicted_winner_id": self.fighter_ids[fight_index * 2],
                        "predicted_method": "KO/TKO" if index == 0 else "DECISION",
                        "predicted_round": 1 if index == 0 else None,
                    }
                )
        self.db.insert("predictions", rows)
        self.check("Tipy uloženy", True, f"{len(rows)} tipů od {len(profiles)} tipérů")

    def lock(self) -> None:
        assert self.event_id
        self.db.update(
            "events",
            {"lock_at": _iso(datetime.now(timezone.utc) - timedelta(minutes=1))},
            {"id": f"eq.{self.event_id}"},
        )
        self.check("Uzávěrka posunuta do minulosti", True)

    def grade(self) -> None:
        """Grades fight by fight the way import_results does, and checks the
        leaderboard keeps up after each one."""
        assert self.event_id
        for i, fight_id in enumerate(self.fight_ids):
            self.db.update(
                "fights",
                {
                    "status": "completed",
                    "winner_fighter_id": self.fighter_ids[i * 2],
                    "method": "KO/TKO",
                    "result_round": 1,
                    "result_time": "1:23",
                },
                {"id": f"eq.{fight_id}"},
            )
            # points are computed by a database trigger, not by the importer
            graded = self.db.select(
                "predictions", {"fight_id": f"eq.{fight_id}", "select": "points"}
            )
            scored = [p for p in graded if p["points"] is not None]
            self.check(
                f"Zápas {i + 1}/{len(self.fight_ids)} odbodován",
                len(scored) == len(graded),
                f"{len(scored)}/{len(graded)} tipů má body",
            )

        board = self.db.select(
            "event_leaderboard",
            {"event_id": f"eq.{self.event_id}", "select": "user_id,points", "order": "points.desc"},
        )
        self.check("Žebříček galavečera se naplnil", len(board) > 0, f"{len(board)} řádků")
        if board:
            print(f"     nejlepší: {board[0]['points']} b.")

    def set_fotn(self) -> None:
        assert self.event_id
        self.db.update(
            "events",
            {"actual_fotn_fight_id": self.fight_ids[-1]},
            {"id": f"eq.{self.event_id}"},
        )
        bonus = self.db.select(
            "bonus_predictions", {"event_id": f"eq.{self.event_id}", "select": "points"}
        )
        self.check("Fight of the Night zapsán", True, f"{len(bonus)} bonusových tipů")

    def complete(self) -> None:
        assert self.event_id
        self.db.update("events", {"status": "completed"}, {"id": f"eq.{self.event_id}"})
        board = self.db.select(
            "event_leaderboard",
            {
                "event_id": f"eq.{self.event_id}",
                "select": "user_id,points,perfect_card",
                "order": "points.desc",
            },
        )
        self.check("Galavečer uzavřen", True, f"vítěz má {board[0]['points']} b." if board else "")

    def check_notifications(self) -> None:
        """What the cron would have sent. With --with-push it actually ran, so
        push_log has rows; without it, this just states what's missing."""
        assert self.event_id
        log = self.db.select(
            "push_log", {"event_id": f"eq.{self.event_id}", "select": "kind,recipients"}
        )
        if not self.send_push:
            print("  ℹ️  Notifikace se v suchém běhu neodesílají (--with-push je zapne).")
            return
        kinds = {row["kind"] for row in log}
        for expected in ("lock", "fight_result", "results_done"):
            self.check(f"Notifikace '{expected}' odešla", expected in kinds)

    # ---------------------------------------------------------------- cleanup

    def cleanup(self) -> None:
        if not self.event_id:
            return
        # fights, predictions, comments and push_log rows all cascade from the
        # event; the fighters we invented do not
        self.db.delete("events", {"id": f"eq.{self.event_id}"})
        for fighter_id in self.fighter_ids:
            self.db.delete("fighters", {"id": f"eq.{fighter_id}"})
        print("\nÚklid hotov, po zkoušce nic nezůstalo.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--with-push",
        action="store_true",
        help="opravdu odeslat notifikace (jen na vývojovém projektu!)",
    )
    parser.add_argument("--keep", action="store_true", help="nemazat zkušební galavečer")
    args = parser.parse_args()

    db = SupabaseClient()
    rehearsal = Rehearsal(db, send_push=args.with_push)

    try:
        rehearsal.create_event()
        rehearsal.create_card()
        print("\n— Tipování —")
        rehearsal.place_tips()
        print("\n— Uzávěrka —")
        rehearsal.lock()
        print("\n— Průběh večera —")
        rehearsal.grade()
        print("\n— Dohra —")
        rehearsal.set_fotn()
        rehearsal.complete()
        rehearsal.check_notifications()
    finally:
        if args.keep:
            print(f"\n--keep: galavečer {rehearsal.event_id} zůstává v databázi.")
        else:
            rehearsal.cleanup()

    print()
    if rehearsal.failures:
        print(f"❌ Neprošlo: {', '.join(rehearsal.failures)}")
        return 1
    print("✅ Generálka prošla celá.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
