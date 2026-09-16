"""Kde brát statistiky (údery, takedowny) u starých zápasů?

Náš jediný zdroj je externí tracking (`ESPORTS_EXPORT_URL`), klíčovaný přes
`metadata.esportsId`, a ten podle všeho začíná někde v polovině roku 2024.
Jenže oktagonmma.com ukazuje statistiky i u mnohem starších zápasů - tak se
tady jde zjistit, odkud je bere.

Čistě čtecí sonda, nic nezapisuje. Pouští se přes workflow, protože na
api.oktagonmma.com se z agentího prostředí nedá sáhnout.
"""

import argparse
import json
import re
from collections import Counter

import requests

from oktagon import (
    API_BASE_URL,
    BASE_URL,
    ESPORTS_EXPORT_URL,
    USER_AGENT,
    fetch_json,
)
from supabase_client import SupabaseClient

HEADERS = {"User-Agent": USER_AGENT}


def _get(url: str, **kwargs):
    try:
        return requests.get(url, headers=HEADERS, timeout=30, **kwargs)
    except requests.RequestException as exc:
        print(f"    !! {url} -> {exc}")
        return None


def _short(value, limit: int = 400) -> str:
    text = json.dumps(value, ensure_ascii=False)
    return text if len(text) <= limit else text[:limit] + f"… (+{len(text) - limit} znaků)"


def db_coverage() -> None:
    """Kolik zápasů v které sezóně už má esports id - tj. jestli to staré
    turnaje vůbec mají, nebo jestli je díra opravdu ve zdroji."""
    print("\n=== 1. Co máme v databázi ===")
    db = SupabaseClient()
    events = db.select(
        "events",
        {"select": "id,number,name,event_date,is_archive", "order": "event_date.asc", "limit": "500"},
    )
    by_event = {e["id"]: e for e in events}
    fights = db.select(
        "fights",
        {"select": "id,event_id,oktagon_esports_id,oktagon_fight_id,status", "limit": "5000"},
    )
    per_year: dict[int, Counter] = {}
    for fight in fights:
        event = by_event.get(fight["event_id"])
        if not event:
            continue
        year = int(event["event_date"][:4])
        counter = per_year.setdefault(year, Counter())
        counter["fights"] += 1
        if fight.get("oktagon_esports_id"):
            counter["s_esports_id"] += 1
    stats_rows = db.select("fight_stats", {"select": "fight_id", "limit": "5000"})
    with_stats = {r["fight_id"] for r in stats_rows}
    for fight in fights:
        event = by_event.get(fight["event_id"])
        if event and fight["id"] in with_stats:
            per_year[int(event["event_date"][:4])]["se_statistikami"] += 1

    print(f"{'rok':<6}{'zápasů':>8}{'esports id':>12}{'statistiky':>12}")
    for year in sorted(per_year):
        c = per_year[year]
        print(f"{year:<6}{c['fights']:>8}{c['s_esports_id']:>12}{c['se_statistikami']:>12}")


def api_fight(number: int) -> dict | None:
    """Syrový JSON hlavního zápasu daného turnaje - hlavně kvůli tomu, co je
    v `metadata` a jestli tam náhodou nevisí i něco statistického."""
    print(f"\n=== 2. api.oktagonmma.com: OKTAGON {number} ===")
    events = fetch_json("/events/?limit=500")
    target, prefix = f"oktagon-{number}", f"oktagon-{number}-"
    match = next(
        (
            e
            for e in events
            if any(s == target or s.startswith(prefix) for s in (e.get("slugs") or []))
        ),
        None,
    )
    if not match:
        print("  Turnaj v listingu není.")
        return None
    print(f"  event id={match['id']} slugs={match.get('slugs')}")
    print(f"  klíče eventu: {sorted(match.keys())}")

    cards = fetch_json(f"/events/{match['id']}/fightcard")
    fights = [f for card in cards for f in (card.get("fights") or [])]
    if not fights:
        print("  Karta je prázdná.")
        return None
    fight = fights[0]
    print(f"  hlavní zápas id={fight.get('id')} klíče={sorted(fight.keys())}")
    print(f"  metadata={_short(fight.get('metadata'), 800)}")
    for key in ("statistics", "stats", "matchId", "legacyId", "externalId"):
        if key in fight:
            print(f"  fight.{key}={_short(fight[key])}")
    f1 = fight.get("fighter1") or {}
    print(f"  fighter1 klíče={sorted(f1.keys())}")
    print(f"  fighter1 legacyId={f1.get('legacyId')} id={f1.get('id')} slugs={f1.get('slugs')}")
    return {"event": match, "fight": fight}


def api_probe(fight_id, event_id) -> None:
    """Existuje na jejich API vůbec nějaký statistický endpoint?"""
    print("\n=== 3. Zkusmé endpointy na api.oktagonmma.com ===")
    candidates = [
        f"/fights/{fight_id}",
        f"/fights/{fight_id}/stats",
        f"/fights/{fight_id}/statistics",
        f"/matches/{fight_id}",
        f"/matches/{fight_id}/stats",
        f"/events/{event_id}/statistics",
        f"/events/{event_id}/stats",
    ]
    for path in candidates:
        resp = _get(f"{API_BASE_URL}{path}")
        if resp is None:
            continue
        note = ""
        if resp.status_code == 200:
            try:
                note = " " + _short(resp.json(), 300)
            except ValueError:
                note = f" (nejde o JSON, {len(resp.content)} B)"
        print(f"  {resp.status_code} {path}{note}")


def web_page(slug: str) -> None:
    """Stránka turnaje na oktagonmma.com - odkud si widget se statistikami
    tahá čísla. Hledáme v HTML stopy po jakémkoli id nebo endpointu."""
    print(f"\n=== 4. oktagonmma.com/cs/udalosti/{slug} ===")
    for path in (f"/cs/udalosti/{slug}", f"/udalosti/{slug}", f"/cs/events/{slug}", f"/{slug}"):
        resp = _get(f"{BASE_URL}{path}")
        if resp is None or resp.status_code != 200:
            print(f"  {resp.status_code if resp else '---'} {path}")
            continue
        html = resp.text
        print(f"  200 {path} ({len(html)} znaků)")
        for needle in ("esports", "esportsId", "statistik", "statistics", "takedown", "significant"):
            hits = [m.start() for m in re.finditer(needle, html, re.IGNORECASE)][:3]
            if hits:
                print(f"    '{needle}' {len(hits)}x, okolí prvního výskytu:")
                start = max(0, hits[0] - 200)
                print("      " + html[start : hits[0] + 300].replace("\n", " ")[:480])
        for pattern in (r"esportsId\\?\"?:\s*\\?\"?(\d+)", r"sh12w3[^\"'\\ ]*"):
            found = re.findall(pattern, html)
            if found:
                print(f"    {pattern} -> {sorted(set(found))[:10]}")
        return
    print("  Stránku turnaje se nepovedlo najít.")


def esports_probe(esports_id) -> None:
    print(f"\n=== 5. Tracking systém pro esportsId={esports_id} ===")
    if not esports_id:
        print("  Není co zkusit - zápas žádné esports id nemá.")
        return
    resp = _get(f"{ESPORTS_EXPORT_URL}/matches/{esports_id}")
    if resp is None:
        return
    print(f"  {resp.status_code} /matches/{esports_id}")
    if resp.status_code == 200:
        try:
            payload = resp.json()
        except ValueError:
            print("  Odpověď není JSON.")
            return
        print(f"  klíče={sorted(payload.keys())}")
        for key in ("hits", "takedowns", "submissionAttempts"):
            print(f"  {key}: {len(payload.get(key) or [])}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--number", type=int, default=28, help="číslo OKTAGONu (výchozí 28)")
    args = parser.parse_args()

    db_coverage()
    found = api_fight(args.number)
    if not found:
        return
    fight, event = found["fight"], found["event"]
    api_probe(fight.get("id"), event.get("id"))
    slugs = event.get("slugs") or []
    if slugs:
        web_page(slugs[0])
    esports_probe((fight.get("metadata") or {}).get("esportsId"))


if __name__ == "__main__":
    main()
