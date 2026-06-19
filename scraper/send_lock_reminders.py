"""Run by a scheduled GitHub Action (every 15 min): finds events whose
lock_at falls within the next hour and haven't been reminded about yet,
and sends a web push notification to every subscribed user - regardless
of whether they've already tipped, since it's also meant to flag any
short-notice changes to the card. Each event is only reminded once
(events.reminder_sent_at).
"""

import os
from datetime import datetime, timedelta, timezone

from pywebpush import WebPushException, webpush
from run_logger import log_run
from supabase_client import SupabaseClient

REMINDER_WINDOW = timedelta(hours=1)
VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]
VAPID_CLAIMS = {"sub": os.environ["VAPID_SUBJECT"]}


def send_to_subscription(db: SupabaseClient, subscription: dict, event_label: str, event_id: str) -> None:
    try:
        webpush(
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]},
            },
            data=(
                '{"title": "%s za hodinu začíná", '
                '"body": "Nezapomeň dotipovat a mrkni na kartu, jestli nedošlo k short-notice změně.", '
                '"url": "/events/%s"}' % (event_label, event_id)
            ),
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
        print("Žádný galavečer s uzávěrkou v příští hodině.")
        return

    subscriptions = db.select("push_subscriptions", {"select": "id,user_id,endpoint,p256dh,auth"})
    if not subscriptions:
        print("Nikdo nemá zapnutá push upozornění.")
        return

    for event in events:
        label = f"OKTAGON {event['number']}" if event.get("number") else event["name"]
        with log_run("send_lock_reminders", event["id"]):
            print(f"--- {label}: {len(subscriptions)} upozornění k odeslání ---")
            for sub in subscriptions:
                send_to_subscription(db, sub, label, event["id"])

            db.update(
                "events",
                {"reminder_sent_at": now.isoformat()},
                {"id": f"eq.{event['id']}"},
            )


if __name__ == "__main__":
    main()
