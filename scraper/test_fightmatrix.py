"""Throwaway probe script: structure of Fight Matrix's upcoming-events
listing page (can we find an event's own page URL by name?). Not part of
the app - delete after the investigation.
"""

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

URL = "https://www.fightmatrix.com/upcoming-events/"

resp = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=30)
print(f"{URL} -> {resp.status_code} ({len(resp.text)} bytes)")
soup = BeautifulSoup(resp.text, "lxml")

print("\n--- links containing 'upcoming-events/' ---")
for a in soup.find_all("a", href=True):
    if "upcoming-events" in a["href"] and a["href"].rstrip("/") != URL.rstrip("/"):
        print(a["href"], "|", a.get_text(" ", strip=True))

print("\n--- tables ---")
for i, table in enumerate(soup.find_all("table")):
    rows = table.find_all("tr")
    print(f"table[{i}] rows={len(rows)} class={table.get('class')} id={table.get('id')}")
    for row in rows[:6]:
        print("   row:", row.get_text(" | ", strip=True)[:250])
