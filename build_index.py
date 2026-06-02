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
output_path = os.path.join(ai_review_dir, "index.js")

taipei_districts = [
    "中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", 
    "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"
]

cuisine_map = {
    'italian_restaurant': '義大利料理',
    'japanese_restaurant': '日式料理',
    'korean_restaurant': '韓式料理',
    'chinese_restaurant': '中式料理',
    'thai_restaurant': '泰式料理',
    'french_restaurant': '法式料理',
    'american_restaurant': '美式料理',
    'mexican_restaurant': '墨西哥料理',
    'vietnamese_restaurant': '越南料理',
    'vegetarian_restaurant': '蔬食料理',
    'steak_house': '牛排館',
    'sushi_restaurant': '壽司',
    'pizza_restaurant': '披薩',
    'ramen_restaurant': '拉麵',
    'cafe': '咖啡廳',
    'bakery': '烘焙/甜點',
    'bar': '酒吧/餐酒館',
    'bistro': '小酒館/餐酒館',
    'brunch_restaurant': '早午餐'
}

def read_json(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        # Strip UTF-8 BOM if present
        if content.startswith('\ufeff'):
            content = content[1:]
        return json.loads(content)
    except Exception as e:
        print(f"Error parsing {filepath}: {e}")
        return {}

def normalize_result(result):
    val = str(result or "").strip().lower()
    if val == "yes":
        return "yes"
    if val == "no":
        return "no"
    return "unknown"

def build_google_maps_url(name, place_id):
    query = re.sub(r'\s+', ' ', name or "").strip()
    # URL encoding query
    import urllib.parse
    encoded_query = urllib.parse.quote(query)
    return f"https://www.google.com/maps/search/?api=1&query={encoded_query}&query_place_id={place_id}"

def extract_district(address):
    for district in taipei_districts:
        if district in address:
            return district
    return ""

def get_ai_attributes(ai_review):
    # Check various child seat keys due to potential space or casing differences
    child_seat = "unknown"
    for k in [" child_seat available", "child_seat available", "High chair available"]:
        if k in ai_review:
            child_seat = normalize_result(ai_review[k].get("result"))
            break
            
    kids_menu = normalize_result(ai_review.get("Kids menu available", {}).get("result"))
    spacious = normalize_result(ai_review.get("Spacious seating", {}).get("result"))
    noise = normalize_result(ai_review.get("kid_noise_tolerant", {}).get("result"))
    
    play_area = normalize_result(ai_review.get("has_play_area", {}).get("result"))
    private_room = normalize_result(ai_review.get("has_private_room", {}).get("result"))
    tableware = normalize_result(ai_review.get("has_tableware", {}).get("result"))
    diaper_table = normalize_result(ai_review.get("has_diaper_table", {}).get("result"))
    
    return {
        "high_chair_available": child_seat,
        "kids_menu": kids_menu,
        "spacious_seating": spacious,
        "kid_noise_tolerant": noise,
        "has_play_area": play_area,
        "has_private_room": private_room,
        "has_tableware": tableware,
        "has_diaper_table": diaper_table
    }

def clean_restaurant_name(name):
    if not name:
        return ""
    cleaned = name
    
    # Mirroring JavaScript regex cleanRestaurantName
    # Removes auxiliary details in brackets/parentheses unless they match branch patterns (店/館/房/室/LalaPort)
    def replacer(match):
        open_char, content, close_char = match.group(1), match.group(2), match.group(3)
        trimmed = content.strip()
        is_branch = re.search(r'(店|館|房|室|LalaPort)$', trimmed, re.IGNORECASE)
        has_stuffing = re.search(r'(點餐|最後|供餐|推薦|美食|宵夜|捷運|訂位|不限時|外送|不提供|店休|僅收|只收|現金|／|/|\||｜)', trimmed)
        if (is_branch or not has_stuffing) and len(trimmed) <= 12:
            return match.group(0)
        else:
            return ""

    cleaned = re.sub(r'([\(（\[【])(.*?)([\)）\]】])', replacer, cleaned)
    cleaned = re.sub(r'[\(（\[【][^\)）\]】]*$', '', cleaned)
    cleaned = re.sub(r'[\/／\|｜].*$', '', cleaned)
    cleaned = re.sub(r'[~～].*$', '', cleaned)
    return cleaned.strip()

def build_record(place_id):
    resp = read_json(os.path.join(response_dir, f"{place_id}.json"))
    ai_rev = read_json(os.path.join(ai_review_dir, f"{place_id}.json"))
    
    raw_name = resp.get("displayName", {}).get("text", "")
    name = clean_restaurant_name(raw_name)
    formatted_address = resp.get("formattedAddress", "")
    
    google_maps_url = build_google_maps_url(name, place_id)
    
    gen_signals = ai_rev.get("generated_signals", [])
    if isinstance(gen_signals, list):
        signals = gen_signals
    elif gen_signals:
        signals = [gen_signals]
    else:
        signals = []
        
    price_level = resp.get("priceLevel", None)
    
    cuisine = None
    types = resp.get("types", [])
    if isinstance(types, list):
        for t in types:
            if t in cuisine_map:
                cuisine_label = cuisine_map[t]
                # If name doesn't contain the label, assign it
                if cuisine_label not in name and t.split('_')[0] not in name.lower():
                    cuisine = cuisine_label
                    break
                    
    loc = resp.get("location", {})
    
    return {
        "place_id": place_id,
        "name": name,
        "address": formatted_address,
        "formatted_address": formatted_address,
        "district": extract_district(formatted_address),
        "rating": str(resp.get("rating", "")),
        "user_ratings_total": resp.get("userRatingCount", 0),
        "price_level": price_level,
        "cuisine": cuisine,
        "latitude": loc.get("latitude", None),
        "longitude": loc.get("longitude", None),
        "url": google_maps_url,
        "google_maps_url": google_maps_url,
        "attributes": get_ai_attributes(ai_rev),
        "ai_summary": ai_rev.get("generated_summary", ""),
        "card_summary": ai_rev.get("card_summary", ""),
        "signals": signals,
        "parent_friendly_score": ai_rev.get("parent_friendly_score", 0),
        "parent_friendly_level": ai_rev.get("parent_friendly_level", "資訊不足"),
        "reason": ai_rev.get("reason", "綜合評估"),
        "reviews": []  # Strip reviews to keep bundle lightweight
    }

def main():
    print("[SYSTEM] Taipei Kid-Friendly Restaurant Python Bundle Compiler")
    print("=========================================================")

    ai_files = sorted([f for f in os.listdir(ai_review_dir) if f.endswith(".json")])
    
    skipped = []
    records = []
    
    for filename in ai_files:
        place_id = os.path.splitext(filename)[0]
        resp_path = os.path.join(response_dir, f"{place_id}.json")
        if not os.path.exists(resp_path):
            skipped.append(place_id)
            continue
        records.append(build_record(place_id))
        
    # Write as standard JS variable definition
    js_content = f"const restaurantData = {json.dumps(records, ensure_ascii=False, indent=2)};\n"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print(f"[SUCCESS] Built index.js at: {output_path}")
    print(f"  - Compiled {len(records)} restaurant records into a single bundle.")
    if skipped:
        print(f"  - Skipped {len(skipped)} files due to missing response profiles.")

if __name__ == "__main__":
    main()
