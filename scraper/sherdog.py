"""Sherdog event page parsing.

Confirmed against a live event page (OKTAGON 90, via a debug run on the
GitHub Actions runner): the main event is rendered separately from the
rest of the card.

- Main event: `div.fight_card` containing `div.fighter.left_side` /
  `div.fighter.right_side`, with the weight class and "TITLE FIGHT" marker
  in the sibling `div.versus`.
- Rest of the card: `tr[itemprop=subEvent]` rows (NOT scoped under any
  `table.new_table.result` - that selector matches nothing on the real
  page), each with `div.fighter_list.left` / `div.fighter_list.right`.
  The first `<td>` of each row contains Sherdog's own fight-order number
  (counting down from the chronologically last prelim/co-main to "1" for
  the opener), which is more reliable than inferring order from DOM
  position.

A fighter's win/loss is rendered as `span.final_result` with a `win`/
`loss` class once the bout is over; before that it's either absent or
HTML-commented out (`yet to come`), so `won` simply defaults to False.
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


def _photo_url(img) -> str | None:
    if not img:
        return None
    src = img.get("src") or img.get("data-original")
    if not src:
        return None
    if src.startswith("/"):
        src = f"https://www.sherdog.com{src}"
    # Event-listing thumbnails are served at a tiny 44x44 crop
    # (/image_crop/44/44/_images/fighter/<file>); the same source photo is
    # available at 200x300 (confirmed against an individual fighter's own
    # profile page), so request that instead of the postage-stamp default.
    return re.sub(r"/image_crop/\d+/\d+/", "/image_crop/200/300/", src)


def _absolute_url(href: str | None) -> str | None:
    if not href:
        return None
    if href.startswith("/"):
        return f"https://www.sherdog.com{href}"
    return href


def parse_fighter_side(side_el) -> dict:
    """Parses a fighter block, works for both the main-event `div.fighter`
    markup and the sub-event `div.fighter_list` markup."""
    name_el = side_el.select_one("span[itemprop=name]")
    name = name_el.get_text(" ", strip=True) if name_el else None

    link = side_el.select_one("a[itemprop=url]") or side_el.select_one("a")
    slug = slug_from_href(link.get("href")) if link else None
    profile_url = _absolute_url(link.get("href")) if link else None

    photo_url = _photo_url(side_el.select_one("img"))

    result_el = side_el.select_one("span.final_result")
    won = bool(result_el) and "win" in result_el.get("class", [])

    return {
        "name": name or None,
        "slug": slug,
        "profile_url": profile_url,
        "photo_url": photo_url,
        "won": won,
    }


def fetch_fighter_nationality(profile_url: str) -> dict:
    """Nationality/flag only appear on a fighter's own Sherdog profile page
    (e.g. `div.fighter-nationality strong[itemprop=nationality]` + an
    `img.big_flag` whose src ends in `<country-code>.png`), not on the
    event page."""
    soup = fetch_soup(profile_url)

    nat_el = soup.select_one("div.fighter-nationality strong[itemprop=nationality]")
    nationality = nat_el.get_text(strip=True) if nat_el else None

    flag_code = None
    flag_img = soup.select_one("div.fighter-nationality img.big_flag")
    if flag_img:
        match = re.search(r"/([a-z]{2,3})\.png$", flag_img.get("src") or "")
        if match:
            flag_code = match.group(1)

    return {"nationality": nationality, "flag_code": flag_code}


def _winner_name(fighter_a: dict, fighter_b: dict) -> str | None:
    if fighter_a["won"]:
        return fighter_a["name"]
    if fighter_b["won"]:
        return fighter_b["name"]
    return None


def parse_main_event(soup: BeautifulSoup) -> dict | None:
    fc = soup.select_one("div.fight_card")
    if not fc:
        return None

    left = fc.select_one("div.fighter.left_side")
    right = fc.select_one("div.fighter.right_side")
    if not left or not right:
        return None

    fighter_a = parse_fighter_side(left)
    fighter_b = parse_fighter_side(right)
    if not fighter_a["name"] or not fighter_b["name"]:
        return None

    versus = fc.select_one("div.versus")
    weight_el = versus.select_one("span.weight_class") if versus else None
    weight_class = weight_el.get_text(strip=True) if weight_el else None
    is_title_fight = bool(versus and versus.select_one("span.title_fight"))

    return {
        "fighter_a": fighter_a,
        "fighter_b": fighter_b,
        "weight_class": weight_class,
        "is_title_fight": is_title_fight,
        "method": None,
        "round": None,
        "winner_name": _winner_name(fighter_a, fighter_b),
        "is_main_event": True,
    }


def parse_sub_event(row) -> dict | None:
    left = row.select_one("div.fighter_list.left")
    right = row.select_one("div.fighter_list.right")
    if not left or not right:
        return None

    fighter_a = parse_fighter_side(left)
    fighter_b = parse_fighter_side(right)
    if not fighter_a["name"] or not fighter_b["name"]:
        return None

    weight_el = row.select_one("span.weight_class")
    weight_class = weight_el.get_text(strip=True) if weight_el else None
    is_title_fight = bool(row.select_one("span.title_fight"))

    method_el = row.select_one("td.winby b")
    method = normalize_method(method_el.get_text(strip=True)) if method_el else None

    round_num = None
    round_el = row.select_one("td.round")
    if round_el:
        match = re.search(r"\d+", round_el.get_text(strip=True))
        if match:
            round_num = int(match.group())

    order_num = None
    first_cell = row.select_one("td")
    if first_cell:
        match = re.search(r"\d+", first_cell.get_text(strip=True))
        if match:
            order_num = int(match.group())

    return {
        "fighter_a": fighter_a,
        "fighter_b": fighter_b,
        "weight_class": weight_class,
        "is_title_fight": is_title_fight,
        "method": method,
        "round": round_num,
        "winner_name": _winner_name(fighter_a, fighter_b),
        "is_main_event": False,
        "_order_num": order_num,
    }


def parse_event(url: str) -> dict:
    soup = fetch_soup(url)

    sub_fights = []
    for row in soup.select("tr[itemprop=subEvent]"):
        fight = parse_sub_event(row)
        if fight:
            sub_fights.append(fight)

    # Sherdog's own fight-order number (in the row's first <td>) counts
    # down from the bout right before the main event to "1" for the
    # opener - sort by it so card_order comes out ascending.
    sub_fights.sort(key=lambda f: f["_order_num"] if f["_order_num"] is not None else 0)
    for fight in sub_fights:
        del fight["_order_num"]

    main_event = parse_main_event(soup)

    fights = sub_fights + ([main_event] if main_event else [])
    for i, fight in enumerate(fights, start=1):
        fight["card_order"] = i

    print(f"Sherdog parsing nalezl {len(fights)} zápasů na {url}")
    return {"fights": fights}
