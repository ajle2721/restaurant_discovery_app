import os
import json

directory = 'ai_review'
keywords = ['親子餐廳', '遊戲區', '遊戲室', '球池', '溜滑梯', '決明子', '沙坑', '哺乳室', '尿布台']

parent_child_restaurants = []

for filename in os.listdir(directory):
    if filename.endswith('.json'):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                name = data.get('name', 'Unknown')
                summary = data.get('ai_summary', '')
                evidence = str(data.get('evidence', ''))
                signals = str(data.get('signals', ''))
                
                # Check for keywords
                found_keywords = [k for k in keywords if k in name or k in summary or k in evidence or k in signals]
                
                # Also check if it's explicitly called a parent-child restaurant
                if found_keywords:
                    parent_child_restaurants.append({
                        'name': name,
                        'summary': summary,
                        'keywords': found_keywords,
                        'place_id': data.get('place_id', '')
                    })
            except Exception as e:
                continue

# Sort by name
parent_child_restaurants.sort(key=lambda x: x['name'])

# Output the list
print(f"Found {len(parent_child_restaurants)} potential parent-child restaurants:")
for res in parent_child_restaurants:
    print(f"- {res['name']}: {res['summary']} (Keywords: {', '.join(res['keywords'])})")
