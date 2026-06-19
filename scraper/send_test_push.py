"""Manual one-off helper: sends every push notification type cron.py can
send - card online, card changed, lock reminder, results done - to one
user (looked up by their auth email), using the exact same titles/bodies
the real cron job would send. Lets you review the wording without
waiting for any of those conditions to actually happen. Run via the
"Test push notification" GitHub Actions workflow (workflow_dispatch).
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


def sample_event(db: SupabaseClient) -> dict:
    events = db.select(
        "events", {"select": "id,number,name", "order": "event_date.desc", "limit": "1"}
    )
    if events:
        return events[0]
    return {"id": "00000000-0000-0000-0000-000000000000", "number": 99, "name": "OKTAGON 99"}


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

    event = sample_event(db)
    label = f"OKTAGON {event['number']}" if event.get("number") else event["name"]
    event_url = f"/events/{event['id']}"

    notifications = [
        (f"{label}: karta je online", "Zápasy byly zveřejněny, můžeš tipovat!", event_url),
        (f"{label}: karta se změnila", "Na zápasové kartě nastala změna, zkontroluj a tipuj!", event_url),
        (f"{label} za hodinu začíná", "Nezapomeň dotipovat a mrkni na dnešní kartu!", event_url),
        (
            f"{label}: výsledky jsou hotové",
            "Galavečer byl vyhodnocen, mrkni na výsledky tipovačky!",
            f"/leaderboard?eventId={event['id']}",
        ),
    ]

    for title, body, url in notifications:
        for sub in subscriptions:
            send_to_subscription(db, sub, title, body, url)
        print(f"Posláno: {title}")


if __name__ == "__main__":
    main()
