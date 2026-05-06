import json
import re

path = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\ai_review\index.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# index.js starts with 'const restaurantData = '
# We need to extract the array part.
# It might be very large, so let's be careful.
match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
if match:
    data_str = match.group(1)
    # The JSON might have some trailing commas or something if it's not perfect JSON
    # But usually it is.
    try:
        data = json.loads(data_str)
        levels = {}
        for res in data:
            level = res.get('parent_friendly_level')
            levels[level] = levels.get(level, 0) + 1
        import sys
        sys.stdout.reconfigure(encoding='utf-8')
        print(json.dumps({repr(k): v for k, v in levels.items()}, indent=4, ensure_ascii=False))
    except Exception as e:
        print(f"Error parsing JSON: {e}")
else:
    print("Could not find restaurantData array")
