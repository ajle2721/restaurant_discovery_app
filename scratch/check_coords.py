import json
import re

path = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\ai_review\index.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    for res in data:
        if res.get('parent_friendly_level') == '高':
            print(f"Name: {res.get('name')}")
            print(f"Lat: {res.get('latitude')}, Lng: {res.get('longitude')}")
            break
else:
    print("Could not find restaurantData array")
