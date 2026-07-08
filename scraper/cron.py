"""Single consolidated cron entrypoint, run every ~5 minutes via
cron-job.org dispatching .github/workflows/scraper-cron.yml. Kept as one scheduled job (instead of
several) since GitHub Actions bills a 1-minute minimum per job run no
matter how short the script actually takes - a private repo's free
minutes would otherwise disappear fast.

Does eight things, in order:

1. auto_create_events - creates a 'draft' event (admin-only, see
   src/app/events/page.tsx) for any future numbered OKTAGON fight card
   that shows up on /events/ and isn't in our table yet, prefilled with
   date/location/name straight from OKTAGON.
2. publish_draft_events - 3 days before a draft event starts, flips it
   to 'upcoming' so it becomes visible/tippable; its card is then picked
   up by import_new_cards below like any other event.
3. import_new_cards - once an event has had its number set for at least
   5 minutes (a grace period, in case an admin is still editing it) and
   doesn't have any fights yet, imports the card and notifies everyone
   that it's online.
4. recheck_cards - every ~3h, re-imports the card for events that aren't
   locked yet (drafts with an imported card included), to catch
   short-notice changes (new/cancelled fight), notifying everyone if
   anything actually changed on a published event.
5. refresh_odds - on every tick (odds move too fast for the 3h card
   recheck interval), refreshes betting odds for events with a card that
   aren't locked yet.
6. send_lock_reminders - events locking within the next hour get a
   personalized "tip before it's too late" push, naming the event and
   how many of its fights that specific user still hasn't tipped.
7. send_lock_notifications - events whose lock_at has just passed get a
   "gala starts, go check everyone's tips" push to everyone subscribed.
8. check_results - events that have started but aren't completed yet get
   a results import attempt; once every fight has a result AND an admin
   has entered Fight of the Night (not published anywhere, announced at
   the post-event press conference - see admin event detail page), the
   event flips to completed and everyone gets notified that points are
   in.
9. send_followup_notifications - at 14:00 Prague time the day after an
   event, everyone who tipped gets a "thanks, go see how you did" push
   and everyone who didn't gets a "here's how everyone else did" push,
   both mentioning when the next gala is and that its card opens
   PUBLISH_DAYS_BEFORE days before it starts.
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from import_card import import_card, update_odds
from import_results import import_results
from oktagon import fetch_upcoming_tournaments
from push import send_to_all, send_to_user
from run_logger import log_run
from supabase_client import SupabaseClient

CARD_GRACE_PERIOD = timedelta(minutes=5)
CARD_RECHECK_INTERVAL = timedelta(hours=3)
FOLLOWUP_DAYS_AFTER = 1
FOLLOWUP_HOUR_PRAGUE = 14
LOCK_REMINDER_WINDOW = timedelta(hours=1)
MAX_FUTURE_EVENTS = 2
PRAGUE_TZ = ZoneInfo("Europe/Prague")
PUBLISH_DAYS_BEFORE = 3
PUBLISH_HOUR_PRAGUE = 9

CZECH_MONTHS_GENITIVE = {
    1: "ledna",
    2: "února",
    3: "března",
    4: "dubna",
    5: "května",
    6: "června",
    7: "července",
    8: "srpna",
    9: "září",
    10: "října",
    11: "listopadu",
    12: "prosince",
}


def event_label(event: dict) -> str:
    return f"OKTAGON {event['number']}" if event.get("number") else event["name"]


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _format_date_cs(dt: datetime) -> str:
    local = dt.astimezone(PRAGUE_TZ)
    return f"{local.day}. {CZECH_MONTHS_GENITIVE[local.month]} {local.year}"


def auto_create_events(db: SupabaseClient, now: datetime) -> None:
    """Once OKTAGON's own /events/ listing shows a future numbered fight
    card we don't have yet, creates a 'draft' row for it with everything
    OKTAGON already publishes up front (date, location, name) - visible
    to admins only (see src/app/events/page.tsx) until publish_draft_events
    turns it into a real, tippable event closer to the date.

    OKTAGON's API already lists events months ahead, so this only ever
    keeps MAX_FUTURE_EVENTS not-yet-completed events in our own pipeline
    (counting any future event, OKTAGON-sourced or manually created) -
    otherwise the events list would fill up with galas nobody can tip on
    for a long time yet."""
    try:
        tournaments = fetch_upcoming_tournaments()
    except Exception as exc:
        print(f"Nepodařilo se stáhnout listing eventů z OKTAGON API: {exc}")
        return

    existing = db.select("events", {"select": "oktagon_event_id,status,event_date"})
    existing_ids = {e["oktagon_event_id"] for e in existing if e["oktagon_event_id"]}
    future_count = sum(
        1
        for e in existing
        if e["status"] != "completed" and e["event_date"] and _parse_dt(e["event_date"]) > now
    )

    tournaments = sorted(tournaments, key=lambda t: t["event_date"])
    for tournament in tournaments:
        if future_count >= MAX_FUTURE_EVENTS:
            break
        if tournament["oktagon_event_id"] in existing_ids:
            continue
        if _parse_dt(tournament["event_date"]) <= now:
            continue

        db.insert(
            "events",
            [
                {
                    "number": tournament["number"],
                    "name": tournament["name"],
                    "event_date": tournament["event_date"],
                    "lock_at": tournament["event_date"],
                    "location": tournament["location"],
                    "oktagon_event_id": tournament["oktagon_event_id"],
                    "status": "draft",
                }
            ],
        )
        future_count += 1
        print(f"Založen návrh eventu: {tournament['name']} ({tournament['event_date']}).")


def _publish_at(event_date: datetime) -> datetime:
    """9:00 Prague time, PUBLISH_DAYS_BEFORE calendar days before the
    event - computed in Prague's local time so it stays 9:00 there
    across the DST switch, not 9:00 UTC."""
    local_date = event_date.astimezone(PRAGUE_TZ) - timedelta(days=PUBLISH_DAYS_BEFORE)
    return local_date.replace(hour=PUBLISH_HOUR_PRAGUE, minute=0, second=0, microsecond=0)


def publish_draft_events(db: SupabaseClient, now: datetime) -> None:
    """At 9:00 Prague time, PUBLISH_DAYS_BEFORE days before a draft event
    starts, flips it to 'upcoming' - it becomes visible to tippers
    immediately, and import_new_cards (which only skips status='draft')
    picks up the card on the same/next tick since `number` was already
    set when the draft was created."""
    events = db.select("events", {"status": "eq.draft", "select": "id,number,name,event_date"})
    for event in events:
        if not event["event_date"] or now < _publish_at(_parse_dt(event["event_date"])):
            continue
        label = event_label(event)
        db.update("events", {"status": "upcoming"}, {"id": f"eq.{event['id']}"})
        print(f"{label}: zveřejněno tipérům, karta se naimportuje při nejbližším běhu cronu.")


def import_new_cards(db: SupabaseClient, now: datetime) -> None:
    events = db.select(
        "events",
        {
            "number": "not.is.null",
            # not just "neq.draft" - a stale card_notified_at on an
            # already-locked/completed event (e.g. hit by this same bug
            # weeks ago) must never trigger a "you can tip now" push for
            # a gala that's long over.
            "status": "eq.upcoming",
            "card_notified_at": "is.null",
            "created_at": f"lte.{(now - CARD_GRACE_PERIOD).isoformat()}",
            "select": "id,number,name",
        },
    )
    for event in events:
        label = event_label(event)
        fights = db.select("fights", {"event_id": f"eq.{event['id']}", "select": "id", "limit": "1"})
        if fights:
            # card was already imported by an admin while this event was
            # still a draft (see triggerSherdogImport in the admin event
            # detail page) - nothing new to import, but tippers are only
            # seeing the event for the first time now that it's
            # published, so they still need the "card is online" push.
            created = 1
        else:
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
                pref="notify_card_updates",
            )


def recheck_cards(db: SupabaseClient, now: datetime) -> None:
    """Also covers draft events whose card was already imported (e.g. by
    an admin ahead of publishing) - their cards used to silently rot
    with stale fights until publish. Drafts are invisible to tippers, so
    changes there don't push a notification."""
    cutoff = (now - CARD_RECHECK_INTERVAL).isoformat()
    events = db.select(
        "events",
        {
            "number": "not.is.null",
            "status": "neq.completed",
            "or": f"(card_checked_at.is.null,card_checked_at.lte.{cutoff})",
            "select": "id,number,name,lock_at,status",
        },
    )
    for event in events:
        if event["lock_at"] and event["lock_at"] <= now.isoformat():
            continue
        # no card yet - that's import_new_cards' job (with its own notify flow)
        fights = db.select("fights", {"event_id": f"eq.{event['id']}", "select": "id", "limit": "1"})
        if not fights:
            continue

        label = event_label(event)
        with log_run("cron_card_recheck", event["id"]):
            created, cancelled = import_card(event["id"])

        db.update(
            "events",
            {"card_checked_at": datetime.now(timezone.utc).isoformat()},
            {"id": f"eq.{event['id']}"},
        )
        if (created > 0 or cancelled > 0) and event["status"] != "draft":
            send_to_all(
                db,
                f"{label}: karta se změnila",
                "Na zápasové kartě nastala změna, zkontroluj a tipuj!",
                f"/events/{event['id']}",
                pref="notify_card_updates",
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
            "status": "not.in.(draft,completed)",
            "select": "id,oktagon_event_id,lock_at",
        },
    )
    for event in events:
        if event["lock_at"] and event["lock_at"] <= now.isoformat():
            continue
        with log_run("cron_odds_refresh", event["id"]):
            update_odds(db, event["id"], event["oktagon_event_id"])


def send_lock_reminders(db: SupabaseClient, now: datetime) -> None:
    """Personalized per-user, unlike the other cron pushes - each
    subscriber gets their own "X z Y zápasů" tally, computed from their
    predictions against the event's tippable (non-cancelled) fights, so
    someone who's already fully tipped sees that instead of a generic
    nudge."""
    events = db.select(
        "events",
        {
            "status": "not.in.(draft,completed)",
            "reminder_sent_at": "is.null",
            "lock_at": f"lte.{(now + LOCK_REMINDER_WINDOW).isoformat()}",
            "select": "id,number,name,lock_at",
        },
    )
    events = [e for e in events if e["lock_at"] and e["lock_at"] >= now.isoformat()]

    for event in events:
        label = event_label(event)
        with log_run("cron_lock_reminder", event["id"]):
            fights = db.select(
                "fights",
                {"event_id": f"eq.{event['id']}", "status": "neq.cancelled", "select": "id"},
            )
            fight_ids = [f["id"] for f in fights]
            total = len(fight_ids)

            if total == 0:
                print(f"{label}: karta ještě nemá žádné zápasy, reminder přeskočen.")
            else:
                user_ids = {row["user_id"] for row in db.select("push_subscriptions", {"select": "user_id"})}
                opted_out = {
                    p["id"] for p in db.select("profiles", {"notify_reminders": "eq.false", "select": "id"})
                }
                predictions = db.select(
                    "predictions",
                    {"fight_id": f"in.({','.join(fight_ids)})", "select": "user_id"},
                )
                tipped_counts: dict[str, int] = {}
                for prediction in predictions:
                    tipped_counts[prediction["user_id"]] = tipped_counts.get(prediction["user_id"], 0) + 1

                for user_id in user_ids - opted_out:
                    have = tipped_counts.get(user_id, 0)
                    send_to_user(
                        db,
                        user_id,
                        f"{label} začíná za hodinu",
                        f"Máš tipnuto {have} z {total} zápasů, nezapomeň dotipovat!",
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
            "status": "not.in.(draft,completed)",
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
            "status": "not.in.(draft,completed)",
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
                "Turnaj je za námi, podívej se na výsledky tipovačky i s Fight of the Night!",
                f"/leaderboard?eventId={event['id']}",
            )


def _followup_at(event_date: datetime) -> datetime:
    """14:00 Prague time, FOLLOWUP_DAYS_AFTER calendar days after the
    event - computed in Prague's local time for the same DST-safety
    reason as _publish_at."""
    local_date = event_date.astimezone(PRAGUE_TZ) + timedelta(days=FOLLOWUP_DAYS_AFTER)
    return local_date.replace(hour=FOLLOWUP_HOUR_PRAGUE, minute=0, second=0, microsecond=0)


def _next_event_text(db: SupabaseClient, now: datetime) -> str:
    # Drafts are only hidden from the public site - we already know the date,
    # so include them here instead of saying "we don't know yet".
    events = db.select("events", {"select": "id,number,name,event_date"})
    future = [e for e in events if e["event_date"] and _parse_dt(e["event_date"]) > now]
    if not future:
        return "Termín dalšího galavečeru ještě nevíme, sledujte upozornění."

    next_event = min(future, key=lambda e: e["event_date"])
    label = event_label(next_event)
    date_str = _format_date_cs(_parse_dt(next_event["event_date"]))
    return f"Další galavečer je {label} ({date_str}), tipovačka se otevře {PUBLISH_DAYS_BEFORE} dny předtím."


def send_followup_notifications(db: SupabaseClient, now: datetime) -> None:
    events = db.select(
        "events",
        {
            "status": "neq.draft",
            "followup_notified_at": "is.null",
            "select": "id,number,name,event_date",
        },
    )
    for event in events:
        if not event["event_date"] or now < _followup_at(_parse_dt(event["event_date"])):
            continue

        label = event_label(event)
        fights = db.select("fights", {"event_id": f"eq.{event['id']}", "select": "id"})
        participant_ids: set[str] = set()
        if fights:
            fight_ids = ",".join(f["id"] for f in fights)
            predictions = db.select("predictions", {"fight_id": f"in.({fight_ids})", "select": "user_id"})
            participant_ids = {p["user_id"] for p in predictions}

        with log_run("cron_followup_notification", event["id"]):
            next_event_text = _next_event_text(db, now)
            profiles = db.select("profiles", {"select": "id"})
            for profile in profiles:
                if profile["id"] in participant_ids:
                    send_to_user(
                        db,
                        profile["id"],
                        f"{label}: díky za tipy!",
                        f"Mrkni na žebříčky, jak se dařilo ostatním. {next_event_text}",
                        f"/leaderboard?eventId={event['id']}",
                    )
                else:
                    send_to_user(
                        db,
                        profile["id"],
                        f"{label} je za námi",
                        f"Mrkni, jak se dařilo ostatním v žebříčku. {next_event_text}",
                        f"/leaderboard?eventId={event['id']}",
                    )
            db.update(
                "events",
                {"followup_notified_at": now.isoformat()},
                {"id": f"eq.{event['id']}"},
            )


def main() -> None:
    db = SupabaseClient()
    now = datetime.now(timezone.utc)
    auto_create_events(db, now)
    publish_draft_events(db, now)
    import_new_cards(db, now)
    recheck_cards(db, now)
    refresh_odds(db, now)
    send_lock_reminders(db, now)
    send_lock_notifications(db, now)
    check_results(db, now)
    send_followup_notifications(db, now)


if __name__ == "__main__":
    main()
