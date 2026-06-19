"""Manual one-off helper: sends a single test push notification to one
user, looked up by their auth email, so you can check what a real
notification looks like without waiting for a real event lock. Run via
the "Test push notification" GitHub Actions workflow (workflow_dispatch).
"""

import argparse
import os

import requests
from pywebpush import WebPushException, webpush
from supabase_client import SupabaseClient

VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]
VAPID_CLAIMS = {"sub": os.environ["VAPID_SUBJECT"]}


def find_user_id_by_email(db: SupabaseClient, email: str) -> str:
    page = 1
    while True:
        resp = requests.get(
            f"{db.url}/auth/v1/admin/users",
            headers=db.headers,
            params={"page": page, "per_page": 200},
        )
        resp.raise_for_status()
        users = resp.json().get("users", [])
        if not users:
            break
        for user in users:
            if user.get("email", "").lower() == email.lower():
                return user["id"]
        page += 1
    raise SystemExit(f"Uživatel s e-mailem {email} nebyl nalezen.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    args = parser.parse_args()

    db = SupabaseClient()
    user_id = find_user_id_by_email(db, args.email)

    subscriptions = db.select(
        "push_subscriptions", {"user_id": f"eq.{user_id}", "select": "id,endpoint,p256dh,auth"}
    )
    if not subscriptions:
        raise SystemExit(f"Uživatel {args.email} nemá zapnutá push upozornění.")

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data='{"title": "Testovací upozornění", "body": "Takhle bude vypadat připomínka uzávěrky.", "url": "/events"}',
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=dict(VAPID_CLAIMS),
            )
            print(f"Posláno na {sub['endpoint']}")
        except WebPushException as exc:
            print(f"Nepodařilo se poslat na {sub['endpoint']}: {exc}")


if __name__ == "__main__":
    main()
