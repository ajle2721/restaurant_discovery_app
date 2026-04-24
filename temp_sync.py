import json
import os
import re

data_js_path = 'data.js'
ai_review_dir = 'ai_review'

# Read existing data.js
with open(data_js_path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Extract json
json_str = re.sub(r'^const restaurantData = ', '', content).strip()
json_str = re.sub(r';$', '', json_str)

data = json.loads(json_str)

count = 0
for restaurant in data:
    place_id = restaurant.get('place_id')
    if not place_id:
        continue
    
    ai_file = os.path.join(ai_review_dir, f"{place_id}.json")
    if os.path.exists(ai_file):
        with open(ai_file, 'r', encoding='utf-8-sig') as f:
            ai_data = json.load(f)
            
        attrs = restaurant.get('attributes', {})
        
        # update attributes safely
        child_seat = ai_data.get(' child_seat available', {}).get('result', '').lower()
        if not child_seat:
            child_seat = ai_data.get('child_seat available', {}).get('result', '').lower()
            
        spacious = ai_data.get('Spacious seating', {}).get('result', '').lower()
        if not spacious:
            spacious = ai_data.get('spacious_seating', {}).get('result', '').lower()
            
        kids_menu = ai_data.get('Kids menu available', {}).get('result', '').lower()
        if not kids_menu:
            kids_menu = ai_data.get('kids_menu', {}).get('result', '').lower()
            
        noise = ai_data.get('kid_noise_tolerant', {}).get('result', '').lower()
        
        if child_seat: attrs['high_chair_available'] = child_seat
        if spacious: attrs['spacious_seating'] = spacious
        if kids_menu: attrs['kids_menu'] = kids_menu
        if noise: attrs['kid_noise_tolerant'] = noise
        
        restaurant['attributes'] = attrs
        restaurant['parent_friendly_score'] = ai_data.get('parent_friendly_score', 0)
        restaurant['parent_friendly_level'] = ai_data.get('parent_friendly_level', '資訊不足')
        restaurant['signals'] = ai_data.get('generated_signals', [])
        restaurant['ai_summary'] = ai_data.get('generated_summary', '')
        
        count += 1

# Write back
new_content = "const restaurantData = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n"
with open(data_js_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Successfully synced {count} restaurants to data.js using Python.")
