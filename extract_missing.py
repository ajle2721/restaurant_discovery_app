import json, re

with open('c:/vc/restaurant map/data.js', 'r', encoding='utf-8') as f:
    c = f.read()

m = re.search(r'const restaurantData = (\[.*\]);', c, re.DOTALL)
data = json.loads(m.group(1))

missing = []
for r in data:
    if r.get('latitude') is None:
        missing.append({
            'name': r['name'],
            'address': r.get('formatted_address', ''),
            'place_id': r.get('place_id', '')
        })

with open('c:/vc/restaurant map/missing_restaurants.json', 'w', encoding='utf-8') as f:
    json.dump(missing, f, ensure_ascii=False, indent=2)

print(f"Found {len(missing)} missing restaurants.")
