import os
import json

directory = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\ai_review'
levels = {}

for filename in os.listdir(directory):
    if filename.endswith('.json'):
        path = os.path.join(directory, filename)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                level = data.get('parent_friendly_level')
                levels[level] = levels.get(level, 0) + 1
        except:
            pass

import sys
sys.stdout.reconfigure(encoding='utf-8')
print(json.dumps(levels, indent=4, ensure_ascii=False))
