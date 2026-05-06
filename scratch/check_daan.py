import json
import math

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2) * math.sin(dLat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dLon / 2) * math.sin(dLon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

path = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\ai_review\index.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

import re
match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    
    # Daan District
    center_lat, center_lng = 25.0262, 121.5435
    
    results = []
    for res in data:
        dist = calculate_distance(center_lat, center_lng, res['latitude'], res['longitude'])
        if dist <= 3:
            results.append(res)
    
    levels = {}
    for res in results:
        level = res.get('parent_friendly_level')
        levels[level] = levels.get(level, 0) + 1
    
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    print(f"Results within 3km of Daan District ({len(results)} total):")
    print(json.dumps(levels, indent=4, ensure_ascii=False))
else:
    print("Could not find restaurantData array")
