import json
import re
import os

base_dir = r"c:\Users\jason\OneDrive\桌面\restaurant map"
ai_review_dir = os.path.join(base_dir, "ai_review")
data_js_path = os.path.join(base_dir, "data.js")

# Common positive signals from reviews (matching generate_summaries.py logic)
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
    parts = []
    has_chair = attributes.get("high_chair_available") == "Yes"
    has_menu = attributes.get("kids_menu") == "Yes"
    has_space = attributes.get("spacious_seating") == "Yes"
    has_noise = attributes.get("kid_noise_tolerant") == "Yes"

    if has_chair and has_menu:
        parts.append("餐廳提供嬰兒椅與兒童餐")
    elif has_chair:
        parts.append("餐廳有提供嬰兒椅")
    elif has_menu:
        parts.append("餐廳有提供兒童餐")

    if has_space and has_noise:
        parts.append("空間寬敞且對小朋友的聲音較為包容")
    elif has_space:
        parts.append("空間較為寬敞")
    elif has_noise:
        parts.append("氛圍對小朋友的聲音較為包容")

    if not parts:
        return "目前沒有明顯的專屬育兒設備資訊，但環境似乎適合一般家庭用餐。"

    summary = "，".join(parts) + "，整體環境對帶小孩的家庭相當友善。"
    return summary

def main():
    with open(data_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
    if not match:
        print("Could not find data array")
        return
    
    data = json.loads(match.group(1))
    
    updated_count = 0
    for item in data:
        place_id = item.get("place_id")
        if not place_id:
            continue
            
        json_path = os.path.join(ai_review_dir, f"{place_id}.json")
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as jf:
                analysis_data = json.load(jf)
            
            # Update attributes
            # Map "Yes"/"No"/"Unknown" to actual bools if needed, or keep strings if that's the pipeline
            # The original data.js used true/false.
            attr_map = {
                "High chair available": "high_chair_available",
                "Kids menu available": "kids_menu",
                "Spacious seating": "spacious_seating",
                "kid_noise_tolerant": "kid_noise_tolerant"
            }
            
            new_attrs = {}
            for k, v in analysis_data.items():
                if k in attr_map:
                    # Convert to boolean for data.js compatibility
                    new_attrs[attr_map[k]] = True if v.get("result") == "Yes" else False
            
            item["attributes"] = new_attrs
            
            # Generate AI Summary
            item["ai_summary"] = generate_ai_summary(new_attrs, item.get("name"))
            
            # Extract signals from reviews in current item
            signals = []
            reviews_text = " ".join(item.get("reviews", []))
            for kw, label in REVIEW_KEYWORDS.items():
                if len(signals) >= 3:
                    break
                if kw in reviews_text and label not in signals:
                    signals.append(label)
            
            # Also add evidence from analysis_data as signals if appropriate
            for k, v in analysis_data.items():
                if v.get("result") == "Yes" and v.get("evidence"):
                    ev = v.get("evidence")
                    if len(ev) < 15 and ev not in signals:
                        signals.append(ev)
            
            item["signals"] = list(set(signals))[:3]
            updated_count += 1

    # Save back to data.js
    with open(data_js_path, 'w', encoding='utf-8') as out:
        out.write("const restaurantData = " + json.dumps(data, ensure_ascii=False, indent=2) + ";")
    
    print(f"Successfully updated {updated_count} restaurants in data.js.")

if __name__ == "__main__":
    main()
