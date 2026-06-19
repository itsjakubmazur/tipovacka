"""Shared web push sending helper, used by every script that notifies
users (the cron job's reminders/card/result pushes, and the manual
test-push helper).
"""

import json
import os

from pywebpush import WebPushException, webpush
from supabase_client import SupabaseClient

VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]
VAPID_CLAIMS = {"sub": os.environ["VAPID_SUBJECT"]}


def send_to_subscription(db: SupabaseClient, subscription: dict, title: str, body: str, url: str) -> None:
    try:
        webpush(
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]},
            },
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=dict(VAPID_CLAIMS),
        )
    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (404, 410):
            db.delete("push_subscriptions", {"id": f"eq.{subscription['id']}"})
        else:
            print(f"Push se nepodařilo poslat na {subscription['endpoint']}: {exc}")


def send_to_all(db: SupabaseClient, title: str, body: str, url: str) -> None:
    subscriptions = db.select("push_subscriptions", {"select": "id,endpoint,p256dh,auth"})
    for sub in subscriptions:
        send_to_subscription(db, sub, title, body, url)


def send_to_user(db: SupabaseClient, user_id: str, title: str, body: str, url: str) -> None:
    subscriptions = db.select(
        "push_subscriptions", {"user_id": f"eq.{user_id}", "select": "id,endpoint,p256dh,auth"}
    )
    for sub in subscriptions:
        send_to_subscription(db, sub, title, body, url)
