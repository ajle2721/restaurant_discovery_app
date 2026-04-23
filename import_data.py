import json
import re

def extract_place_id(url):
    if not url: return None
    match = re.search(r"query_place_id=([^&]+)", url)
    return match.group(1) if match else None

def main():
    # 1. Load existing data.js
    with open('data.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to find the array. Warning: this assumes standard formatting.
    # Looking for: const restaurantData = [ ... ];
    match = re.search(r"const restaurantData = (\[[\s\S]*\]);?", content)
    if not match:
        print("Error: Could not find restaurantData array in data.js")
        return
        
    js_data_str = match.group(1)
    # The JS data in data.js looks like JSON (double quotes, no trailing commas).
    try:
        existing_data = json.loads(js_data_str)
    except json.JSONDecodeError as e:
        print(f"Error decoding existing data as JSON: {e}")
        # If it's not pure JSON (e.g. has trailing commas), we might need a more flexible parser.
        # But let's check the file first.
        return

    existing_ids = {extract_place_id(r.get('url')) for r in existing_data if extract_place_id(r.get('url'))}
    
    # 2. Load new expanded_restaurants.json
    with open('expanded_restaurants.json', 'r', encoding='utf-8') as f:
        new_data = json.load(f)
        
    # 3. Merge and unify schema
    merged_data = []
    
    # Process existing 61
    for r in existing_data:
        pid = extract_place_id(r.get('url'))
        # Ensure it has the new required fields (even if blank)
        r['place_id'] = pid or ""
        r['formatted_address'] = r.get('address', "")
        r['district'] = r.get('district', "") # Usually blank for old ones
        r['user_ratings_total'] = r.get('user_ratings_total', 0)
        r['latitude'] = r.get('latitude', None)
        r['longitude'] = r.get('longitude', None)
        r['reviews'] = r.get('reviews', [])
        r['google_maps_url'] = r.get('url', "")
        merged_data.append(r)
        
    # Append new 360 (skipping duplicates)
    for r in new_data:
        pid = r.get('place_id')
        if pid and pid in existing_ids:
            continue
            
        # Map to unified schema
        new_entry = {
            "place_id": pid,
            "name": r.get('name', ""),
            "address": r.get('formatted_address', ""), # Kept for backward compatibility
            "formatted_address": r.get('formatted_address', ""),
            "district": r.get('district', ""),
            "rating": str(r.get('rating', "0")), # Existing ones use strings like "4.6"
            "user_ratings_total": r.get('user_ratings_total', 0),
            "latitude": r.get('latitude', None),
            "longitude": r.get('longitude', None),
            "url": f"https://www.google.com/maps/search/?api=1&query={r.get('name')}&query_place_id={pid}", # Kept for backward compatibility
            "google_maps_url": f"https://www.google.com/maps/search/?api=1&query={r.get('name')}&query_place_id={pid}",
            "attributes": {
                "high_chair_available": None,
                "kids_menu": None,
                "spacious_seating": None,
                "kid_noise_tolerant": None
            },
            "ai_summary": "",
            "signals": [],
            "reviews": r.get('reviews', [])[:3] # Up to 3
        }
        merged_data.append(new_entry)
        
    # 4. Write back to data.js
    new_content = f"const restaurantData = {json.dumps(merged_data, indent=2, ensure_ascii=False)};"
    
    with open('data.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f"Successfully merged {len(merged_data)} restaurants into data.js")
    print(f"Added {len(merged_data) - len(existing_data)} new entries.")

if __name__ == "__main__":
    main()
