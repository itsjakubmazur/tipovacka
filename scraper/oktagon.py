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

# Per-fight tracking stats (hits, takedowns, submission attempts) do NOT live
# on api.oktagonmma.com - oktagonmma.com's own fight-statistics widget pulls
# them from this third-party tracking system, keyed by `metadata.esportsId`.
# It is somebody else's domain with no SLA towards OKTAGON, the data only goes
# back to roughly mid-2024, and any single fight may simply not be there - so
# every caller has to survive it returning nothing.
ESPORTS_EXPORT_URL = "https://oktagon.sh12w3.esports.cz/api/export"

OUTCOME_BY_RESULT = {
    ("FIGHTER_1_WIN", "a"): "win",
    ("FIGHTER_1_WIN", "b"): "loss",
    ("FIGHTER_2_WIN", "a"): "loss",
    ("FIGHTER_2_WIN", "b"): "win",
    ("DRAW", "a"): "draw",
    ("DRAW", "b"): "draw",
    ("NO_CONTEST", "a"): "no_contest",
    ("NO_CONTEST", "b"): "no_contest",
}

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


def _event_number(item: dict) -> int | None:
    """Extracts the OKTAGON event number from `slugs` (e.g.
    ["oktagon-90-berlin"] -> 90). Items with no "oktagon-<number>" slug
    aren't numbered fight cards - e.g. weigh-ins/press conferences tied
    to a numbered event, or unrelated shows like the Tipsport Cage Game -
    and are skipped by the caller."""
    for slug in item.get("slugs") or []:
        match = re.match(r"oktagon-(\d+)(-.*)?$", slug)
        if match:
            return int(match.group(1))
    return None


def _location_label(item: dict) -> str | None:
    location = item.get("location") or {}
    venue = _localized(location.get("name"))
    city = _localized(location.get("city"))
    return ", ".join(p for p in (venue, city) if p) or None


def _normalize_billing(text: str) -> str:
    """OKTAGON writes fight billings in all caps ("ENGIZEK VS. JOTKO 2").
    Title-case those for display; leave an already mixed-case title
    (usually a host city like "Brno") untouched."""
    letters = [c for c in text if c.isalpha()]
    if letters and all(c.isupper() for c in letters):
        words = []
        for word in text.split():
            if word.lower() in ("vs", "vs."):
                words.append("vs.")
            else:
                words.append(word[:1].upper() + word[1:].lower())
        return " ".join(words)
    return text


def _extract_subtitle(title: str | None, number: int) -> str | None:
    """The official subtitle OKTAGON puts after the number in the event
    title - the main-event billing ("Engizek vs. Jotko 2") when one is
    announced, otherwise the host city ("Brno"). None when the title is
    just the number."""
    if not title:
        return None
    match = re.match(rf"^\s*OKTAGON\s+{number}\s*[:\-–—]?\s*(.*)$", title, re.IGNORECASE)
    remainder = (match.group(1) if match else "").strip()
    return _normalize_billing(remainder) if remainder else None


def fetch_upcoming_tournaments() -> list[dict]:
    """The /events/ listing also includes non-fightcard entries (weigh-ins,
    press conferences, unrelated shows) - only `type == "TOURNAMENT"`
    entries with a parseable "oktagon-<number>" slug are actual numbered
    fight cards worth auto-creating an event for."""
    items = fetch_json("/events/")
    tournaments = []
    for item in items:
        if item.get("type") != "TOURNAMENT":
            continue
        number = _event_number(item)
        if number is None:
            continue
        tournaments.append(
            {
                "oktagon_event_id": item["id"],
                "number": number,
                "name": _localized(item.get("title")) or _localized(item.get("shortTitle")) or f"OKTAGON {number}",
                "subtitle": _extract_subtitle(_localized(item.get("title")), number),
                "event_date": item.get("startDate"),
                "location": _location_label(item),
            }
        )
    return tournaments


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
    # No-contests are left out on purpose. They are a statistical curiosity,
    # not something anyone weighs up when tipping, and the suffix pushed the
    # record onto a second line in the tale of the tape between the fighters -
    # which knocked every row under it out of alignment.
    return f"{wins or 0}-{losses or 0}-{draws or 0}"


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


def normalize_fighter(fighter: dict | None) -> dict:
    # Fights are sometimes posted before both opponents are confirmed -
    # OKTAGON's API just omits the fighter1/fighter2 key entirely for the
    # unannounced side, instead of a placeholder object.
    if fighter is None:
        return {
            "oktagon_fighter_id": None,
            "oktagon_legacy_id": None,
            "name": "TBA",
            "nickname": None,
            "photo_url": None,
            "fight_card_photo_url": None,
            "bio": None,
            "record": None,
            "nationality": None,
            "flag_code": None,
            "height_cm": None,
            "weight_kg": None,
            "birth_date": None,
            "oktagon_rank": None,
            "oktagon_rank_change": None,
            "oktagon_slug": None,
            "is_tba": True,
        }

    name = f"{(fighter.get('firstName') or '').strip()} {(fighter.get('lastName') or '').strip()}".strip()
    code = fighter.get("nationality")
    weight_class = fighter.get("weightClass") or {}
    slugs = fighter.get("slugs") or ([] if not fighter.get("slug") else [fighter["slug"]])

    return {
        "oktagon_fighter_id": fighter["id"],
        # Only fighters carried over from OKTAGON's previous system have this;
        # anyone signed since roughly 2024 has no legacyId at all. It is the
        # join key towards the external stats system, nothing else.
        "oktagon_legacy_id": fighter.get("legacyId"),
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
        "is_tba": False,
    }


def _card_segment(card_title: str | None) -> str:
    """Maps a card's title (e.g. "MAIN CARD", "PRELIMS", "FREE PRELIMS",
    "HEAVYWEIGHT TITLE FIGHT") to our three broadcast segments. Title-fight
    cards have no "PRELIM" in their title, so they fall into main_card -
    they're headliners, not a separate segment."""
    title = (card_title or "").upper()
    if "FREE" in title and "PRELIM" in title:
        return "free_prelims"
    if "PRELIM" in title:
        return "prelims"
    return "main_card"


def normalize_fight(fight: dict, index: int, total: int, card_segment: str) -> dict:
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
        result_time = parse_end_time(fight.get("time"))

    return {
        "oktagon_fight_id": fight["id"],
        "fighter_a": normalize_fighter(fight.get("fighter1")),
        "fighter_b": normalize_fighter(fight.get("fighter2")),
        "weight_class": (fight.get("weightClass") or {}).get("title"),
        "is_title_fight": bool(fight.get("titleFight")),
        "is_main_event": index == 0,
        "card_order": total - index,
        "card_segment": card_segment,
        "status": status,
        "winner_side": winner_side,
        "method": method,
        "result_round": result_round,
        "result_time": result_time,
        "oktagon_esports_id": (fight.get("metadata") or {}).get("esportsId"),
    }


def parse_end_time(value: object) -> str | None:
    """The clock reading at the finish. OKTAGON changed formats somewhere
    along the way: recent fights carry "3:14", older ones the raw number of
    seconds as a string ("227" on the OKTAGON 1 card). Both end up as M:SS."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if ":" in text:
        return text
    try:
        seconds = int(text)
    except ValueError:
        return None
    return f"{seconds // 60}:{seconds % 60:02d}"


def fetch_fighter_history(oktagon_fighter_id: int) -> list[dict]:
    """Every OKTAGON fight of one fighter, newest first, in a single request -
    no paging, and the upcoming (undecided) fight is included. Confirmed
    against two fighters with 7 and 16 fights going back to 2016."""
    data = fetch_json(f"/fights?fighterId={oktagon_fighter_id}")
    return data if isinstance(data, list) else []


def normalize_history_fight(fight: dict, oktagon_fighter_id: int) -> dict | None:
    """One past fight as seen FROM THIS FIGHTER'S SIDE. Returns None for
    anything that isn't a finished fight of theirs.

    A fight that hasn't happened yet has no `result` key at all (not a null
    one), which is also how the upcoming bout gets filtered out here."""
    result = fight.get("result")
    if not result:
        return None

    fighter_1 = fight.get("fighter1") or {}
    fighter_2 = fight.get("fighter2") or {}
    if fighter_1.get("id") == oktagon_fighter_id:
        side, opponent = "a", fighter_2
    elif fighter_2.get("id") == oktagon_fighter_id:
        side, opponent = "b", fighter_1
    else:
        return None

    outcome = OUTCOME_BY_RESULT.get((result, side))
    if not outcome:
        return None

    event = fight.get("event") or {}
    event_label = _localized(event.get("shortTitle")) or _localized(event.get("title"))
    start_date = event.get("startDate")
    if not (event_label and start_date):
        return None

    opponent_name = (
        f"{(opponent.get('firstName') or '').strip()} {(opponent.get('lastName') or '').strip()}".strip()
    )
    slugs = opponent.get("slugs") or ([] if not opponent.get("slug") else [opponent["slug"]])

    return {
        "oktagon_fight_id": fight["id"],
        "event_date": start_date,
        "event_label": event_label,
        "event_number": _event_number(event),
        "opponent_name": opponent_name or "TBA",
        "opponent_oktagon_fighter_id": opponent.get("id"),
        "opponent_slug": slugs[0] if slugs else None,
        "opponent_photo_url": _localized((opponent.get("imageProfile") or {}).get("url")),
        "outcome": outcome,
        # Raw, not mapped onto our three-way `method`: in a history list the
        # difference between a KO and a TKO is information, not noise.
        "result_type": fight.get("resultType"),
        # OKTAGON calls this `numRounds`, but it is the round the fight ENDED
        # in - a decision over three rounds and a submission in round three
        # both say 3. Verified against a card where finishes in round one all
        # read 1 while the five-round title fight read 5.
        "end_round": fight.get("numRounds"),
        "end_time": parse_end_time(fight.get("time")),
        "title_fight": bool(fight.get("titleFight")),
        "weight_class": (fight.get("weightClass") or {}).get("title"),
    }


def fetch_match_stats(esports_match_id: int) -> dict | None:
    """Per-fight tracking data from the external system. Returns None for
    anything but a 200 - a missing fight there is the normal case, not an
    error worth failing an import over."""
    try:
        resp = requests.get(
            f"{ESPORTS_EXPORT_URL}/matches/{esports_match_id}",
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
    except requests.RequestException as exc:
        print(f"Statistiky zápasu {esports_match_id} se nepodařilo stáhnout: {exc}")
        return None
    if resp.status_code != 200:
        return None
    try:
        return resp.json()
    except ValueError:
        return None


def _normalized_name(value: str | None) -> str:
    return " ".join((value or "").split()).casefold()


def _stats_side_map(
    payload: dict,
    fighter_a: dict,
    fighter_b: dict,
) -> dict[int, str] | None:
    """Maps the tracking system's own fighter ids onto our a/b sides.

    Its `externalId` is OKTAGON's `legacyId`, which fighters signed in the
    last couple of years simply don't have - so names are the fallback. If
    neither matches, we give up rather than guess from the ordering and
    silently attribute every punch to the wrong man."""
    sides: dict[int, str] = {}
    for key in ("fighter1", "fighter2"):
        entry = payload.get(key) or {}
        entry_id = entry.get("id")
        if entry_id is None:
            return None
        name = _normalized_name(f"{entry.get('firstname') or ''} {entry.get('lastname') or ''}")
        external_id = entry.get("externalId")
        for side, ours in (("a", fighter_a), ("b", fighter_b)):
            legacy_id = ours.get("oktagon_legacy_id")
            if (external_id is not None and external_id == legacy_id) or (
                name and name == _normalized_name(ours.get("name"))
            ):
                sides[entry_id] = side
                break
        else:
            return None
    return sides if len(set(sides.values())) == 2 else None


def summarize_match_stats(payload: dict, fighter_a: dict, fighter_b: dict) -> dict | None:
    """Totals (and a per-round breakdown) of what the tracking system logged:
    every individual hit, takedown and submission attempt of the fight.

    `fighter_a`/`fighter_b` are our own rows - name plus oktagon_legacy_id -
    and decide which side each logged event belongs to."""
    sides = _stats_side_map(payload, fighter_a, fighter_b)
    if not sides:
        return None

    def blank() -> dict[str, int]:
        return {
            "hits": 0,
            "significant_hits": 0,
            "takedowns": 0,
            "takedown_attempts": 0,
            "submission_attempts": 0,
        }

    totals = {"a": blank(), "b": blank()}
    per_round: dict[int, dict[str, dict[str, int]]] = {}

    def bucket(entry: dict) -> tuple[dict[str, int], dict[str, int]] | None:
        attacker_id = (entry.get("attacker") or {}).get("id")
        side = sides.get(attacker_id)
        if side is None:
            return None
        round_no = entry.get("matchRound")
        if not isinstance(round_no, int):
            return totals[side], blank()
        slot = per_round.setdefault(round_no, {"a": blank(), "b": blank()})
        return totals[side], slot[side]

    for hit in payload.get("hits") or []:
        # The only value seen in real payloads is "landed"; the field name
        # implies others exist, so anything explicitly defended is not a hit.
        if hit.get("result") == "defended":
            continue
        target = bucket(hit)
        if not target:
            continue
        for counter in target:
            counter["hits"] += 1
            if hit.get("type") == "significant":
                counter["significant_hits"] += 1

    for takedown in payload.get("takedowns") or []:
        target = bucket(takedown)
        if not target:
            continue
        for counter in target:
            counter["takedown_attempts"] += 1
            if takedown.get("result") == "completed":
                counter["takedowns"] += 1

    for attempt in payload.get("submissionAttempts") or []:
        target = bucket(attempt)
        if not target:
            continue
        for counter in target:
            counter["submission_attempts"] += 1

    row = {"esports_match_id": payload.get("id")}
    for side in ("a", "b"):
        for key, value in totals[side].items():
            row[f"fighter_{side}_{key}"] = value
    row["rounds"] = [
        {"round": round_no, "a": slot["a"], "b": slot["b"]}
        for round_no, slot in sorted(per_round.items())
    ]
    return row


def fetch_betting_odds(oktagon_event_id: int) -> dict[int, dict]:
    """GET /events/{id}/fightcard/betting returns a dict keyed by OKTAGON's
    fight id (matching `oktagon_fight_id`), each with `oddsFighter1`/
    `oddsFighter2` (decimal odds, same fighter1/fighter2 order as
    /fightcard) plus Tipsport affiliate links we don't currently use."""
    data = fetch_json(f"/events/{oktagon_event_id}/fightcard/betting")
    return {
        int(fight_id): {
            "odds_fighter_a": entry.get("oddsFighter1"),
            "odds_fighter_b": entry.get("oddsFighter2"),
        }
        for fight_id, entry in data.items()
    }


def fetch_fightcard(oktagon_event_id: int) -> list[dict]:
    """Flattens every card's fights into one list, in the API's own order
    (main event first), and normalizes each into our internal shape."""
    cards = fetch_json(f"/events/{oktagon_event_id}/fightcard")
    raw_fights = [
        (fight, _card_segment((card.get("title") or {}).get("cs")))
        for card in cards
        for fight in card.get("fights", [])
    ]
    total = len(raw_fights)
    return [
        normalize_fight(fight, i, total, segment) for i, (fight, segment) in enumerate(raw_fights)
    ]


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
    if not event.get("number"):
        return

    url = fetch_event_cover_image_url(event["number"])
    # Only overwrite when a real, different URL comes back - a missing
    # image (event not on the homepage yet) must never wipe the one we
    # already have. This runs on every card recheck, so a new poster
    # (e.g. after a main-event change) replaces the stale one.
    if url and url != event.get("image_url"):
        db.update("events", {"image_url": url}, {"id": f"eq.{event_id}"})
        print(f"Titulní obrázek {'aktualizován' if event.get('image_url') else 'doplněn'}: {url}")
    elif not url and not event.get("image_url"):
        print("Titulní obrázek na oktagonmma.com nenalezen (událost možná ještě není na homepage).")
