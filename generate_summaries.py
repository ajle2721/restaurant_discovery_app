import csv
import json
import os
import re

base_dir = r"c:\Users\jason\OneDrive\桌面\restaurant map"
ai_review_dir = os.path.join(base_dir, "ai_review")
csv_path = os.path.join(base_dir, "aggregated_restaurants.csv")
output_path = os.path.join(base_dir, "data.js")

# Map of internal attribute keys to user-friendly short phrases (2-6 chars)
SIGNAL_MAPPING = {
    "high_chair_available": "嬰兒椅",
    "kids_menu": "兒童餐",
    "spacious_seating": "寬敞空間",
    "kid_noise_tolerant": "童噪友善",
}

# Common positive signals to look for in reviews (simple keyword matching for MVP)
REVIEW_KEYWORDS = {
    "球池": "球池遊戲區",
    "溜滑梯": "溜滑梯",
    "尿布台": "尿布台",
    "哺乳室": "哺乳室",
    "沙坑": "沙坑遊戲",
    "畫筆": "提供畫具",
    "玩具": "豐富玩具",
    "草地": "戶外草地",
    "推車": "推車友善",
    "友善": "店員親切",
}

def generate_ai_summary(attributes, name):
    """Generates a natural, idiomatic Chinese summary based on attributes."""
    has_chair = attributes.get("high_chair_available")
    has_menu = attributes.get("kids_menu")
    has_space = attributes.get("spacious_seating")
    has_noise = attributes.get("kid_noise_tolerant")

    parts = []
    # Handling facilities vs environment naturally
    if has_chair and has_menu:
        parts.append("貼心準備了嬰兒椅與兒童餐，對帶小孩的爸媽來說非常方便")
    elif has_chair:
        parts.append("備有嬰兒椅，用餐環境對孩子十分友善")
    elif has_menu:
        parts.append("提供專屬兒童餐，是個適合帶孩子來用餐的好選擇")

    if has_space and has_noise:
        parts.append("店內空間大且對小朋友的吵鬧聲也很包容，氛圍輕鬆自在")
    elif has_space:
        parts.append("用餐環境相當寬敞，就算推著嬰兒車進出也很順暢")
    elif has_noise:
        parts.append("這家店的氣氛對小孩比較包容，就算小朋友稍微活潑一點也沒關係")

    if not parts:
        return f"{name} 的用餐氣氛舒適，雖然沒有專門的育兒設備，但仍是個適合各類家庭輕鬆餐敘的空間。"

    if len(parts) > 1:
        return "這裡" + "，".join(parts) + "，非常推薦給正在尋找親子餐廳的您。"
    else:
        # Single part, prepend restaurant name for better flow
        first_part = parts[0]
        return f"{name} {first_part}。"

def extract_signals(row, attributes):
    """Extracts 2-4 short evidence points from attributes and reviews."""
    signals = []
    
    # 1. Add from confirmed attributes first (most reliable)
    for attr, confirmed in attributes.items():
        if confirmed:
            signals.append(SIGNAL_MAPPING[attr])
    
    # 2. Search reviews for specific keyword signals
    review_text = " ".join([row.get(f"評論{i}", "") for i in range(1, 6)])
    for kw, label in REVIEW_KEYWORDS.items():
        if len(signals) >= 4:
            break
        if kw in review_text and label not in signals:
            signals.append(label)
            
    # 3. Ensure at least 2, and cap at 4
    return signals[:4]

def main():
    restaurants = []
    try:
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get("餐廳名稱") or row.get("\ufeff餐廳名稱")
                address = row.get("Google Map地址")
                rating = row.get("評分")
                url = row.get("Google Map網址")
                
                if not name or not url:
                    continue
                    
                place_id_match = re.search(r"query_place_id=([^&]+)", url)
                if not place_id_match:
                    continue
                place_id = place_id_match.group(1)
                json_path = os.path.join(ai_review_dir, f"{place_id}.json")
                
                attributes = {
                    "high_chair_available": False,
                    "kids_menu": False,
                    "spacious_seating": False,
                    "kid_noise_tolerant": False
                }
                
                if os.path.exists(json_path):
                    with open(json_path, "r", encoding="utf-8") as jf:
                        data = json.load(jf)
                        attr_map = {
                            "High chair available": "high_chair_available",
                            "Kids menu available": "kids_menu",
                            "Spacious seating": "spacious_seating",
                            "kid_noise_tolerant": "kid_noise_tolerant"
                        }
                        for k, v in data.items():
                            if k in attr_map and v.get("result") == "Yes":
                                attributes[attr_map[k]] = True
                
                # Generate new AI Summary and Signals
                ai_summary = generate_ai_summary(attributes, name)
                signals = extract_signals(row, attributes)
                
                # Construct a more reliable Google Maps URL using place_id and name
                safe_name = name.replace(" ", "+") # Simple encoding for URL
                reliable_url = f"https://www.google.com/maps/search/?api=1&query={safe_name}&query_place_id={place_id}"
                
                restaurants.append({
                    "name": name,
                    "address": address,
                    "rating": rating,
                    "url": reliable_url,
                    "attributes": attributes,
                    "ai_summary": ai_summary,
                    "signals": signals
                })

        # Save to data.js
        with open(output_path, "w", encoding="utf-8") as out:
            out.write("const restaurantData = " + json.dumps(restaurants, ensure_ascii=False, indent=2) + ";")
        print(f"Successfully generated data.js with {len(restaurants)} restaurants.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
