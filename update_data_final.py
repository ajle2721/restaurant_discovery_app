import json, re

# Load all batch results
all_coords = {}
for i in range(1, 6):
    try:
        with open(f'c:/vc/restaurant map/batch_{i}_results.json', 'r', encoding='utf-8') as f:
            batch = json.load(f)
            for item in batch:
                # Use name as key for now, since we extracted based on name/address
                all_coords[item['name']] = item['coords']
    except FileNotFoundError:
        print(f"Warning: batch_{i}_results.json not found")

# Load data.js
with open('c:/vc/restaurant map/data.js', 'r', encoding='utf-8') as f:
    c = f.read()

m = re.search(r'const restaurantData = (\[.*\]);', c, re.DOTALL)
data = json.loads(m.group(1))

# Update missing coordinates
updated_count = 0
for r in data:
    if r.get('latitude') is None:
        name = r['name']
        if name in all_coords:
            r['latitude'] = all_coords[name]['lat']
            r['longitude'] = all_coords[name]['lng']
            updated_count += 1
        else:
            # Try fuzzy matching if name has trailing info like (午晚餐最後點餐時間...)
            # Or if it was shortened in the search
            for k in all_coords:
                if k in name or name in k:
                    r['latitude'] = all_coords[k]['lat']
                    r['longitude'] = all_coords[k]['lng']
                    updated_count += 1
                    break

print(f"Updated {updated_count} restaurants.")

# Write back to data.js
new_js = f"const restaurantData = {json.dumps(data, indent=2, ensure_ascii=False)};\n"
with open('c:/vc/restaurant map/data.js', 'w', encoding='utf-8') as f:
    f.write(new_js)

print("Saved to data.js")
