import re

import requests
from sherdog import USER_AGENT

URL = "https://oktagonmma.com/cs/fantasy/play/"

resp = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=30)
html = resp.text
print(f"status={resp.status_code} len={len(html)}")

print("\n--- any URL ending in image extension ---")
for m in set(re.findall(r'https?://[^\s"\'\\]+\.(?:jpg|jpeg|png|webp|avif)', html, re.I)):
    print(m)

print("\n--- relative-path image-ish strings (uploads/media/cdn) ---")
for m in set(re.findall(r'["\']([^"\']*(?:uploads|media|cdn|images)[^"\']*\.(?:jpg|jpeg|png|webp|avif))["\']', html, re.I)):
    print(m)

print("\n--- keys that look like banner/poster/thumbnail/cover ---")
for m in re.finditer(r'"(banner|poster|thumbnail|cover|image|eventImage|fightCard)"\s*:\s*"([^"]{0,200})"', html, re.I):
    print(m.group())

print("\n--- __NEXT_DATA__ present? ---")
print("__NEXT_DATA__" in html, "application/json" in html)

print("\n--- script src list (first 20) ---")
for m in re.findall(r'<script[^>]+src="([^"]+)"', html)[:20]:
    print(m)
