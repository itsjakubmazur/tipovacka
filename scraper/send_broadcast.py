"""Sends a one-off push notification, with admin-chosen title/body/url, to
every subscribed user. Triggered from the admin UI ("Poslat upozornění"
section in /admin), which dispatches the "Broadcast push" GitHub Actions
workflow (workflow_dispatch) with the inputs below.
"""

import argparse

from push import send_to_all
from supabase_client import SupabaseClient


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", required=True)
    parser.add_argument("--body", required=True)
    parser.add_argument("--url", default="/")
    args = parser.parse_args()

    db = SupabaseClient()
    send_to_all(db, args.title, args.body, args.url)


if __name__ == "__main__":
    main()
