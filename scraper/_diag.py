"""Temporary probe - list events. Delete after investigation."""

from supabase_client import SupabaseClient

db = SupabaseClient()
events = db.select("events", {"select": "id,number,name,sherdog_event_url", "order": "event_date.desc"})
for e in events:
    print(e)
