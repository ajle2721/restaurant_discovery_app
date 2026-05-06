import json
import os

# Load the combined data from index.js
index_path = 'ai_review/index.js'
with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()
    # Strip the variable declaration
    start = content.find('[')
    end = content.rfind(']') + 1
    restaurants = json.loads(content[start:end])

keywords = ['親子餐廳', '遊戲區', '遊戲室', '球池', '溜滑梯', '沙坑', '決明子', '哺乳室', '尿布台']

found_list = []
for res in restaurants:
    name = res.get('name', '')
    summary = res.get('ai_summary', '')
    signals = res.get('signals', [])
    if isinstance(signals, list):
        signals_text = ' '.join(signals)
    else:
        signals_text = str(signals)
        
    full_text = f"{name} {summary} {signals_text}"
    
    matched = [k for k in keywords if k in full_text]
    if matched:
        found_list.append({
            'name': name,
            'summary': summary,
            'features': list(set(matched))
        })

found_list.sort(key=lambda x: x['name'])

print(f"找到 {len(found_list)} 間具備親子/遊戲空間特徵的餐廳：")
for item in found_list:
    print(f"- {item['name']}")
    print(f"  摘要：{item['summary']}")
    print(f"  特點：{', '.join(item['features'])}")
    print("-" * 30)
