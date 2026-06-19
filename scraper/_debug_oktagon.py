import re

import requests
from sherdog import USER_AGENT

URL = "https://oktagonmma.com/cs/fantasy/play/"

resp = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=30)
html = resp.text
print(f"status={resp.status_code} len={len(html)}")

print("\n--- ALL <img> tags ---")
for m in re.finditer(r"<img[^>]*>", html):
    print(m.group())

print("\n--- _next/image occurrences ---")
for m in set(re.findall(r'/_next/image[^"\'\s)]*', html)):
    print(m)

print("\n--- <picture>/<source> tags ---")
for m in re.finditer(r"<(picture|source)[^>]*>", html):
    print(m.group())

print("\n--- raw snippet around 'fight' (first 5) ---")
count = 0
for m in re.finditer(r'.{60}fight.{60}', html, re.I):
    print(m.group())
    print("---")
    count += 1
    if count >= 5:
        break
