"""Temporary probe - which Korkmaz matchup is currently live on Sherdog. Delete after investigation."""

from sherdog import parse_event

data = parse_event("https://www.sherdog.com/events/Oktagon-MMA-Oktagon-90-Fleury-vs-Aras-110588")
for fight in data["fights"]:
    a, b = fight["fighter_a"]["name"], fight["fighter_b"]["name"]
    if "Korkmaz" in (a or "") or "Korkmaz" in (b or ""):
        print(f"Live na Sherdogu: {a} vs {b}")
