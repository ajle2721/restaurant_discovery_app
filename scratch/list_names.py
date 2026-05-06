import json
import os

path = 'ai_review/index.js'
if not os.path.exists(path):
    print(f"File not found: {path}")
    exit(1)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

json_str = content.replace('const restaurantData = ', '').rstrip(';')
data = json.loads(json_str)

names = sorted([item['name'] for item in data])
for name in names:
    print(name)
