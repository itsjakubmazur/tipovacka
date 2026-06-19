import re

import requests
from sherdog import USER_AGENT

resp = requests.get("https://oktagonmma.com/cs/turnaje/", headers={"User-Agent": USER_AGENT}, timeout=30)
html = resp.text
print(f"turnaje list status={resp.status_code} len={len(html)}")

print("\n--- links containing turnaje/oktagon (sample) ---")
links = set(re.findall(r'href="(/cs/[^"]*(?:turnaj|oktagon)[^"]*)"', html, re.I))
for href in list(links)[:20]:
    print(href)

print("\n--- og:image on listing page ---")
for m in re.finditer(r'<meta[^>]+(?:og:image|twitter:image)[^>]*>', html, re.I):
    print(m.group())

# try to fetch one specific event detail page if we found a link
candidates = [h for h in links if re.search(r"\d", h)] or list(links)
if candidates:
    detail_url = "https://oktagonmma.com" + candidates[0]
    resp2 = requests.get(detail_url, headers={"User-Agent": USER_AGENT}, timeout=30)
    print(f"\n--- detail page {detail_url} status={resp2.status_code} len={len(resp2.text)} ---")
    for m in re.finditer(r'<meta[^>]+(?:og:image|twitter:image)[^>]*>', resp2.text, re.I):
        print(m.group())
    imgs = re.findall(r"<img[^>]*>", resp2.text)
    print(f"img tag count: {len(imgs)}")
    for tag in imgs[:15]:
        print(tag)
else:
    print("No candidate event links found")
