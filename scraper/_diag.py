"""Temporary probe - list scheduled fights for OKTAGON 90 with fighter names. Delete after investigation."""

from supabase_client import SupabaseClient

EVENT_ID = "0b0444f8-ac07-4289-ad86-1e3c50972ad7"

db = SupabaseClient()
fights = db.select(
    "fights",
    {
        "event_id": f"eq.{EVENT_ID}",
        "select": "id,status,fighter_a_id,fighter_b_id,card_order",
        "order": "card_order.desc",
    },
)
fighters = {f["id"]: f for f in db.select("fighters", {"select": "id,name"})}

for f in fights:
    a = fighters.get(f["fighter_a_id"], {}).get("name", "?")
    b = fighters.get(f["fighter_b_id"], {}).get("name", "?")
    print(f"{f['id']}  [{f['status']}]  {a} vs {b}")
