import re

import requests
from sherdog import USER_AGENT

URL = "https://oktagonmma.com/cs/fantasy/play/"

resp = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=30)
print(f"status={resp.status_code} len={len(resp.text)}")

html = resp.text

print("\n--- <img> tags mentioning fight/event/banner/upload ---")
for m in re.finditer(r"<img[^>]*>", html):
    tag = m.group()
    if re.search(r"fight|event|banner|upload|fantasy", tag, re.I):
        print(tag)

print("\n--- background-image style references ---")
for m in re.finditer(r'background-image:\s*url\([^)]+\)', html):
    print(m.group())

print("\n--- countdown-related markup (search 'countdown', 'timer', 'zbyvajici', 'zbývající') ---")
for m in re.finditer(r'.{80}(countdown|timer|zbyvajici|zbývající).{80}', html, re.I):
    print(m.group())
    print("---")
