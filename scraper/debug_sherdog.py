"""Temporary diagnostic: print structural info about a Sherdog event page
so the correct CSS selectors can be worked out from a real GitHub Actions
run (the page can't be fetched from this sandbox or via WebFetch).

Usage: python debug_sherdog.py --event-id <uuid>
"""

import argparse
import sys

from sherdog import fetch_soup
from supabase_client import SupabaseClient


def main(event_id: str) -> None:
    db = SupabaseClient()
    events = db.select("events", {"id": f"eq.{event_id}", "select": "id,sherdog_event_url"})
    if not events:
        print(f"Event {event_id} nenalezen.")
        sys.exit(1)

    url = events[0]["sherdog_event_url"]
    soup = fetch_soup(url)

    print(f"URL: {url}")
    print(f"title: {soup.title.get_text(strip=True) if soup.title else None}")
    print(f"len(html): {len(str(soup))}")

    for sel in [
        "table",
        "table.new_table",
        "table.new_table.result",
        "tr[itemprop=subEvent]",
        "[itemprop=subEvent]",
        "div.fight_card",
        "div.fighter_list",
        "div.fighter",
        "span[itemprop=name]",
        "[itemprop=name]",
        "a[itemprop=url]",
        ".weight_class",
    ]:
        print(f"select({sel!r}) -> {len(soup.select(sel))}")

    print("--- classes seen on first 30 divs with a class ---")
    seen = set()
    for div in soup.find_all("div", class_=True):
        for c in div.get("class", []):
            seen.add(c)
        if len(seen) > 60:
            break
    print(sorted(seen))

    print("--- first 'vs' text occurrence context ---")
    text = soup.get_text(" ", strip=True)
    idx = text.lower().find(" vs ")
    print(text[max(0, idx - 100): idx + 100])

    print("--- div.fight_card HTML (truncated) ---")
    fc = soup.select_one("div.fight_card")
    print(str(fc)[:3000] if fc else None)

    print("--- first tr[itemprop=subEvent] HTML (truncated) ---")
    rows = soup.select("tr[itemprop=subEvent]")
    print(str(rows[0])[:3000] if rows else None)

    print("--- last tr[itemprop=subEvent] HTML (truncated) ---")
    print(str(rows[-1])[:3000] if rows else None)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()
    main(args.event_id)
