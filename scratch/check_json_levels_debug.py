import os
import json

directory = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\ai_review'
levels = {}

found_any = False
for filename in os.listdir(directory):
    if filename.endswith('.json'):
        found_any = True
        path = os.path.join(directory, filename)
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
                level = data.get('parent_friendly_level')
                levels[level] = levels.get(level, 0) + 1
        except Exception as e:
            print(f"Error reading {filename}: {e}")

import sys
sys.stdout.reconfigure(encoding='utf-8')
if not found_any:
    print(f"No JSON files found in {directory}")
else:
    print(json.dumps(levels, indent=4, ensure_ascii=False))
