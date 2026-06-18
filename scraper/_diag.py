"""Temporary fix - cancel the stale Korkmaz vs Smielowski fight (opponent
pulled out, replaced by Said-Khusein Akhyadov on Sherdog). Delete after use."""

from supabase_client import SupabaseClient

STALE_FIGHT_ID = "9506415d-5281-4d8c-bb72-b6af5b11ad42"

db = SupabaseClient()
db.update("fights", {"status": "cancelled"}, {"id": f"eq.{STALE_FIGHT_ID}"})
affected = db.select("predictions", {"fight_id": f"eq.{STALE_FIGHT_ID}", "select": "id"})
print(f"Zápas {STALE_FIGHT_ID} zrušen. Zasaženo tipů: {len(affected)}.")
