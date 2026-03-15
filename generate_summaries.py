import csv
import json
import os
import re

base_dir = r"c:\Users\jason\OneDrive\桌面\restaurant map"
ai_review_dir = os.path.join(base_dir, "ai_review")
csv_path = os.path.join(base_dir, "aggregated_restaurants.csv")
output_path = os.path.join(base_dir, "data.js")

# Common positive signals to look for in reviews representing observations
REVIEW_KEYWORDS = {
    "遊戲區": "似乎有遊戲區",
    "球池": "似乎有遊戲區",
    "溜滑梯": "似乎有遊戲區",
    "玩具": "似乎有遊戲區",
    "沙坑": "似乎有遊戲區",
    "家庭客": "常見家庭客人",
    "帶小孩": "常見家庭客人",
    "帶兒童": "常見家庭客人",
    "帶小朋友": "常見家庭客人",
    "輕鬆": "氣氛可能較輕鬆",
    "友善": "店員對小朋友友善",
    "熱心": "店員對小朋友友善",
    "親切": "店員對小朋友友善",
    "推車": "空間適合推車",
    "嬰兒車": "空間適合推車",
}

def generate_ai_summary(attributes, name):
    """Generates a 1-2 sentence observational summary based on attributes."""
    has_chair = attributes.get("high_chair_available")
    has_menu = attributes.get("kids_menu")
    has_space = attributes.get("spacious_seating")
    has_noise = attributes.get("kid_noise_tolerant")

    parts = []
    if has_chair and has_menu:
        parts.append("餐廳提供嬰兒椅與兒童餐")
    elif has_chair:
        parts.append("餐廳有提供嬰兒椅")
    elif has_menu:
        parts.append("餐廳有提供兒童餐")

    if has_space and has_noise:
        parts.append("空間似乎寬敞且對小朋友的聲音較為包容")
    elif has_space:
        parts.append("空間看似較為寬敞")
    elif has_noise:
        parts.append("氛圍可能對小朋友的聲音較為包容")

    if not parts:
        return "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。"

    summary = "，".join(parts) + "，整體環境可能對帶小孩的家庭較友善。"
    return summary

def extract_signals(row, attributes):
    """Extracts 2-3 short evidence points from reviews."""
    signals = []
    
    # Search reviews for specific keyword signals
    review_text = " ".join([row.get(f"評論{i}", "") for i in range(1, 6)])
    for kw, label in REVIEW_KEYWORDS.items():
        if len(signals) >= 3:
            break
        if kw in review_text and label not in signals:
            signals.append(label)
            
    return signals

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
