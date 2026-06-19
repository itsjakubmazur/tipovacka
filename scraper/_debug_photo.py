import re
import sys

from sherdog import USER_AGENT
import requests

EVENT_URL = "https://www.sherdog.com/events/Oktagon-MMA-Oktagon-90-Fleury-vs-Aras-110588"


def dump_imgs(url, label):
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    print(f"=== {label} ({url}) status={resp.status_code} ===")
    for m in re.finditer(r"<img[^>]*>", resp.text):
        tag = m.group()
        if "fighter" in tag.lower() or "image_crop" in tag.lower() or "profile" in tag.lower():
            print(tag)


dump_imgs(EVENT_URL, "event page")

# find first fighter profile link on the event page
resp = requests.get(EVENT_URL, headers={"User-Agent": USER_AGENT}, timeout=30)
match = re.search(r'href="(/fighter/[^"]+)"', resp.text)
if match:
    profile_url = "https://www.sherdog.com" + match.group(1)
    dump_imgs(profile_url, "fighter profile page")
else:
    print("No fighter profile link found")
