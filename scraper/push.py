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


def log_push(
    db: SupabaseClient,
    *,
    kind: str,
    title: str,
    body: str,
    recipients: int,
    event_id: str | None = None,
) -> None:
    """Records one *campaign* in push_log - a single row per send, not per
    device. Several notifications are loops of send_to_user (each tipper gets
    their own tally), so the loop logs itself once at the end instead of
    flooding the table.

    Never let bookkeeping break a send: the push already went out by the time
    we get here, so a failure to log is printed and swallowed."""
    try:
        db.insert(
            "push_log",
            [
                {
                    "kind": kind,
                    "event_id": event_id,
                    "title": title,
                    "body": body,
                    "recipients": recipients,
                }
            ],
        )
    except Exception as exc:  # noqa: BLE001 - logging must never abort a send
        print(f"Zápis do push_log selhal ({kind}): {exc}")


def send_to_all(
    db: SupabaseClient,
    title: str,
    body: str,
    url: str,
    pref: str | None = None,
    exclude_user_ids: set[str] | None = None,
    *,
    kind: str,
    event_id: str | None = None,
) -> int:
    """Broadcast to every subscription. Pass a profiles boolean column
    name (e.g. "notify_card_updates") as `pref` to skip users who turned
    that notification category off in their profile. Pass
    `exclude_user_ids` to skip specific users (e.g. authors of the
    messages a "new kecárna messages" push is about).

    `kind` is keyword-only and required so a new broadcast can't be added
    without also showing up in the admin's notification checklist. Returns the
    number of people (not devices) reached."""
    subscriptions = db.select("push_subscriptions", {"select": "id,endpoint,p256dh,auth,user_id"})
    if pref is not None:
        allowed = {p["id"] for p in db.select("profiles", {pref: "eq.true", "select": "id"})}
        subscriptions = [s for s in subscriptions if s["user_id"] in allowed]
    if exclude_user_ids:
        subscriptions = [s for s in subscriptions if s["user_id"] not in exclude_user_ids]
    for sub in subscriptions:
        send_to_subscription(db, sub, title, body, url)
    recipients = len({s["user_id"] for s in subscriptions})
    log_push(db, kind=kind, title=title, body=body, recipients=recipients, event_id=event_id)
    return recipients


def send_to_user(db: SupabaseClient, user_id: str, title: str, body: str, url: str) -> None:
    subscriptions = db.select(
        "push_subscriptions", {"user_id": f"eq.{user_id}", "select": "id,endpoint,p256dh,auth"}
    )
    for sub in subscriptions:
        send_to_subscription(db, sub, title, body, url)
