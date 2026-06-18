"""Throwaway probe script: how is rank/score structured on fightmatrix.com,
and does it have OKTAGON-tier fighters? Not part of the app - delete after
the investigation.
"""

import re

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def get(url):
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    return resp


def dump_forms(soup, label):
    print(f"--- forms on {label} ---")
    for form in soup.find_all("form"):
        print("action=", form.get("action"), "method=", form.get("method"))
        for inp in form.find_all(["input", "select"]):
            print("   input:", inp.get("name"), inp.get("type"), inp.get("value"))


# 1. Homepage - find the search form
resp = get("https://www.fightmatrix.com/")
soup = BeautifulSoup(resp.text, "lxml")
dump_forms(soup, "homepage")

# 2. Fighter profile page - find rank/score elements
resp = get("https://www.fightmatrix.com/fighter-profile/Michael+Page/91794/")
soup = BeautifulSoup(resp.text, "lxml")
print("\n--- fighter profile: elements mentioning rank/score/elo ---")
for el in soup.find_all(string=re.compile(r"rank|score|elo|rating", re.I)):
    text = el.strip()
    if text:
        print(repr(text[:120]))

print("\n--- fighter profile: tables ---")
for i, table in enumerate(soup.find_all("table")):
    rows = table.find_all("tr")
    print(f"table[{i}] rows={len(rows)} class={table.get('class')} id={table.get('id')}")
    if rows:
        print("   first row text:", rows[0].get_text(" | ", strip=True)[:200])
        if len(rows) > 1:
            print("   2nd row text:", rows[1].get_text(" | ", strip=True)[:200])

# 3. Division ranks page - structure of the list
resp = get("https://www.fightmatrix.com/mma-ranks/welterweight/")
soup = BeautifulSoup(resp.text, "lxml")
print("\n--- welterweight ranks: tables ---")
for i, table in enumerate(soup.find_all("table")):
    rows = table.find_all("tr")
    print(f"table[{i}] rows={len(rows)} class={table.get('class')} id={table.get('id')}")
    if len(rows) > 2:
        print("   header:", rows[0].get_text(" | ", strip=True)[:200])
        print("   row1:", rows[1].get_text(" | ", strip=True)[:200])
        print("   row2:", rows[2].get_text(" | ", strip=True)[:200])
