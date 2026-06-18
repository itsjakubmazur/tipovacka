"""Temporary probe - inspect a Sherdog fighter profile page for
nationality/flag markup. Delete after investigation."""

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

URL = "https://www.sherdog.com/fighter/Will-Fleury-149881"

resp = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=30)
resp.raise_for_status()
soup = BeautifulSoup(resp.text, "lxml")

print("--- imgs with 'flag' in class or src ---")
for img in soup.find_all("img"):
    cls = " ".join(img.get("class", []))
    src = img.get("src", "")
    if "flag" in cls.lower() or "flag" in src.lower():
        print(repr(img), "| parent:", repr(img.parent)[:300])

print("--- elements with 'nation' in class ---")
for el in soup.find_all(class_=lambda c: c and "nation" in " ".join(c).lower()):
    print(repr(el)[:500])

print("--- bio_fighter / fighter-info block ---")
bio = soup.select_one("div.bio_fighter") or soup.select_one("div.fighter-info")
if bio:
    print(bio.prettify()[:3000])
