import json
import os

updates = [
    {
        "name": "樂雅樂餐廳 敦化店",
        "tags": {"child_seat": "yes", "kids_menu": "yes"}
    },
    {
        "name": "Creative Pasta 創義麵 士林店",
        "tags": {"child_seat": "yes"}
    },
    {
        "name": "Second Floor 貳樓南港車站店",
        "tags": {"child_seat": "yes", "spacious_seating": "yes", "kids_menu": "yes", "kid_noise_tolerant": "yes"}
    },
    {
        "name": "Second Floor 貳樓西湖店",
        "tags": {"child_seat": "yes", "spacious_seating": "yes", "kids_menu": "yes", "kid_noise_tolerant": "yes"}
    },
    {
        "name": "陶板屋 台北重慶南店",
        "tags": {"child_seat": "yes"}
    },
    {
        "name": "陶板屋 新北投光明店",
        "tags": {"child_seat": "yes", "kids_menu": "yes"}
    },
    {
        "name": "欣葉小聚 南港店",
        "tags": {"child_seat": "yes"}
    },
    {
        "name": "欣葉台菜 信義新天地A9店",
        "tags": {"child_seat": "yes"}
    },
    {
        "name": "樂子the Diner 南港店",
        "tags": {"child_seat": "yes", "kids_menu": "yes", "kid_noise_tolerant": "yes"}
    },
    {
        "name": "樂子the Diner 瑞安店",
        "tags": {"child_seat": "yes", "kids_menu": "yes", "kid_noise_tolerant": "yes"}
    }
]

# Load index to find place_ids
with open('ai_review/index.js', 'r', encoding='utf-8') as f:
    content = f.read()
json_str = content.replace('const restaurantData = ', '').rstrip(';')
data = json.loads(json_str)

name_to_id = {}
for item in data:
    # Some names in index.js might have slight variations or long descriptions
    # We'll use a partial match for '樂子the Diner' since it has long suffixes
    name_to_id[item['name']] = item['place_id']

# Map updates to place_ids
for update in updates:
    target_name = update['name']
    place_id = None
    
    # Direct match first
    if target_name in name_to_id:
        place_id = name_to_id[target_name]
    else:
        # Partial match for "樂子the Diner" and "欣葉小聚"
        for name, pid in name_to_id.items():
            if target_name in name:
                place_id = pid
                break
    
    if not place_id:
        print(f"Warning: Could not find place_id for {target_name}")
        continue
    
    file_path = f"ai_review/{place_id}.json"
    if not os.path.exists(file_path):
        print(f"Warning: File not found {file_path}")
        continue
        
    with open(file_path, 'r', encoding='utf-8') as f:
        review = json.load(f)
    
    # Apply tags
    score_change = False
    tags = update['tags']
    
    if 'child_seat' in tags:
        key = " child_seat available" if " child_seat available" in review else "child_seat available"
        if key not in review: key = " child_seat available" # default
        review[key] = {"result": "Yes", "evidence": "Manual update", "confidence": 1.0}
        score_change = True
        
    if 'spacious_seating' in tags:
        review["Spacious seating"] = {"result": "Yes", "evidence": "Manual update", "confidence": 1.0}
        score_change = True
        
    if 'kids_menu' in tags:
        review["Kids menu available"] = {"result": "Yes", "evidence": "Manual update", "confidence": 1.0}
        score_change = True
        
    if 'kid_noise_tolerant' in tags:
        review["kid_noise_tolerant"] = {"result": "Yes", "evidence": "Manual update", "confidence": 1.0}
        score_change = True
    
    # Recalculate score and level
    pos_signals = 0
    if review.get(" child_seat available", {}).get("result") == "Yes": pos_signals += 1
    elif review.get("child_seat available", {}).get("result") == "Yes": pos_signals += 1
    if review.get("Spacious seating", {}).get("result") == "Yes": pos_signals += 1
    if review.get("Kids menu available", {}).get("result") == "Yes": pos_signals += 1
    if review.get("kid_noise_tolerant", {}).get("result") == "Yes": pos_signals += 1
    
    review["parent_friendly_score"] = pos_signals
    if pos_signals >= 3:
        review["parent_friendly_level"] = "高"
    elif pos_signals >= 1:
        review["parent_friendly_level"] = "中"
    else:
        review["parent_friendly_level"] = "資訊不足"
        
    review["reason"] = "手動更新資料"
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(review, f, ensure_ascii=False, indent=4)
    
    print(f"Updated {target_name} ({place_id}) - Score: {pos_signals}")

print("All updates complete.")
