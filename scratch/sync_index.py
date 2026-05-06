import os
import json
import re

ai_review_dir = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\ai_review'
response_dir = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\response'
output_path = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\ai_review\index.js'

taipei_districts = ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"]

def read_json(path):
    try:
        with open(path, 'r', encoding='utf-8-sig') as f:
            return json.load(f)
    except:
        return {}

def normalize_result(result):
    v = str(result or "").strip().lower()
    if v == "yes": return "yes"
    if v == "no": return "no"
    return "unknown"

def extract_district(address):
    for d in taipei_districts:
        if d in address: return d
    return ""

records = []
files = sorted([f for f in os.listdir(ai_review_dir) if f.endswith('.json')])

for f in files:
    place_id = f.replace('.json', '')
    ai = read_json(os.path.join(ai_review_dir, f))
    resp = read_json(os.path.join(response_dir, f))
    
    if not resp: continue
    
    name = resp.get('displayName', {}).get('text', '')
    addr = resp.get('formattedAddress', '')
    
    # Attributes
    attrs = {
        "high_chair_available": normalize_result(ai.get(" child_seat available", {}).get("result") or ai.get("child_seat available", {}).get("result") or ai.get("High chair available", {}).get("result")),
        "kids_menu": normalize_result(ai.get("Kids menu available", {}).get("result")),
        "spacious_seating": normalize_result(ai.get("Spacious seating", {}).get("result")),
        "kid_noise_tolerant": normalize_result(ai.get("kid_noise_tolerant", {}).get("result"))
    }
    
    # Signals
    signals = ai.get('generated_signals', [])
    if not isinstance(signals, list):
        signals = [signals] if signals else []

    records.append({
        "place_id": place_id,
        "name": name,
        "address": addr,
        "formatted_address": addr,
        "district": extract_district(addr),
        "rating": str(resp.get('rating', '')),
        "user_ratings_total": resp.get('userRatingCount', 0),
        "latitude": resp.get('location', {}).get('latitude'),
        "longitude": resp.get('location', {}).get('longitude'),
        "url": f"https://www.google.com/maps/search/?api=1&query={name}&query_place_id={place_id}",
        "attributes": attrs,
        "ai_summary": ai.get('generated_summary', ''),
        "card_summary": ai.get('card_summary', ''),
        "signals": signals,
        "parent_friendly_score": ai.get('parent_friendly_score', 0),
        "parent_friendly_level": ai.get('parent_friendly_level', '資訊不足'),
        "reason": ai.get('reason', '綜合評估')
    })

content = f"const restaurantData = {json.dumps(records, ensure_ascii=False, indent=2)};\n"
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Built {output_path} with {len(records)} restaurants.")
