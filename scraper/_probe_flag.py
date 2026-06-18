"""Temporary probe - inspect Sherdog event page HTML for nationality/flag
markup. Delete after investigation."""

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

URL = "https://www.sherdog.com/events/Oktagon-MMA-Oktagon-90-Fleury-vs-Aras-110588"

resp = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=30)
resp.raise_for_status()
soup = BeautifulSoup(resp.text, "lxml")

print("--- imgs with 'flag' in class or src, near fighter blocks ---")
for img in soup.find_all("img"):
    cls = " ".join(img.get("class", []))
    src = img.get("src", "")
    if "flag" in cls.lower() or "flag" in src.lower():
        print(repr(img))

print("--- first fighter_list block full HTML ---")
fl = soup.select_one("div.fighter_list.left")
if fl:
    print(fl.prettify()[:2000])

print("--- first fight_card fighter.left_side full HTML ---")
fc = soup.select_one("div.fighter.left_side")
if fc:
    print(fc.prettify()[:2000])
