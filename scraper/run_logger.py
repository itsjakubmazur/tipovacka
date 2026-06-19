"""Logs each scraper invocation to the scraper_runs table so failures show
up in the admin UI instead of only in GitHub Actions logs.
"""

from contextlib import contextmanager
from datetime import datetime, timezone

from supabase_client import SupabaseClient


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
        db.update(
            "scraper_runs",
            {
                "status": "error",
                "message": f"exit code {exc.code}",
                "finished_at": datetime.now(timezone.utc).isoformat(),
            },
            {"id": f"eq.{row['id']}"},
        )
        raise
    except Exception as exc:
        db.update(
            "scraper_runs",
            {
                "status": "error",
                "message": str(exc),
                "finished_at": datetime.now(timezone.utc).isoformat(),
            },
            {"id": f"eq.{row['id']}"},
        )
        raise
    else:
        db.update(
            "scraper_runs",
            {"status": "success", "finished_at": datetime.now(timezone.utc).isoformat()},
            {"id": f"eq.{row['id']}"},
        )
