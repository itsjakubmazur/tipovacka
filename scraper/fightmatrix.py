"""Fight Matrix scraping: divisional rank + numeric "Points" score per
fighter.

Confirmed against a live event page (OKTAGON 90, via a debug run on the
GitHub Actions runner):

- An event page (`/upcoming-events/<name>/<id>/`) lists `<a href>` links
  to `/fighter-profile/<name>/<id>/` for every fighter on the card, in one
  request - so the whole card's Fight Matrix IDs can be collected without
  guessing/searching per fighter. The link text has a trailing predicted
  rank-point delta in parens (e.g. "Will Fleury(-834)") which is NOT the
  fighter's score and must be stripped.
- A fighter profile page has a `table.tblRank` whose header row is
  "Date | (trend arrows) | Rank | Record | Points" - a ranking history,
  most recent entry first. The same `tblRank` class is reused on event
  pages for the bout-by-bout table ("Bout | Weight" header), so the
  header text is checked to tell them apart.
"""

import re

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

BASE_URL = "https://www.fightmatrix.com"


def fetch_soup(url: str) -> BeautifulSoup:
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "lxml")


def parse_event(url: str) -> list[dict]:
    """Returns [{"name": ..., "profile_url": ...}, ...] for every fighter
    on the card."""
    soup = fetch_soup(url)

    fighters = []
    seen_urls = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "fighter-profile" not in href:
            continue
        profile_url = href if href.startswith("http") else f"{BASE_URL}{href}"
        if profile_url in seen_urls:
            continue
        seen_urls.add(profile_url)

        name = re.sub(r"\([+-]?\d+\)\s*$", "", a.get_text(strip=True)).strip()
        if not name:
            continue
        fighters.append({"name": name, "profile_url": profile_url})

    return fighters


def parse_fighter(url: str) -> dict | None:
    """Returns {"rank": "#11 Welterweight", "score": 947} from the most
    recent row of the fighter's ranking history table, or None if the
    fighter has no ranking history yet."""
    soup = fetch_soup(url)

    for table in soup.find_all("table", class_="tblRank"):
        rows = table.find_all("tr")
        if not rows:
            continue
        header = rows[0].get_text(" ", strip=True)
        if "Date" not in header or "Points" not in header:
            continue
        if len(rows) < 2:
            return None

        cells = rows[1].find_all("td")
        if len(cells) < 5:
            return None

        rank = cells[2].get_text(" ", strip=True)
        points_text = cells[4].get_text(strip=True)
        match = re.search(r"\d+", points_text)
        if not match:
            return None

        return {"rank": rank or None, "score": int(match.group())}

    return None
