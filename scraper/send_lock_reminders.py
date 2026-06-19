"""Run by a scheduled GitHub Action: finds events whose lock_at is coming
up soon, and sends a web push reminder to everyone who has push notifications
enabled but hasn't tipped every fight on the card yet. Each event is only
reminded once (events.reminder_sent_at), so this is safe to run every few
minutes.
"""

import os
from datetime import datetime, timedelta, timezone

from pywebpush import WebPushException, webpush
from run_logger import log_run
from supabase_client import SupabaseClient

REMINDER_WINDOW = timedelta(hours=3)
VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]
VAPID_CLAIMS = {"sub": os.environ["VAPID_SUBJECT"]}
APP_URL = os.environ.get("APP_URL", "https://tipovacka.vercel.app")


def send_to_subscription(db: SupabaseClient, subscription: dict, event_label: str, event_id: str) -> None:
    try:
        webpush(
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]},
            },
            data='{"title": "Blíží se uzávěrka", "body": "%s má uzávěrku už brzy, ještě nemáš dotipováno!", "url": "/events/%s"}'
            % (event_label, event_id),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=dict(VAPID_CLAIMS),
        )
    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (404, 410):
            db.delete("push_subscriptions", {"id": f"eq.{subscription['id']}"})
        else:
            print(f"Push se nepodařilo poslat na {subscription['endpoint']}: {exc}")


def main() -> None:
    db = SupabaseClient()
    now = datetime.now(timezone.utc)

    events = db.select(
        "events",
        {
            "status": "neq.completed",
            "reminder_sent_at": "is.null",
            "lock_at": f"lte.{(now + REMINDER_WINDOW).isoformat()}",
            "select": "id,number,name,lock_at",
        },
    )
    events = [e for e in events if e["lock_at"] and e["lock_at"] >= now.isoformat()]

    if not events:
        print("Žádný galavečer s blížící se uzávěrkou.")
        return

    subscriptions = db.select("push_subscriptions", {"select": "id,user_id,endpoint,p256dh,auth"})
    if not subscriptions:
        print("Nikdo nemá zapnutá push upozornění.")
        return

    for event in events:
        label = f"OKTAGON {event['number']}" if event.get("number") else event["name"]
        with log_run("send_lock_reminders", event["id"]):
            fights = db.select("fights", {"event_id": f"eq.{event['id']}", "select": "id"})
            fight_ids = [f["id"] for f in fights]
            if not fight_ids:
                continue

            predictions = db.select(
                "predictions",
                {"fight_id": f"in.({','.join(fight_ids)})", "select": "user_id,fight_id"},
            )
            predicted_count: dict[str, int] = {}
            for pred in predictions:
                predicted_count[pred["user_id"]] = predicted_count.get(pred["user_id"], 0) + 1

            recipients = [
                sub for sub in subscriptions if predicted_count.get(sub["user_id"], 0) < len(fight_ids)
            ]
            print(f"--- {label}: {len(recipients)} upozornění k odeslání ---")
            for sub in recipients:
                send_to_subscription(db, sub, label, event["id"])

            db.update(
                "events",
                {"reminder_sent_at": now.isoformat()},
                {"id": f"eq.{event['id']}"},
            )


if __name__ == "__main__":
    main()
