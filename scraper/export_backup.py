"""Dumps the irreplaceable tables (predictions and everything they hang
off) to JSON files in ./backup/, one per table. Run by the db-backup
GitHub Actions workflow, which uploads the folder as an artifact.

Usage:
    python export_backup.py

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
"""

import json
import pathlib

from supabase_client import SupabaseClient

# table -> stable ordering key for pagination (group_members has a
# composite primary key, no surrogate id)
TABLES = {
    "profiles": "id.asc",
    "events": "id.asc",
    "fighters": "id.asc",
    "fights": "id.asc",
    "predictions": "id.asc",
    "bonus_predictions": "id.asc",
    "groups": "id.asc",
    "group_members": "group_id.asc,user_id.asc",
    "event_comments": "id.asc",
}

PAGE_SIZE = 1000


def export_table(db: SupabaseClient, table: str, order: str, out_dir: pathlib.Path) -> int:
    rows: list[dict] = []
    offset = 0
    while True:
        page = db.select(table, {"limit": str(PAGE_SIZE), "offset": str(offset), "order": order})
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    (out_dir / f"{table}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    return len(rows)


def main() -> None:
    db = SupabaseClient()
    out_dir = pathlib.Path("backup")
    out_dir.mkdir(exist_ok=True)
    for table, order in TABLES.items():
        try:
            count = export_table(db, table, order, out_dir)
            print(f"{table}: {count} řádků")
        except Exception as exc:
            # A missing optional table (e.g. before its migration runs)
            # shouldn't sink the whole backup.
            print(f"{table}: export selhal - {exc}")


if __name__ == "__main__":
    main()
