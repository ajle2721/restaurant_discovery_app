import json
import re

data_js_path = r'c:\Users\jason\OneDrive\桌面\restaurant map\data.js'

with open(data_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
if not match:
    print("Could not find restaurantData array")
    exit(1)

data = json.loads(match.group(1))

total = len(data)
with_attrs = [x for x in data if x.get("attributes") and any(x["attributes"].values())]
with_summary = [x for x in data if x.get("ai_summary") and len(x["ai_summary"]) > 10]

print(f"Total restaurants: {total}")
print(f"Restaurants with at least one 'true' tag: {len(with_attrs)}")
print(f"Restaurants with AI summary: {len(with_summary)}")

# Sample check
if total > 0:
    print("\nSample (Last entry):")
    last = data[-1]
    print(f"Name: {last.get('name')}")
    print(f"Attributes: {last.get('attributes')}")
    print(f"Summary: {last.get('ai_summary')}")
    print(f"Signals: {last.get('signals')}")
