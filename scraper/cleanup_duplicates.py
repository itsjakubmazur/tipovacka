"""One-off cleanup: the first live import_card.py run created 2 duplicate
fights for OKTAGON 90 because the manually-seeded fighter names used
diacritics ("Matěj Peňáz", "Gökhan Aksu") that don't match Sherdog's plain
ASCII names ("Matej Penaz", "Gokhan Aksu"). Keeps the original seeded
fighter (already referenced elsewhere), attaches the sherdog_slug learned
from the duplicate, then deletes the duplicate fight + duplicate fighter.

Run once, then delete this file.
"""

from supabase_client import SupabaseClient

# (fight_id_to_delete, fighter_id_to_delete, fighter_id_to_keep, slug_to_attach)
DUPLICATES = [
    (
        "2b475950-d1b9-4733-b8f5-cec9ae0b40f3",
        "0dc7d112-55fe-443d-9280-31afff2c1621",
        "79f1645c-383a-4714-984d-80a566be9979",
        "Matej-Penaz-370929",
    ),
    (
        "a73ac85a-c45a-4db4-9433-0c7925805b9e",
        "a0d52459-ed87-4df4-89e2-9ef2a016ec57",
        "f73d91dd-c401-4a7b-a887-a6f6819f6f94",
        "Gokhan-Aksu-133593",
    ),
]


def main() -> None:
    db = SupabaseClient()
    for fight_id, fighter_to_delete, fighter_to_keep, slug in DUPLICATES:
        db.delete("fights", {"id": f"eq.{fight_id}"})
        db.delete("fighters", {"id": f"eq.{fighter_to_delete}"})
        db.update("fighters", {"sherdog_slug": slug}, {"id": f"eq.{fighter_to_keep}"})
        print(f"Smazán duplicitní zápas {fight_id} a zápasník {fighter_to_delete}, "
              f"doplněn sherdog_slug={slug} k {fighter_to_keep}.")


if __name__ == "__main__":
    main()
