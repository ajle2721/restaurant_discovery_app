import json
import re
import os
import random

base_dir = r"c:\Users\jason\OneDrive\桌面\restaurant map"
data_js_path = os.path.join(base_dir, "data.js")

def extract_type(name):
    type_map = {
        "咖啡": "咖啡廳",
        "Cafe": "咖啡廳",
        "早午餐": "早午餐店",
        "Brunch": "早午餐店",
        "義大利麵": "義大利麵店",
        "Pasta": "義大利麵店",
        "燒肉": "燒肉店",
        "火鍋": "火鍋店",
        "拉麵": "拉麵店",
        "餐酒館": "餐酒館",
        "Bistro": "餐酒館",
        "甜點": "甜點店",
        "下午茶": "下午茶餐廳",
        "披薩": "披薩店",
        "Pizza": "披薩店",
        "漢堡": "漢堡店",
        "Burger": "漢堡店",
        "食堂": "食堂",
        "料理": "料理店",
        "壽司": "壽司店",
        "牛排": "牛排館",
        "Steak": "牛排館"
    }
    for kw, label in type_map.items():
        if kw.lower() in name.lower():
            return label
    return "餐廳"

def generate_natural_summary(item):
    name = item.get("name", "這裡")
    attrs = item.get("attributes", {})
    signals = item.get("signals", [])
    place_id = item.get("place_id", "default")
    
    random.seed(place_id)
    
    # 1. Collect Attributes
    yes_tags = [k for k, v in attrs.items() if v == 'yes']
    attr_labels = {
        "high_chair_available": "嬰兒椅",
        "kids_menu": "兒童餐",
        "spacious_seating": "寬敞的座位區",
        "kid_noise_tolerant": "對孩童聲音較為包容"
    }
    
    tag_str = "、".join([attr_labels[t] for t in yes_tags])
    
    # 2. Extract Type and Adjective
    res_type = extract_type(name)
    adjective = random.choice(["十分熱門", "氣氛溫馨", "環境舒適", "口碑不錯", "精緻", "質感佳"])
    
    # 3. Assemble Signal
    signal_str = ""
    if signals:
        signal_str = f"且{signals[0]}，" if not signals[0].endswith("，") else f"且{signals[0]}"
    
    # 4. Construct Sentence based on user's template
    # "這裡有[屬性]、[屬性]，是[特徵]的[類型]，適合[客群]。"
    
    if yes_tags:
        summary = f"這裡有{tag_str}，"
        if signals:
            summary += f"{signals[0]}，"
        summary += f"是{adjective}的親子友善{res_type}，適合與家人一同前往品味。"
    elif signals:
        summary = f"雖然目前設施資訊較少，但這裡{signals[0]}，是{adjective}的{res_type}，適合一般家庭用餐。"
    else:
        # Case C: Limited info
        varied_unknown = [
            f"這裡雖然目前育兒設施資訊較少，但環境氛圍較為大眾化，是個溫馨的{res_type}選擇。",
            f"目前尚無明確的專屬設備記載，不過這裡的用餐氣氛輕鬆，適合作為一般家庭聚餐的考量。",
            f"雖然關於嬰幼兒設備的評論不多，但這裡整體的環境舒適，適合同家人一起共享美食。"
        ]
        summary = random.choice(varied_unknown)

    # 5. Final Punctuation Polish (Strictly full-width)
    summary = summary.replace(",", "，").replace("!", "！").replace("?", "？").replace(":", "：").replace(";", "；")
    if not summary.endswith("。"):
        summary += "。"
    
    return summary

def main():
    if not os.path.exists(data_js_path):
        print("Data file not found.")
        return

    with open(data_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
    if not match:
        print("Could not find data array.")
        return
    
    data = json.loads(match.group(1))
    
    for item in data:
        item["ai_summary"] = generate_natural_summary(item)

    # Save back to data.js
    with open(data_js_path, 'w', encoding='utf-8') as out:
        out.write("const restaurantData = " + json.dumps(data, ensure_ascii=False, indent=2) + ";")
    
    print(f"Successfully refined {len(data)} summaries with the Natural Flow V2 logic.")

if __name__ == "__main__":
    main()
