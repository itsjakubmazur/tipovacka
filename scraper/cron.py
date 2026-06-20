"""Single consolidated cron entrypoint, run every 15 minutes by
.github/workflows/scraper-cron.yml. Kept as one scheduled job (instead of
several) since GitHub Actions bills a 1-minute minimum per job run no
matter how short the script actually takes - a private repo's free
minutes would otherwise disappear fast.

Does six things, in order:

1. import_new_cards - once an event has had its number set for at least
   5 minutes (a grace period, in case an admin is still editing it) and
   doesn't have any fights yet, imports the card and notifies everyone
   that it's online.
2. recheck_cards - every ~3h, re-imports the card for events that aren't
   locked yet, to catch short-notice changes (new/cancelled fight),
   notifying everyone if anything actually changed.
3. refresh_odds - on every tick (odds move too fast for the 3h card
   recheck interval), refreshes betting odds for events with a card that
   aren't locked yet.
4. send_lock_reminders - events locking within the next hour get a "tip
   before it's too late" push to everyone subscribed.
5. send_lock_notifications - events whose lock_at has just passed get a
   "gala starts, go check everyone's tips" push to everyone subscribed.
6. check_results - events that have started but aren't completed yet get
   a results import attempt; once an event flips to completed, everyone
   gets notified that points are in.
"""

from datetime import datetime, timedelta, timezone

from import_card import import_card, update_odds
from import_results import import_results
from push import send_to_all
from run_logger import log_run
from supabase_client import SupabaseClient

CARD_GRACE_PERIOD = timedelta(minutes=5)
CARD_RECHECK_INTERVAL = timedelta(hours=3)
LOCK_REMINDER_WINDOW = timedelta(hours=1)


def event_label(event: dict) -> str:
    return f"OKTAGON {event['number']}" if event.get("number") else event["name"]


def import_new_cards(db: SupabaseClient, now: datetime) -> None:
    events = db.select(
        "events",
        {
            "number": "not.is.null",
            "card_notified_at": "is.null",
            "created_at": f"lte.{(now - CARD_GRACE_PERIOD).isoformat()}",
            "select": "id,number,name",
        },
    )
    for event in events:
        fights = db.select("fights", {"event_id": f"eq.{event['id']}", "select": "id", "limit": "1"})
        if fights:
            continue

        label = event_label(event)
        with log_run("cron_card_import", event["id"]):
            created, _ = import_card(event["id"])

        now_iso = datetime.now(timezone.utc).isoformat()
        db.update("events", {"card_checked_at": now_iso}, {"id": f"eq.{event['id']}"})
        if created > 0:
            db.update("events", {"card_notified_at": now_iso}, {"id": f"eq.{event['id']}"})
            send_to_all(
                db,
                f"{label}: karta je online",
                "Zápasy byly zveřejněny, můžeš tipovat!",
                f"/events/{event['id']}",
            )


def recheck_cards(db: SupabaseClient, now: datetime) -> None:
    events = db.select(
        "events",
        {
            "number": "not.is.null",
            "card_notified_at": "not.is.null",
            "status": "neq.completed",
            "card_checked_at": f"lte.{(now - CARD_RECHECK_INTERVAL).isoformat()}",
            "select": "id,number,name,lock_at",
        },
    )
    for event in events:
        if event["lock_at"] and event["lock_at"] <= now.isoformat():
            continue

        label = event_label(event)
        with log_run("cron_card_recheck", event["id"]):
            created, cancelled = import_card(event["id"])

        db.update(
            "events",
            {"card_checked_at": datetime.now(timezone.utc).isoformat()},
            {"id": f"eq.{event['id']}"},
        )
        if created > 0 or cancelled > 0:
            send_to_all(
                db,
                f"{label}: karta se změnila",
                "Na zápasové kartě nastala změna, zkontroluj a tipuj!",
                f"/events/{event['id']}",
            )


def refresh_odds(db: SupabaseClient, now: datetime) -> None:
    """Betting odds move right up until lock, so unlike the rest of the
    card they're refreshed on every cron tick (not gated by
    CARD_RECHECK_INTERVAL) for any event that already has a card and
    isn't locked yet."""
    events = db.select(
        "events",
        {
            "oktagon_event_id": "not.is.null",
            "card_notified_at": "not.is.null",
            "status": "neq.completed",
            "select": "id,oktagon_event_id,lock_at",
        },
    )
    for event in events:
        if event["lock_at"] and event["lock_at"] <= now.isoformat():
            continue
        with log_run("cron_odds_refresh", event["id"]):
            update_odds(db, event["id"], event["oktagon_event_id"])


def send_lock_reminders(db: SupabaseClient, now: datetime) -> None:
    events = db.select(
        "events",
        {
            "status": "neq.completed",
            "reminder_sent_at": "is.null",
            "lock_at": f"lte.{(now + LOCK_REMINDER_WINDOW).isoformat()}",
            "select": "id,number,name,lock_at",
        },
    )
    events = [e for e in events if e["lock_at"] and e["lock_at"] >= now.isoformat()]

    for event in events:
        label = event_label(event)
        with log_run("cron_lock_reminder", event["id"]):
            send_to_all(
                db,
                f"{label} za hodinu začíná",
                "Nezapomeň dotipovat a mrkni na dnešní kartu!",
                f"/events/{event['id']}",
            )
            db.update(
                "events",
                {"reminder_sent_at": now.isoformat()},
                {"id": f"eq.{event['id']}"},
            )


def send_lock_notifications(db: SupabaseClient, now: datetime) -> None:
    events = db.select(
        "events",
        {
            "status": "neq.completed",
            "lock_notified_at": "is.null",
            "lock_at": f"lte.{now.isoformat()}",
            "select": "id,number,name",
        },
    )
    for event in events:
        label = event_label(event)
        with log_run("cron_lock_notification", event["id"]):
            send_to_all(
                db,
                f"{label} začíná",
                "Tipy jsou uzavřené, mrkni na žebříček, kdo na koho tipoval!",
                f"/leaderboard?eventId={event['id']}",
            )
            db.update(
                "events",
                {"lock_notified_at": now.isoformat()},
                {"id": f"eq.{event['id']}"},
            )


def check_results(db: SupabaseClient, now: datetime) -> None:
    events = db.select(
        "events",
        {
            "status": "neq.completed",
            "lock_at": f"lt.{now.isoformat()}",
            "number": "not.is.null",
            "select": "id,number,name",
        },
    )
    for event in events:
        label = event_label(event)
        with log_run("cron_results", event["id"]):
            try:
                import_results(event["id"])
            except SystemExit:
                print(f"Import výsledků pro {label} selhal, pokračuji dalším galavečerem.")
                continue

        refreshed = db.select("events", {"id": f"eq.{event['id']}", "select": "status"})[0]
        if refreshed["status"] == "completed":
            send_to_all(
                db,
                f"{label}: výsledky jsou hotové",
                "Galavečer byl vyhodnocen, mrkni na výsledky tipovačky!",
                f"/leaderboard?eventId={event['id']}",
            )


def main() -> None:
    db = SupabaseClient()
    now = datetime.now(timezone.utc)
    import_new_cards(db, now)
    recheck_cards(db, now)
    refresh_odds(db, now)
    send_lock_reminders(db, now)
    send_lock_notifications(db, now)
    check_results(db, now)


if __name__ == "__main__":
    main()
