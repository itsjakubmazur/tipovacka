"""Sherdog event page parsing.

Sherdog's markup has stayed fairly stable for years (it carries
schema.org itemprop attributes for SEO), but it does shift occasionally
and there's no official API, so this is best-effort: it tries a couple
of selector variants and prints what it found so a broken selector is
easy to spot from the GitHub Actions log rather than failing silently.
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


def parse_fighter(fighter_el) -> dict:
    name_el = fighter_el.select_one("[itemprop=name]") or fighter_el.select_one("a")
    name = name_el.get_text(strip=True) if name_el else None

    link = fighter_el.select_one("a[href*='/fighters/']")
    slug = slug_from_href(link["href"]) if link else None

    img = fighter_el.select_one("img")
    photo_url = img["src"] if img and img.get("src") else None
    if photo_url and photo_url.startswith("/"):
        photo_url = f"https://www.sherdog.com{photo_url}"

    classes = fighter_el.get("class") or []
    won = "win" in classes or "winner" in classes

    return {"name": name, "slug": slug, "photo_url": photo_url, "won": won}


def parse_event(url: str) -> dict:
    soup = fetch_soup(url)

    rows = soup.select("tr[itemprop=subEvent]")
    if not rows:
        rows = soup.select("div.fight_card .card_item, div.fight_card li")

    fights = []
    for row in rows:
        fighter_els = row.select("div.fighter, div.fighter_result")
        if len(fighter_els) != 2:
            continue

        fighter_a = parse_fighter(fighter_els[0])
        fighter_b = parse_fighter(fighter_els[1])
        if not fighter_a["name"] or not fighter_b["name"]:
            continue

        weight_el = row.select_one(".weight_class, .weight")
        weight_class = weight_el.get_text(strip=True) if weight_el else None

        title_text = row.get_text(" ", strip=True).lower()
        is_title_fight = "title" in title_text

        winby_el = row.select_one(".winby, .win_type, .footer .sub_line")
        method = normalize_method(winby_el.get_text(" ", strip=True)) if winby_el else None

        round_el = row.select_one(".round")
        round_num = None
        if round_el:
            match = re.search(r"\d+", round_el.get_text())
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
    # from the first prelim, so reverse and mark the last one as main event.
    fights.reverse()
    for i, fight in enumerate(fights, start=1):
        fight["card_order"] = i
    if fights:
        fights[-1]["is_main_event"] = True
    for fight in fights:
        fight.setdefault("is_main_event", False)

    print(f"Sherdog parsing nalezl {len(fights)} zápasů na {url}")
    return {"fights": fights}
