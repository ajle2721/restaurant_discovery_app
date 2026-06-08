import os
import json
import glob
import re

response_dir = "response"
ai_review_dir = "ai_review"

# Suffixes to strip to find the base brand name
BRANCH_PATTERNS = [
    r'\s*\(.*?店\)$', r'\s*（.*?店）$', r'\s*\[.*?店\]$', r'\s*【.*?店】$',
    r'\s+臺?北\w*店$', r'\s*\w+店$', r'\s*\w+分店$', r'\s*-\s*\w+店$', r'\s*-\w+店$',
    r'\s+旗旗店$', r'\s+門市$', r'\s*\w+門市$', r'\s*\w+館$', r'\s+臺?北\w*館$'
]

def clean_brand_name(name):
    if not name:
        return ""
    
    # Remove contents in brackets/parentheses
    cleaned = re.sub(r'([\(（\[【])(.*?)([\)）\]】])', '', name)
    
    # Apply branch patterns
    for pattern in BRANCH_PATTERNS:
        cleaned = re.compile(pattern, re.IGNORECASE).sub('', cleaned)
        
    # Strip some generic tail words
    cleaned = re.sub(r'[\/／\|｜~～].*$', '', cleaned)
    cleaned = cleaned.strip()
    
    return cleaned

files = glob.glob(os.path.join(response_dir, "*.json"))

brand_features = {} # brand -> feature_name -> list of values

keys_to_extract = [
    " child_seat available",
    "Spacious seating",
    "Kids menu available",
    "kid_noise_tolerant",
    "has_play_area",
    "has_private_room",
    "has_tableware",
    "has_diaper_table"
]

for filepath in files:
    try:
        place_id = os.path.splitext(os.path.basename(filepath))[0]
        
        with open(filepath, "r", encoding="utf-8-sig") as f:
            resp_data = json.load(f)
            
        raw_name = resp_data.get("displayName", {}).get("text", "")
        if not raw_name:
            continue
            
        brand = clean_brand_name(raw_name)
        if not brand or len(brand) < 2:
            continue
            
        ai_path = os.path.join(ai_review_dir, f"{place_id}.json")
        if os.path.exists(ai_path):
            with open(ai_path, "r", encoding="utf-8-sig") as f2:
                ai_data = json.load(f2)
                
            for key in keys_to_extract:
                if key in ai_data:
                    res = ai_data[key].get("result")
                    conf = ai_data[key].get("confidence", 0)
                    evidence = ai_data[key].get("evidence")
                    
                    if res in ["Yes", "No"]:
                        brand_features.setdefault(brand, {}).setdefault(key, []).append({
                            "result": res,
                            "confidence": conf,
                            "evidence": evidence
                        })
    except Exception as e:
        pass

brand_rules = {}

for brand, features in brand_features.items():
    brand_rules[brand] = {}
    for key, instances in features.items():
        results = [inst["result"] for inst in instances]
        unique_results = set(results)
        
        if len(unique_results) == 1:
            # Consistent!
            best_instance = max(instances, key=lambda x: x["confidence"])
            brand_rules[brand][key] = {
                "result": best_instance["result"],
                "evidence": f"依據連鎖品牌【{brand}】統一設定",
                "confidence": max(best_instance["confidence"], 0.9)
            }

# Write brand rules to a JSON file
with open("brand_rules.json", "w", encoding="utf-8") as f:
    json.dump(brand_rules, f, ensure_ascii=False, indent=4)
print(f"Saved brand rules for {len(brand_rules)} brands to brand_rules.json")
