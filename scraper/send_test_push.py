"""Manual one-off helper: sends a single test push notification to one
user, looked up by their auth email, so you can check what a real
notification looks like without waiting for a real event lock. Run via
the "Test push notification" GitHub Actions workflow (workflow_dispatch).
"""

import argparse

import requests
from push import send_to_subscription
from supabase_client import SupabaseClient


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
        send_to_subscription(
            db, sub, "Testovací upozornění", "Takhle bude vypadat připomínka uzávěrky.", "/events"
        )
        print(f"Posláno na {sub['endpoint']}")


if __name__ == "__main__":
    main()
