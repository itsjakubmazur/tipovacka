"""Run by the scheduled GitHub Action: finds events that have already
started (lock_at in the past) but aren't marked completed yet, and tries
to pull results for each. Safe to run repeatedly - import_results() is a
no-op if Sherdog hasn't published results yet, and skips fights that are
already completed.
"""

from datetime import datetime, timezone

from import_results import import_results
from run_logger import log_run
from supabase_client import SupabaseClient


def main() -> None:
    db = SupabaseClient()
    now = datetime.now(timezone.utc).isoformat()

    events = db.select(
        "events",
        {
            "status": "neq.completed",
            "lock_at": f"lt.{now}",
            "sherdog_event_url": "not.is.null",
            "select": "id,number,name",
        },
    )

    if not events:
        print("Žádné odemčené/neukončené galavečery k aktualizaci.")
        return

    for event in events:
        label = f"OKTAGON {event['number']}" if event.get("number") else event["name"]
        print(f"--- {label} ({event['id']}) ---")
        try:
            with log_run("scheduled_results", event["id"]):
                import_results(event["id"])
        except SystemExit:
            print(f"Import výsledků pro {label} selhal, pokračuji dalším galavečerem.")


if __name__ == "__main__":
    main()
