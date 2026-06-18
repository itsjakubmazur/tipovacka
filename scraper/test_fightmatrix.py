"""Throwaway probe script: is fightmatrix.com scrapable, and does it have
OKTAGON-tier fighters? Not part of the app - delete after the investigation.
"""

import requests

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

URLS = [
    "https://www.fightmatrix.com/",
    "https://www.fightmatrix.com/fighter-profile/Michael+Page/91794/",
    "https://www.fightmatrix.com/mma-ranks/welterweight/",
    "https://www.fightmatrix.com/search.aspx?qry=Will+Fleury",
]

for url in URLS:
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        print(f"=== {url} -> {resp.status_code} ({len(resp.text)} bytes)")
        print(resp.text[:1500])
        print()
    except Exception as e:
        print(f"=== {url} -> ERROR {e}")
