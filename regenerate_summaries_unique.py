import json
import re
import os
import random

base_dir = r"c:\Users\jason\OneDrive\桌面\restaurant map"
data_js_path = os.path.join(base_dir, "data.js")

def generate_unique_summary(item):
    name = item.get("name", "這家餐廳")
    attrs = item.get("attributes", {})
    signals = item.get("signals", [])
    place_id = item.get("place_id", "default")
    
    # Use place_id as seed for deterministic "randomness" (unique per restaurant)
    random.seed(place_id)
    
    yes_tags = [k for k, v in attrs.items() if v == 'yes']
    attr_labels = {
        "high_chair_available": "嬰兒椅",
        "kids_menu": "兒童餐",
        "spacious_seating": "寬敞的座位區",
        "kid_noise_tolerant": "對孩童聲音較為包容的環境"
    }

    # Sentence components for variety
    starters_with_tags = [
        f"{name}提供{', '.join([attr_labels[t] for t in yes_tags])}，",
        f"這裡配備了{', '.join([attr_labels[t] for t in yes_tags])}，",
        f"根據資料顯示，{name}備有{', '.join([attr_labels[t] for t in yes_tags])}，",
        f"來{name}用餐可以享用到{', '.join([attr_labels[t] for t in yes_tags])}等便利設施，"
    ]
    
    starters_with_signals = [
        f"從評論來看，{name}",
        f"許多客人反映{name}",
        f"網友評價指出{name}",
        f"多數評論提到{name}的",
    ]
    
    starters_unknown = [
        f"雖然目前針對育兒設施的記載較少，但{name}的",
        f"目前尚無明確的專屬設備資訊，不過{name}的",
        f"關於設施的細節雖不多，但{name}整體的",
        f"儘管缺少具體的設施標籤，{name}的",
        f"環境觀察顯示{name}的",
    ]
    
    connectors = ["並", "且", "同時", "而且"]
    
    closers = [
        "是個適合家庭聚會的選擇。",
        "對於想帶小孩出門的家長來說相當方便。",
        "整體給人一種輕鬆友善的用餐體驗。",
        "適合與家人一同前往品味。",
        "展現出對一般客群（含家庭）的包容性。",
        "是不少在地家庭會考慮的用餐點。",
        "氣氛相當溫馨。",
    ]

    summary = ""
    
    try:
        if yes_tags:
            summary = random.choice(starters_with_tags)
            if signals:
                summary += f"{random.choice(connectors)}{random.choice(signals)}，"
            summary += random.choice(closers)
        elif signals:
            summary = f"{random.choice(starters_with_signals)}{random.choice(signals)}，"
            summary += random.choice(closers)
        else:
            # Fallback for Case C
            summary = f"{random.choice(starters_unknown)}氛圍比較大眾化，{random.choice(closers)}"
    except Exception as e:
        summary = f"{name}是個適合一般用餐的場所，整體環境穩定。"

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
    
    counts = {}
    for item in data:
        new_summary = generate_unique_summary(item)
        item["ai_summary"] = new_summary
        counts[new_summary] = counts.get(new_summary, 0) + 1

    # Save back to data.js
    with open(data_js_path, 'w', encoding='utf-8') as out:
        out.write("const restaurantData = " + json.dumps(data, ensure_ascii=False, indent=2) + ";")
    
    print(f"Successfully regenerated summaries for {len(data)} restaurants.")
    
    # Check for duplicates
    duplicates = {k: v for k, v in counts.items() if v > 1}
    print(f"Summary collision check: {len(duplicates)} duplicate patterns found.")
    
    # Show 5 samples
    print("\n--- Samples ---")
    samples = random.sample(data, 5)
    for s in samples:
        print(f"Name: {s.get('name')}")
        print(f"Summary: {s.get('ai_summary')}")
        print("-" * 20)

if __name__ == "__main__":
    main()
