"""Fetch the official event cover image from oktagonmma.com.

OKTAGON's website is a Next.js app; its homepage embeds the upcoming
event (including a coverImage URL) in a server-rendered JSON endpoint
at /_next/data/<buildId>/cs.json. The buildId changes on every deploy,
so we scrape it fresh from the homepage HTML instead of hardcoding it.
"""

import re

import requests

from sherdog import USER_AGENT
from supabase_client import SupabaseClient

BASE_URL = "https://oktagonmma.com"


def _fetch_build_id() -> str:
    resp = requests.get(f"{BASE_URL}/cs", headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    match = re.search(r'"buildId":"([^"]+)"', resp.text)
    if not match:
        raise RuntimeError("Nepodařilo se najít buildId na oktagonmma.com.")
    return match.group(1)


def fetch_event_cover_image_url(number: int) -> str | None:
    """Best-effort lookup of the cover image for "OKTAGON <number>" in the
    homepage's embedded event data. Returns None if not found - e.g. the
    event isn't (yet) the one featured on the homepage - callers should
    treat a missing image as non-fatal and retry later."""
    build_id = _fetch_build_id()
    resp = requests.get(
        f"{BASE_URL}/_next/data/{build_id}/cs.json",
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    resp.raise_for_status()
    queries = resp.json()["pageProps"]["dehydratedState"]["queries"]

    target = f"OKTAGON {number}"
    for query in queries:
        data = query.get("state", {}).get("data")
        items = data if isinstance(data, list) else [data] if isinstance(data, dict) else []
        for item in items:
            if not isinstance(item, dict):
                continue
            title = item.get("shortTitle") or {}
            if isinstance(title, dict) and title.get("cs", "").strip() == target:
                cover = item.get("coverImage") or {}
                url = cover.get("url") or {}
                return url.get("cs") or next(iter(url.values()), None)
    return None


def import_image(event_id: str) -> None:
    db = SupabaseClient()
    events = db.select("events", {"id": f"eq.{event_id}", "select": "id,number,image_url"})
    if not events:
        return
    event = events[0]
    if event.get("image_url") or not event.get("number"):
        return

    url = fetch_event_cover_image_url(event["number"])
    if url:
        db.update("events", {"image_url": url}, {"id": f"eq.{event_id}"})
        print(f"Titulní obrázek doplněn: {url}")
    else:
        print("Titulní obrázek na oktagonmma.com nenalezen (událost možná ještě není na homepage).")
