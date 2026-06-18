"""Sherdog event page parsing.

Selectors verified against a working scraper for a current Sherdog event
page (Sherdog still uses schema.org itemprop attributes): the full card is
listed in `table.new_table.result tr[itemprop=subEvent]` rows, each with
`div.fighter_list.left` / `div.fighter_list.right` for the two fighters.
"""

import re

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

METHOD_KEYWORDS = {
    "ko": "KO/TKO",
    "tko": "KO/TKO",
    "knockout": "KO/TKO",
    "submission": "SUBMISSION",
    "decision": "DECISION",
    "draw": "DECISION",
}


def normalize_method(raw: str | None) -> str | None:
    text = (raw or "").strip().lower()
    for keyword, method in METHOD_KEYWORDS.items():
        if keyword in text:
            return method
    return None


def slug_from_href(href: str | None) -> str | None:
    if not href:
        return None
    return href.rstrip("/").split("/")[-1]


def fetch_soup(url: str) -> BeautifulSoup:
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "lxml")


def parse_fighter_side(side_el) -> dict:
    name = " ".join(s.get_text(strip=True) for s in side_el.select("span[itemprop=name]"))

    link = side_el.select_one("a[itemprop=url]") or side_el.select_one("a")
    slug = slug_from_href(link.get("href")) if link else None

    img = side_el.select_one("img")
    photo_url = img["src"] if img and img.get("src") else None
    if photo_url and photo_url.startswith("/"):
        photo_url = f"https://www.sherdog.com{photo_url}"

    status_spans = side_el.select("div.fighter_result_data span")
    status = status_spans[1].get_text(strip=True).lower() if len(status_spans) > 1 else ""

    return {
        "name": name or None,
        "slug": slug,
        "photo_url": photo_url,
        "won": status == "win",
    }


def parse_event(url: str) -> dict:
    soup = fetch_soup(url)

    rows = soup.select("table.new_table.result tr[itemprop=subEvent]")

    fights = []
    for row in rows:
        left = row.select_one("div.fighter_list.left")
        right = row.select_one("div.fighter_list.right")
        if not left or not right:
            continue

        fighter_a = parse_fighter_side(left)
        fighter_b = parse_fighter_side(right)
        if not fighter_a["name"] or not fighter_b["name"]:
            continue

        weight_el = row.select_one("span.weight_class")
        weight_class = weight_el.get_text(strip=True) if weight_el else None
        is_title_fight = bool(weight_class) and "title" in weight_class.lower()

        method_el = row.select_one("td.winby b")
        method = normalize_method(method_el.get_text(strip=True)) if method_el else None

        cells = row.select("td")
        round_num = None
        if cells:
            match = re.search(r"\d+", cells[-2].get_text(strip=True))
            if match:
                round_num = int(match.group())

        winner_name = None
        if fighter_a["won"]:
            winner_name = fighter_a["name"]
        elif fighter_b["won"]:
            winner_name = fighter_b["name"]

        fights.append(
            {
                "fighter_a": fighter_a,
                "fighter_b": fighter_b,
                "weight_class": weight_class,
                "is_title_fight": is_title_fight,
                "method": method,
                "round": round_num,
                "winner_name": winner_name,
            }
        )

    # Sherdog lists the main event first; card_order in our DB counts up
    # from the first prelim, so mark it before reversing into that order.
    if fights:
        fights[0]["is_main_event"] = True
    fights.reverse()
    for i, fight in enumerate(fights, start=1):
        fight["card_order"] = i
        fight.setdefault("is_main_event", False)

    print(f"Sherdog parsing nalezl {len(fights)} zápasů na {url}")
    return {"fights": fights}
