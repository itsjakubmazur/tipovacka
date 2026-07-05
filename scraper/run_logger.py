"""Logs each scraper invocation to the scraper_runs table so failures show
up in the admin UI instead of only in GitHub Actions logs. Also pushes an
alert to admins when the same mode fails several times in a row, so a
broken scraper doesn't go unnoticed until gala night.
"""

from contextlib import contextmanager
from datetime import datetime, timezone

from supabase_client import SupabaseClient

FAILURE_ALERT_STREAK = 3


def _alert_admins_on_streak(db: SupabaseClient, mode: str, message: str) -> None:
    """Sends admins a one-time push when the latest FAILURE_ALERT_STREAK
    runs of `mode` all failed. Fires only on exactly the streak-opening
    failure (the run before the streak succeeded or doesn't exist), so a
    long-broken scraper doesn't re-alert on every 5-minute tick."""
    runs = db.select(
        "scraper_runs",
        {
            "mode": f"eq.{mode}",
            "status": "neq.running",
            "order": "started_at.desc",
            "limit": str(FAILURE_ALERT_STREAK + 1),
            "select": "status",
        },
    )
    streak = [r["status"] for r in runs[:FAILURE_ALERT_STREAK]]
    if len(streak) < FAILURE_ALERT_STREAK or any(s != "error" for s in streak):
        return
    if len(runs) > FAILURE_ALERT_STREAK and runs[FAILURE_ALERT_STREAK]["status"] == "error":
        return

    # Imported here, not at module top - push.py requires VAPID env vars
    # at import time, which admin/debug scripts using log_run may not have.
    from push import send_to_user

    admins = db.select("profiles", {"is_admin": "eq.true", "select": "id"})
    for admin in admins:
        send_to_user(
            db,
            admin["id"],
            f"Scraper selhává: {mode}",
            f"Posledních {FAILURE_ALERT_STREAK} běhů skončilo chybou. {message}"[:180],
            "/admin/scraper-log",
        )


@contextmanager
def log_run(mode: str, event_id: str | None = None):
    db = SupabaseClient()
    row = db.insert(
        "scraper_runs",
        [{"mode": mode, "event_id": event_id, "status": "running"}],
    )[0]

    try:
        yield
    except SystemExit as exc:
        message = f"exit code {exc.code}"
        db.update(
            "scraper_runs",
            {
                "status": "error",
                "message": message,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            },
            {"id": f"eq.{row['id']}"},
        )
        try:
            _alert_admins_on_streak(db, mode, message)
        except Exception as alert_exc:
            print(f"Nepodařilo se poslat alert adminům: {alert_exc}")
        raise
    except Exception as exc:
        message = str(exc)
        db.update(
            "scraper_runs",
            {
                "status": "error",
                "message": message,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            },
            {"id": f"eq.{row['id']}"},
        )
        try:
            _alert_admins_on_streak(db, mode, message)
        except Exception as alert_exc:
            print(f"Nepodařilo se poslat alert adminům: {alert_exc}")
        raise
    else:
        db.update(
            "scraper_runs",
            {"status": "success", "finished_at": datetime.now(timezone.utc).isoformat()},
            {"id": f"eq.{row['id']}"},
        )
