"""OKTAGON's own backend API (api.oktagonmma.com/v1) - the single source
of truth for fighter bios/photos/records/rankings, card/fight data, and
results. Replaces what used to be split across Sherdog (card + results)
and Fight Matrix (rankings).

Confirmed against live data fetched on a GitHub Actions runner:

- GET /v1/events/ returns a flat, unpaginated list of the ~20 most
  recent/upcoming events, newest first. Each item has an internal numeric
  `id`, a `slugs` array (e.g. ["oktagon-90-berlin"]), and other metadata.
  An OKTAGON event number is looked up by matching `slugs` against
  "oktagon-<number>" or "oktagon-<number>-...".
- GET /v1/events/{id}/fightcard returns a list of "cards" (weight-class
  groupings), each with a `fights` list. The very first card/fight is the
  main event (confirmed against two separate event dumps), so fights are
  flattened in that order and `card_order` is assigned counting down from
  the main event - matching the convention the rest of the app expects
  (highest card_order = main event).
- Each fight has `result` (only once decided): "FIGHTER_1_WIN" |
  "FIGHTER_2_WIN" | "DRAW" | "NO_CONTEST" - there is no separate "winner"
  field. `resultType` ("KO"/"TKO"/"SUB"/"DEC") is only present for
  decisive wins. Draws and no-contests are both treated as our
  "no_contest" status - neither has a winner to grade.
- Each fighter embedded in a fight already carries everything we need:
  name parts, nickname, a profile photo (imageProfile.url) and a
  separately-cropped fight-card photo (imageFightCard.url), a bio
  (description, localized per language, and HTML-formatted - tags/
  entities are stripped before storing), pro MMA record
  (scores.MMA_PROFI), height/native weight class/birth date, an
  ISO-3166-1 alpha-2 nationality code (directly usable as flag_code,
  same convention as the old Sherdog-sourced one), a profile slug, and
  official/P4P rankings (including positionChange, the movement since
  the last update).
- Completed fights also carry `time` - the clock reading at the finish,
  within the deciding round (e.g. "2:26") - distinct from `result_round`.
"""

import html
import re

import requests

from supabase_client import SupabaseClient

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

API_BASE_URL = "https://api.oktagonmma.com/v1"
BASE_URL = "https://oktagonmma.com"

RESULT_TYPE_TO_METHOD = {
    "KO": "KO/TKO",
    "TKO": "KO/TKO",
    "SUB": "SUBMISSION",
    "DEC": "DECISION",
}

COUNTRY_NAMES = {
    "CZ": "Česko",
    "SK": "Slovensko",
    "PL": "Polsko",
    "DE": "Německo",
    "AT": "Rakousko",
    "GB": "Velká Británie",
    "IE": "Irsko",
    "FR": "Francie",
    "NL": "Nizozemsko",
    "BE": "Belgie",
    "ES": "Španělsko",
    "PT": "Portugalsko",
    "IT": "Itálie",
    "RO": "Rumunsko",
    "HU": "Maďarsko",
    "BG": "Bulharsko",
    "HR": "Chorvatsko",
    "RS": "Srbsko",
    "UA": "Ukrajina",
    "RU": "Rusko",
    "TR": "Turecko",
    "GE": "Georgie",
    "KZ": "Kazachstán",
    "BR": "Brazílie",
    "US": "USA",
    "CA": "Kanada",
    "MX": "Mexiko",
    "SE": "Švédsko",
    "NO": "Norsko",
    "FI": "Finsko",
    "DK": "Dánsko",
    "GR": "Řecko",
    "AU": "Austrálie",
    "NZ": "Nový Zéland",
    "ZA": "Jižní Afrika",
    "JP": "Japonsko",
    "CN": "Čína",
    "KR": "Jižní Korea",
    "AZ": "Ázerbájdžán",
    "AM": "Arménie",
    "MD": "Moldavsko",
    "LT": "Litva",
    "LV": "Lotyšsko",
    "EE": "Estonsko",
}


def fetch_json(path: str) -> dict | list:
    resp = requests.get(f"{API_BASE_URL}{path}", headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def find_event_id(number: int) -> int | None:
    """Looks up OKTAGON's internal numeric event id for "OKTAGON <number>"
    by matching its slugs on the /events/ listing (newest events first,
    so this only works for events recent/upcoming enough to still be on
    that list)."""
    events = fetch_json("/events/")
    target = f"oktagon-{number}"
    target_prefix = f"{target}-"
    for item in events:
        for slug in item.get("slugs") or []:
            if slug == target or slug.startswith(target_prefix):
                return item["id"]
    return None


def resolve_event_id(db: SupabaseClient, event: dict) -> int | None:
    """Returns the event's OKTAGON internal id, looking it up by `number`
    and caching it onto the event row the first time so future imports
    skip the listing lookup."""
    if event.get("oktagon_event_id"):
        return event["oktagon_event_id"]
    if not event.get("number"):
        return None

    oktagon_event_id = find_event_id(event["number"])
    if oktagon_event_id:
        db.update("events", {"oktagon_event_id": oktagon_event_id}, {"id": f"eq.{event['id']}"})
    return oktagon_event_id


def _record_label(fighter: dict) -> str | None:
    scores = (fighter.get("scores") or {}).get("MMA_PROFI") or {}
    wins, losses, draws = scores.get("wins"), scores.get("losses"), scores.get("draws")
    if wins is None and losses is None and draws is None:
        return None
    record = f"{wins or 0}-{losses or 0}-{draws or 0}"
    no_contests = scores.get("noContests") or 0
    if no_contests:
        record += f" ({no_contests} NC)"
    return record


def _localized(value: dict | None) -> str | None:
    """OKTAGON keeps several text/image fields as an object keyed by
    language code (cs/de/en/pl/...) - prefer Czech, fall back to whatever
    is there."""
    if not value:
        return None
    text = value.get("cs") or next(iter(value.values()), None)
    return text.strip() if isinstance(text, str) and text.strip() else None


def _strip_html(text: str | None) -> str | None:
    """Fighter bios come as HTML (<p>, <strong>, &nbsp;, ...) - this app
    has nowhere that renders HTML, so flatten it to plain text."""
    if not text:
        return None
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def _rank_change(fighter: dict) -> int | None:
    """How many spots a fighter moved since the last ranking update -
    checked on the official ranking entry first, falling back to the
    P4P one, since only one of them reliably carries `positionChange`."""
    for ranking in fighter.get("rankings") or []:
        if ranking.get("type") == "OFFICIAL" and isinstance(ranking.get("positionChange"), int):
            return ranking["positionChange"]
    for ranking in fighter.get("otherRankings") or []:
        if ranking.get("type") == "P4P" and isinstance(ranking.get("positionChange"), int):
            return ranking["positionChange"]
    return None


def _birth_date(fighter: dict) -> str | None:
    year, month, day = fighter.get("yearOfBirth"), fighter.get("monthOfBirth"), fighter.get("dayOfBirth")
    if not (year and month and day):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def _rank_label(fighter: dict) -> str | None:
    if fighter.get("champion"):
        return "Šampion"
    if fighter.get("interimChampion"):
        return "Interim šampion"
    for ranking in fighter.get("rankings") or []:
        if ranking.get("type") == "OFFICIAL":
            position = ranking.get("position")
            if position == "champion":
                return "Šampion"
            if isinstance(position, int):
                return f"#{position}"
    for ranking in fighter.get("otherRankings") or []:
        if ranking.get("type") == "P4P" and isinstance(ranking.get("position"), int):
            return f"P4P #{ranking['position']}"
    return None


def normalize_fighter(fighter: dict) -> dict:
    name = f"{(fighter.get('firstName') or '').strip()} {(fighter.get('lastName') or '').strip()}".strip()
    code = fighter.get("nationality")
    weight_class = fighter.get("weightClass") or {}
    slugs = fighter.get("slugs") or ([] if not fighter.get("slug") else [fighter["slug"]])

    return {
        "oktagon_fighter_id": fighter["id"],
        "name": name,
        "nickname": (fighter.get("nickName") or "").strip() or None,
        "photo_url": _localized((fighter.get("imageProfile") or {}).get("url")),
        "fight_card_photo_url": _localized((fighter.get("imageFightCard") or {}).get("url")),
        "bio": _strip_html(_localized(fighter.get("description"))),
        "record": _record_label(fighter),
        "nationality": COUNTRY_NAMES.get(code, code) if code else None,
        "flag_code": code.lower() if code else None,
        "height_cm": fighter.get("heightCm"),
        "weight_kg": weight_class.get("weightKg"),
        "birth_date": _birth_date(fighter),
        "oktagon_rank": _rank_label(fighter),
        "oktagon_rank_change": _rank_change(fighter),
        "oktagon_slug": slugs[0] if slugs else None,
    }


def normalize_fight(fight: dict, index: int, total: int) -> dict:
    result = fight.get("result")
    status = "scheduled"
    winner_side = None
    method = None
    result_round = None
    result_time = None

    if result in ("DRAW", "NO_CONTEST"):
        status = "no_contest"
    elif result == "FIGHTER_1_WIN":
        status, winner_side = "completed", "a"
    elif result == "FIGHTER_2_WIN":
        status, winner_side = "completed", "b"

    if status == "completed":
        method = RESULT_TYPE_TO_METHOD.get(fight.get("resultType"))
        if method and method != "DECISION":
            result_round = fight.get("numRounds")
        result_time = fight.get("time") or None

    return {
        "oktagon_fight_id": fight["id"],
        "fighter_a": normalize_fighter(fight["fighter1"]),
        "fighter_b": normalize_fighter(fight["fighter2"]),
        "weight_class": (fight.get("weightClass") or {}).get("title"),
        "is_title_fight": bool(fight.get("titleFight")),
        "is_main_event": index == 0,
        "card_order": total - index,
        "status": status,
        "winner_side": winner_side,
        "method": method,
        "result_round": result_round,
        "result_time": result_time,
    }


def fetch_fightcard(oktagon_event_id: int) -> list[dict]:
    """Flattens every card's fights into one list, in the API's own order
    (main event first), and normalizes each into our internal shape."""
    cards = fetch_json(f"/events/{oktagon_event_id}/fightcard")
    raw_fights = [fight for card in cards for fight in card.get("fights", [])]
    total = len(raw_fights)
    return [normalize_fight(fight, i, total) for i, fight in enumerate(raw_fights)]


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
