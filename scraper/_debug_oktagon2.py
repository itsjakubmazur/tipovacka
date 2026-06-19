import json

import requests
from sherdog import USER_AGENT

url = "https://oktagonmma.com/_next/data/build-TfctsWXpff2fKS/cs.json"
resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
print(f"status={resp.status_code} len={len(resp.text)}")

data = resp.json()
print("\n--- top-level keys ---")
print(list(data.keys()))
print(list(data.get("pageProps", {}).keys()))


def walk(obj, path="", depth=0, max_depth=6):
    if depth > max_depth:
        return
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                walk(v, f"{path}.{k}", depth + 1, max_depth)
            else:
                if isinstance(v, str) and (
                    "image" in k.lower() or v.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
                ):
                    print(f"{path}.{k} = {v}")
    elif isinstance(obj, list):
        for i, item in enumerate(obj[:3]):
            walk(item, f"{path}[{i}]", depth + 1, max_depth)


print("\n--- image-like fields found by walking the JSON ---")
walk(data)

print("\n--- raw dump of pageProps (first 4000 chars) ---")
print(json.dumps(data.get("pageProps", {}), ensure_ascii=False)[:4000])
