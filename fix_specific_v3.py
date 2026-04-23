import json
import re
import os

base_dir = r"c:\Users\jason\OneDrive\桌面\restaurant map"
data_js_path = os.path.join(base_dir, "data.js")

def main():
    with open(data_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
    if not match:
        return
    
    data = json.loads(match.group(1))
    
    for item in data:
        name = item.get("name", "")
        # 1. Specific Fix for 臺北美味小館
        if "臺北美味小館" in name:
            item["ai_summary"] = "這裡對孩童聲音較為包容，且是葡萄酒友善的熱門餐廳，氣氛溫馨，適合與家人一同前往品味。"
        
        # 2. Specific Fix for 舍食館 (any restaurant containing this)
        if "舍食館" in name:
            item["ai_summary"] = item["ai_summary"].replace("記載", "").replace("適合作為一般家庭聚餐的考量", "適合一般家庭聚餐")

        # 3. Global Phrase Cleanup
        # "適合作為一般家庭聚餐的考量" -> "適合一般家庭聚餐"
        item["ai_summary"] = item["ai_summary"].replace("適合作為一般家庭聚餐的考量", "適合一般家庭聚餐")
        # "專屬設備記載" -> "專屬設備資訊"
        item["ai_summary"] = item["ai_summary"].replace("專屬設備記載", "專屬設備資訊")
        # "具備玩得很開心" -> "空間寬敞且氛圍歡樂" (Fix for Ho'me if it persisted)
        item["ai_summary"] = item["ai_summary"].replace("具備玩得很開心", "空間寬敞且氛圍歡樂")

    # Save back
    with open(data_js_path, 'w', encoding='utf-8') as out:
        out.write("const restaurantData = " + json.dumps(data, ensure_ascii=False, indent=2) + ";")
    
    print("Successfully applied V3 fixes and global cleanup.")

if __name__ == "__main__":
    main()
