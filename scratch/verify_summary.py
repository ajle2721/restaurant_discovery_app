import json
import re
import os
import sys
import builtins

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
    builtins.print(msg, end=end, file=file, **new_kwargs)

# Read compiled index.js
index_path = "ai_review/index.js"
if not os.path.exists(index_path):
    safe_print("index.js not found.")
    sys.exit(1)

with open(index_path, "r", encoding="utf-8") as f:
    content = f.read()

start = content.find("[")
end = content.rfind("]")
records = json.loads(content[start:end+1])

safe_print(f"Total compiled records: {len(records)}")

# 1. Count by district
district_counts = {}
for r in records:
    d = r.get("district", "Unknown/Outside Taipei")
    if not d:
        d = "Unknown/Outside Taipei"
    district_counts[d] = district_counts.get(d, 0) + 1

safe_print("\n--- District Distribution ---")
for dist, count in sorted(district_counts.items(), key=lambda x: x[1], reverse=True):
    safe_print(f"  {dist}: {count} restaurants")

# 2. Verify Mall Diaper Table Default Override
malls_tested = 0
malls_succeeded = 0
safe_print("\n--- Shopping Mall Diaper Table Verification ---")
for r in records:
    name = r.get("name", "")
    addr = r.get("address", "")
    attrs = r.get("attributes", {})
    
    # Check if this restaurant matches shopping mall keywords
    mall_kws = ["百貨", "商場", "微風", "SOGO", "誠品", "新光三越", "Citylink", "Lalaport", "美麗華"]
    is_mall = any(kw in name or kw in addr for kw in mall_kws)
    
    if is_mall:
        malls_tested += 1
        diaper = attrs.get("has_diaper_table")
        if diaper == "yes":
            malls_succeeded += 1
            if malls_succeeded <= 5:
                safe_print(f"  [PASS] Mall Restaurant: '{name}' in '{addr}' has diaper table: {diaper}")

safe_print(f"Total mall restaurants checked: {malls_tested}, diaper table set to 'yes': {malls_succeeded}")

# 3. Verify Chain Rules Inheritance (Tokiya/陶板屋)
tokiya_tested = 0
tokiya_succeeded = 0
safe_print("\n--- Tokiya Rules Inheritance Verification ---")
for r in records:
    name = r.get("name", "")
    attrs = r.get("attributes", {})
    
    if "陶板屋" in name:
        tokiya_tested += 1
        chair = attrs.get("high_chair_available")
        menu = attrs.get("kids_menu")
        tableware = attrs.get("has_tableware")
        
        if chair == "yes" and menu == "yes" and tableware == "yes":
            tokiya_succeeded += 1
            safe_print(f"  [PASS] Tokiya Branch: '{name}' -> Chair: {chair}, Menu: {menu}, Tableware: {tableware}")
        else:
            safe_print(f"  [FAIL] Tokiya Branch: '{name}' -> Chair: {chair}, Menu: {menu}, Tableware: {tableware}")

safe_print(f"Total Tokiya branches checked: {tokiya_tested}, successfully inherited rules: {tokiya_succeeded}")

# 4. Verify no obvious non-restaurants are included
non_restaurant_count = 0
safe_print("\n--- Non-Restaurant Keywords Check ---")
exclude_keywords = ["診所", "藥局", "超市", "美甲", "沙龍", "幼兒園", "補習班", "醫院", "7-11", "全家"]
for r in records:
    name = r.get("name", "")
    matched_kws = [kw for kw in exclude_keywords if kw in name]
    if matched_kws:
        non_restaurant_count += 1
        safe_print(f"  [WARNING] Suspicious place name: '{name}' matches {matched_kws}")

if non_restaurant_count == 0:
    safe_print("  [PASS] No obvious non-restaurants (clinics, drugstores, supermarkets, schools) found in the names!")
else:
    safe_print(f"  [WARNING] Found {non_restaurant_count} suspicious place names.")
