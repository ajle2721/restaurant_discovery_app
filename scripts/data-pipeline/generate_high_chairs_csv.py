import os
import json
import re
import csv

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ai_review_dir = os.path.join(base_dir, "data", "ai_review")
index_js_path = os.path.join(base_dir, "data", "generated", "restaurant-catalog.js")
output_csv_path = os.path.join(base_dir, "data", "generated", "high_chair_list.csv")

# 1. Read index.js to extract metadata (name, address, google_maps_url) for each place_id
id_to_meta = {}
if os.path.exists(index_js_path):
    print(f"Reading restaurant metadata from {index_js_path}...")
    with open(index_js_path, "r", encoding="utf-8-sig") as f:
        content = f.read()
    
    rows_match = re.search(r'const rows = (\[.*?\]);', content, re.DOTALL)
    columns_match = re.search(r'const columns = (\[.*?\]);', content, re.DOTALL)
    if rows_match and columns_match:
        try:
            columns = json.loads(columns_match.group(1))
            rows = json.loads(rows_match.group(1))
            
            name_idx = columns.index("name")
            id_idx = columns.index("place_id")
            address_idx = columns.index("address")
            url_idx = columns.index("url") if "url" in columns else -1
            
            for row in rows:
                place_id = row[id_idx]
                id_to_meta[place_id] = {
                    "name": row[name_idx],
                    "address": row[address_idx],
                    "url": row[url_idx] if url_idx != -1 else f"https://www.google.com/maps/place/?q=place_id:{place_id}"
                }
        except Exception as e:
            print("Error parsing index.js:", e)
else:
    print("Warning: index.js not found.")

# 2. Scan all JSON files in data/ai_review/
json_files = [f for f in os.listdir(ai_review_dir) if f.endswith(".json") and f not in ["contact_links.json", "cuisines_mapping.json", "manual_chain_branches.json"]]
print(f"Scanning {len(json_files)} restaurant detail files...")

high_chair_restaurants = []

for f in json_files:
    place_id = os.path.splitext(f)[0]
    filepath = os.path.join(ai_review_dir, f)
    
    try:
        with open(filepath, "r", encoding="utf-8-sig") as file:
            data = json.load(file)
            
        child_seat = data.get(" child_seat available") or data.get("child_seat available") or data.get("High chair available")
        if child_seat:
            result = child_seat.get("result")
            evidence = child_seat.get("evidence") or ""
            
            # Check if this attribute is from Google Maps (i.e. starts with Google or contains CP950-garbled string)
            is_google_attr = False
            clean_evidence = evidence
            
            if "Google" in evidence or "摰" in evidence:
                is_google_attr = True
                if "摰" in evidence:
                    # Fix the garbled cp950 encoding to a readable Traditional Chinese string
                    clean_evidence = "Google 官方登記提供兒童座椅"
            
            if result == "Yes" and is_google_attr:
                meta = id_to_meta.get(place_id, {
                    "name": "Unknown",
                    "address": "Unknown",
                    "url": f"https://www.google.com/maps/place/?q=place_id:{place_id}"
                })
                
                high_chair_restaurants.append({
                    "Place ID": place_id,
                    "餐廳名稱": meta["name"],
                    "地址": meta["address"],
                    "Google 地圖網址": meta["url"],
                    "高腳椅屬性": "提供 (Yes)",
                    "佐證/說明": clean_evidence
                })
    except Exception as e:
        print(f"Error reading {f}: {e}")

# 3. Write to CSV with UTF-8 BOM so it opens correctly in Excel on Windows
print(f"Writing {len(high_chair_restaurants)} restaurants to {output_csv_path}...")
with open(output_csv_path, "w", encoding="utf-8-sig", newline="") as csvfile:
    fieldnames = ["Place ID", "餐廳名稱", "地址", "Google 地圖網址", "高腳椅屬性", "佐證/說明"]
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    
    writer.writeheader()
    for row in high_chair_restaurants:
        writer.writerow(row)

print("Done! CSV successfully generated.")
