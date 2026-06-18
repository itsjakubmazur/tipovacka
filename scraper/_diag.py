"""Temporary diagnostic script - checks whether expected columns exist.
Delete after investigation."""

from supabase_client import SupabaseClient

db = SupabaseClient()

print("--- events: id,number,fightmatrix_event_url ---")
try:
    print(db.select("events", {"select": "id,number,fightmatrix_event_url", "limit": "1"}))
except Exception as e:
    print("FAILED:", e)

print("--- fighters: id,name,record,fightmatrix_rank,fightmatrix_score ---")
try:
    print(db.select("fighters", {"select": "id,name,record,fightmatrix_rank,fightmatrix_score", "limit": "1"}))
except Exception as e:
    print("FAILED:", e)
