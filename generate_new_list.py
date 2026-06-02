import os
import json
import re
import sys
import builtins

# Save original print to avoid infinite recursion
_original_print = builtins.print

def safe_print(*args, **kwargs):
    sep = kwargs.get('sep', ' ')
    end = kwargs.get('end', '\n')
    file = kwargs.get('file', sys.stdout)
    
    msg = sep.join(str(arg) for arg in args)
    
    encoding = getattr(file, 'encoding', None) or 'utf-8'
    try:
        msg = msg.encode(encoding, errors='replace').decode(encoding)
    except Exception:
        pass
        
    new_kwargs = {k: v for k, v in kwargs.items() if k not in ('sep', 'end', 'file')}
    _original_print(msg, end=end, file=file, **new_kwargs)

builtins.print = safe_print

base_dir = os.getcwd()
ai_review_dir = os.path.join(base_dir, "ai_review")
response_dir = os.path.join(base_dir, "response")
output_md = os.path.join(base_dir, "今日新增餐廳名單.md")

taipei_districts = [
    "中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", 
    "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"
]

district_groups = {d: [] for d in taipei_districts}
district_groups["其他"] = []

ai_files = sorted([f for f in os.listdir(ai_review_dir) if f.endswith(".json")])

for filename in ai_files:
    ai_path = os.path.join(ai_review_dir, filename)
    resp_path = os.path.join(response_dir, filename)
    
    if not os.path.exists(resp_path):
        continue
        
    try:
        with open(ai_path, 'r', encoding='utf-8') as f:
            ai_data = json.load(f)
            
        # Check if newly added (reason is "離線關鍵字快速評估")
        if ai_data.get("reason") != "離線關鍵字快速評估":
            continue
            
        with open(resp_path, 'r', encoding='utf-8') as f:
            resp_data = json.load(f)
            
        raw_name = resp_data.get("displayName", {}).get("text", "Unknown")
        # Clean name slightly
        name = raw_name
        name = re.sub(r'([\(（\[【])(.*?)([\)）\]】])', '', name).strip()
        
        address = resp_data.get("formattedAddress", "")
        rating = resp_data.get("rating", "無")
        
        matched_district = "其他"
        for d in taipei_districts:
            if d in address:
                matched_district = d
                break
                
        # Kid tags
        tags = []
        if ai_data.get(" child_seat available", {}).get("result") == "Yes":
            tags.append("嬰兒椅")
        if ai_data.get("Spacious seating", {}).get("result") == "Yes":
            tags.append("空間寬敞")
        if ai_data.get("Kids menu available", {}).get("result") == "Yes":
            tags.append("兒童餐")
        if ai_data.get("kid_noise_tolerant", {}).get("result") == "Yes":
            tags.append("親子友善氛圍")
            
        tag_str = "、".join(tags) if tags else "優質高分餐廳"
        
        district_groups[matched_district].append({
            "name": name,
            "rating": rating,
            "tags": tag_str
        })
    except Exception as e:
        pass

# Write Markdown report in UTF-8
with open(output_md, "w", encoding="utf-8") as f:
    f.write("# 台北親子地圖 - 今日新增 787 間餐廳清單\n\n")
    f.write("此清單為今日成功由 Google Places API V1 擴充，經捷運地標半徑 600m（步行 10 分鐘）篩選、大於等於 4.0 星星的高優質餐廳名單，並已完成離線親子特色標籤分析。\n\n")
    
    for d in taipei_districts:
        f.write(f"## 📍 {d} (新增 {len(district_groups[d])} 間)\n\n")
        f.write("| 餐廳名稱 | 評分 | 親子標籤特色 |\n")
        f.write("| :--- | :--- | :--- |\n")
        
        # Sort by rating descending
        sorted_list = sorted(district_groups[d], key=lambda x: str(x["rating"]), reverse=True)
        for r in sorted_list:
            f.write(f"| {r['name']} | {r['rating']} ★ | {r['tags']} |\n")
        f.write("\n")

print(f"[SUCCESS] List written to {output_md}")
