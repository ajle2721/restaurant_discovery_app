import json
import re
import os

base_dir = r"c:\Users\jason\OneDrive\桌面\restaurant map"
data_js_path = os.path.join(base_dir, "data.js")

def polish_text(text):
    if not text:
        return text
    
    # 1. Convert specific half-width punctuation to full-width
    # , -> ，
    # ! -> ！
    # ? -> ？
    # : -> ：
    # ; -> ；
    # ( -> （
    # ) -> ）
    
    # We use a regex to avoid converting punctuation inside English strings or numbers if possible, 
    # but for simple summaries, a direct replacement is usually safe as long as we don't break JSON structure.
    # Since we are processing the string values directly, we can replace them.
    
    text = text.replace(",", "，")
    text = text.replace("!", "！")
    text = text.replace("?", "？")
    text = text.replace(":", "：")
    text = text.replace(";", "；")
    
    # Handle cases where multiple commas or spaces might have been introduced
    text = re.sub(r'，+', '，', text)
    text = re.sub(r'。+', '。', text)
    text = text.replace(" ，", "，").replace("， ", "，")
    
    # 2. Smooth out common awkward patterns
    # "提供..., 並..." -> "提供...，以及..." or "提供...，且..."
    text = text.replace("，並", "，並提供")
    text = text.replace("，而且", "，且")
    text = text.replace("，同時", "，同時具備")
    
    # "環境觀察顯示...的氛圍比較大眾化" -> "環境觀察顯示...的氛圍較為大眾化"
    text = text.replace("比較大眾化", "較為大眾化")
    
    # "資訊不多，但..." -> "資訊較少，不過..."
    text = text.replace("資訊不多", "資訊較少")
    
    # 3. Ensure full-width periods at the end
    if not text.endswith("。") and not text.endswith("！"):
        text += "。"

    # 4. Clean up any "，。" sequences
    text = text.replace("，。", "。")
    
    return text

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
        original_summary = item.get("ai_summary", "")
        polished_summary = polish_text(original_summary)
        item["ai_summary"] = polished_summary

    # Save back to data.js
    with open(data_js_path, 'w', encoding='utf-8') as out:
        out.write("const restaurantData = " + json.dumps(data, ensure_ascii=False, indent=2) + ";")
    
    print(f"Successfully polished {len(data)} summaries in data.js.")

if __name__ == "__main__":
    main()
