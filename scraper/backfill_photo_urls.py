"""One-off: upgrade already-stored fighter photo_urls from Sherdog's tiny
44x44 event-listing crop to the 200x300 crop (same source photo, just a
bigger crop - see sherdog.py's _photo_url). Only old rows need this; new
imports already get the bigger crop straight from sherdog.py.

Usage: python backfill_photo_urls.py
"""

import re

from supabase_client import SupabaseClient


def main() -> None:
    db = SupabaseClient()
    fighters = db.select("fighters", {"select": "id,photo_url", "photo_url": "not.is.null"})

    updated = 0
    for fighter in fighters:
        new_url = re.sub(r"/image_crop/\d+/\d+/", "/image_crop/200/300/", fighter["photo_url"])
        if new_url != fighter["photo_url"]:
            db.update("fighters", {"photo_url": new_url}, {"id": f"eq.{fighter['id']}"})
            updated += 1

    print(f"Hotovo, aktualizováno {updated} z {len(fighters)} fotek.")


if __name__ == "__main__":
    main()
