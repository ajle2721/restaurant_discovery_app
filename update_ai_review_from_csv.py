import csv
import json
import os
import subprocess

csv_path = r'c:\Users\jason\Downloads\annotated_v2.csv'
signals_csv_path = 'annotated_v5_signals_final.csv'
ai_review_dir = 'ai_review'
response_dir = 'response'

def load_signals():
    signals_map = {}
    if not os.path.exists(signals_csv_path):
        print(f"Warning: Signals CSV not found at {signals_csv_path}")
        return signals_map
    
    print(f"Loading signals from {signals_csv_path}...")
    with open(signals_csv_path, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            place_id = row.get('place_id')
            signals_raw = row.get('generated_signals', '')
            if place_id and signals_raw:
                try:
                    # Try to parse as JSON if it looks like it
                    if signals_raw.strip().startswith('{') or signals_raw.strip().startswith('['):
                        signals_map[place_id] = json.loads(signals_raw)
                    else:
                        signals_map[place_id] = signals_raw
                except:
                    signals_map[place_id] = signals_raw
    return signals_map

def calculate_score(analysis):
    score = 0
    
    cs = analysis.get(" child_seat available", {}).get("result", "Unknown")
    ss = analysis.get("Spacious seating", {}).get("result", "Unknown")
    km = analysis.get("Kids menu available", {}).get("result", "Unknown")
    kn = analysis.get("kid_noise_tolerant", {}).get("result", "Unknown")

    if cs == "Yes": score += 2
    if ss == "Yes": score += 1
    if km == "Yes": score += 1
    if kn == "Yes": score += 1
    
    if cs == "No" or ss == "No" or kn == "No":
        score -= 2
        
    # 新版等級計算規則
    has_tableware = analysis.get("has_tableware", {}).get("result") == "Yes"
    has_high_chair = (cs == "Yes" or analysis.get("child_seat available", {}).get("result") == "Yes")
    has_kids_menu = (km == "Yes")
    has_play_area = analysis.get("has_play_area", {}).get("result") == "Yes"
    
    is_recommended = (has_tableware and has_high_chair) or (has_kids_menu or has_play_area)
    
    # 統計任意 Yes 項目數
    keys = [" child_seat available", "child_seat available", "Spacious seating", "Kids menu available", 
            "kid_noise_tolerant", "has_play_area", "has_private_room", "has_tableware", "has_diaper_table"]
    total_yes = 0
    for k in keys:
        if analysis.get(k, {}).get("result") == "Yes":
            total_yes += 1
            
    if is_recommended:
        level = "高"
    elif total_yes >= 1:
        level = "中"
    else:
        level = "資訊不足"
    
    return score, level

def rebuild_index():
    print("Rebuilding frontend index in Python...")
    ai_review_dir = "ai_review"
    response_dir = "response"
    output_path = os.path.join(ai_review_dir, "index.js")
    
    taipei_districts = ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"]

    def extract_district(address):
        for d in taipei_districts:
            if d in address:
                return d
        return ""

    def normalize_result(result):
        val = str(result or "").strip().lower()
        if val == "yes": return "yes"
        if val == "no": return "no"
        return "unknown"

    records = []
    files = sorted([f for f in os.listdir(ai_review_dir) if f.endswith(".json")])
    
    for filename in files:
        place_id = filename.replace(".json", "")
        res_path = os.path.join(response_dir, f"{place_id}.json")
        rev_path = os.path.join(ai_review_dir, filename)
        
        if not os.path.exists(res_path):
            continue
            
        with open(res_path, 'r', encoding='utf-8') as f:
            res = json.load(f)
        with open(rev_path, 'r', encoding='utf-8') as f:
            rev = json.load(f)
            
        name = res.get("displayName", {}).get("text", "")
        addr = res.get("formattedAddress", "")
        
        # Simplified Google Maps URL build logic
        query = name.replace(" ", "+")
        url = f"https://www.google.com/maps/search/?api=1&query={query}&query_place_id={place_id}"
        
        signals = rev.get("generated_signals", [])
        if not isinstance(signals, list):
            signals = [signals] if signals else []
            
        attr = {
            "high_chair_available": normalize_result(rev.get(" child_seat available", {}).get("result") or rev.get("child_seat available", {}).get("result")),
            "kids_menu": normalize_result(rev.get("Kids menu available", {}).get("result")),
            "spacious_seating": normalize_result(rev.get("Spacious seating", {}).get("result")),
            "kid_noise_tolerant": normalize_result(rev.get("kid_noise_tolerant", {}).get("result"))
        }
        
        record = {
            "place_id": place_id,
            "name": name,
            "address": addr,
            "formatted_address": addr,
            "district": extract_district(addr),
            "rating": str(res.get("rating", "")),
            "user_ratings_total": res.get("userRatingCount", 0),
            "latitude": res.get("location", {}).get("latitude"),
            "longitude": res.get("location", {}).get("longitude"),
            "url": url,
            "google_maps_url": url,
            "attributes": attr,
            "ai_summary": rev.get("generated_summary", ""),
            "signals": signals,
            "parent_friendly_score": rev.get("parent_friendly_score", 0),
            "parent_friendly_level": rev.get("parent_friendly_level", "資訊不足"),
            "reason": rev.get("reason", "綜合評估"),
            "reviews": res.get("reviews", [])
        }
        records.append(record)
        
    content = f"const restaurantData = {json.dumps(records, ensure_ascii=False, indent=2)};\n"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Built {output_path} with {len(records)} restaurants.")

def main():
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        return

    os.makedirs(ai_review_dir, exist_ok=True)
    
    signals_map = load_signals()

    with open(csv_path, mode='r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        count = 0
        for row in reader:
            if not row: continue
            if len(row) < 19:
                continue
                
            place_id = row[0]
            
            # Check if response file exists to avoid creating orphaned reviews
            response_file = os.path.join(response_dir, f"{place_id}.json")
            if not os.path.exists(response_file):
                continue
                
            # Now source signals from the signals_map instead of row[1:6]
            signals = signals_map.get(place_id, [])
            
            try:
                analysis = {
                    " child_seat available": {
                        "result": row[6],
                        "evidence": row[7] if row[7] else None,
                        "confidence": float(row[8]) if row[8] else 0.4
                    },
                    "Spacious seating": {
                        "result": row[9],
                        "evidence": row[10] if row[10] else None,
                        "confidence": float(row[11]) if row[11] else 0.4
                    },
                    "Kids menu available": {
                        "result": row[12],
                        "evidence": row[13] if row[13] else None,
                        "confidence": float(row[14]) if row[14] else 0.4
                    },
                    "kid_noise_tolerant": {
                        "result": row[15],
                        "evidence": row[16] if row[16] else None,
                        "confidence": float(row[17]) if row[17] else 0.4
                    }
                }
            except ValueError as e:
                print(f"Error parsing confidence for {place_id}: {e}")
                continue
            
            score, level = calculate_score(analysis)
            
            analysis["parent_friendly_score"] = score
            analysis["parent_friendly_level"] = level
            analysis["reason"] = "綜合評估"
            analysis["generated_signals"] = signals
            analysis["generated_summary"] = row[18]
            
            output_file = os.path.join(ai_review_dir, f"{place_id}.json")
            with open(output_file, 'w', encoding='utf-8') as out_f:
                json.dump(analysis, out_f, ensure_ascii=False, indent=4)
            
            count += 1
            
    print(f"Successfully updated {count} files in {ai_review_dir}.")
    
    # Run build script
    rebuild_index()

if __name__ == "__main__":
    main()
