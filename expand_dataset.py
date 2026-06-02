import os
import re
import glob
import json
import time
import argparse
import urllib.request
import urllib.parse
import urllib.error
import math
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

def calculate_distance(lat1, lon1, lat2, lon2):
    if not lat1 or not lon1 or not lat2 or not lon2:
        return float('inf')
    R = 6371.0  # Radius of the earth in km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2) * math.sin(dLat/2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dLon/2) * math.sin(dLon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c  # Distance in km

def load_env():
    # Try .env first, then .env.txt as fallback
    for env_file in [".env", ".env.txt"]:
        if os.path.exists(env_file):
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ[key.strip()] = val.strip()

load_env()
API_KEY = os.environ.get("GOOGLE_MAP_KEY")

if not API_KEY:
    print("[ERROR] GOOGLE_MAP_KEY not found in .env or .env.txt")
    exit(1)

DISTRICTS = [
    "中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", 
    "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"
]

# Primary query terms to search for family-friendly, breakfast/brunch, cafes and popular food
SEARCH_QUERIES = ["親子餐廳", "親子友善餐廳", "早午餐", "義大利麵", "披薩", "咖啡廳", "家庭餐廳"]

RESPONSE_DIR = "response"
os.makedirs(RESPONSE_DIR, exist_ok=True)

def load_locations_js():
    """Parses locations.js dynamically using regex and returns the locationData list."""
    filepath = "locations.js"
    if not os.path.exists(filepath):
        print(f"[ERROR] {filepath} not found in the current directory.")
        return []
    
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Regex to capture the array assigned to locationData
        match = re.search(r'var\s+locationData\s*=\s*(\[.*\]);', content, re.DOTALL)
        if match:
            raw_json = match.group(1)
            # Remove minor JS stubs if any or trailing commas
            return json.loads(raw_json)
    except Exception as e:
        print(f"[ERROR] parsing locations.js: {e}")
    return []

def get_existing_places():
    """Scans response/ directory for existing files and counts them by district."""
    existing_ids = set()
    district_counts = {d: 0 for d in DISTRICTS}
    
    files = glob.glob(os.path.join(RESPONSE_DIR, "*.json"))
    print(f"[DATA] Scanning {len(files)} existing restaurant profiles in '{RESPONSE_DIR}/'...")
    
    for filepath in files:
        place_id = os.path.splitext(os.path.basename(filepath))[0]
        existing_ids.add(place_id)
        
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Identify district from address
            address = data.get("formattedAddress") or data.get("formatted_address") or ""
            matched = False
            for d in DISTRICTS:
                if d in address:
                    district_counts[d] += 1
                    matched = True
                    break
            # Fallback check on display text or keywords
            if not matched:
                disp = data.get("displayName", {}).get("text", "")
                for d in DISTRICTS:
                    if d in disp:
                        district_counts[d] += 1
                        break
        except Exception:
            pass
            
    return existing_ids, district_counts

def search_places_stage1(query, lat, lng, page_token=None):
    """
    Stage 1 API call: Perform location-restricted Text Search (600m radius circle).
    Requests ONLY Essentials & Pro fields (very cheap: $7/1,000 requests) to save costs.
    Uses zero-dependency urllib.request.
    """
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.types,nextPageToken"
    }
    
    data = {
        "textQuery": query,
        "languageCode": "zh-Hant",
        "pageSize": 20,
        "locationBias": {
            "circle": {
                "center": {
                    "latitude": lat,
                    "longitude": lng
                },
                "radius": 600.0  # 600 meters radial restriction (~10 minutes walk)
            }
        }
    }
    
    if page_token:
        data["pageToken"] = page_token
        
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            error_body = e.read().decode("utf-8")
            print(f"  [WARNING] Stage 1 Search HTTP Error {e.code} for '{query}': {error_body}")
        except Exception:
            print(f"  [WARNING] Stage 1 Search HTTP Error {e.code} for '{query}': {e}")
        return {}
    except Exception as e:
        print(f"  [WARNING] Stage 1 Search Error for '{query}' at {lat},{lng}: {e}")
        return {}

def fetch_place_details_stage2(place_id):
    """
    Stage 2 API call: Retrieve comprehensive details (including reviews and editorialSummary).
    Called ONLY for unique candidate restaurants that passed our local filtration.
    Uses zero-dependency urllib.request.
    """
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    params = {
        "fields": "id,displayName,formattedAddress,rating,userRatingCount,reviews,types,location,websiteUri,internationalPhoneNumber,priceLevel,editorialSummary",
        "key": API_KEY,
        "languageCode": "zh-Hant"
    }
    
    url_with_params = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url_with_params)
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            error_body = e.read().decode("utf-8")
            print(f"  [ERROR] Stage 2 Details HTTP Error {e.code} for ID {place_id}: {error_body}")
        except Exception:
            print(f"  [ERROR] Stage 2 Details HTTP Error {e.code} for ID {place_id}: {e}")
        return None
    except Exception as e:
        print(f"  [ERROR] Stage 2 Details Fetch Error for Place ID {place_id}: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Strategically expand the restaurant dataset to 1,200 places.")
    parser.add_argument("--test", action="store_true", help="Run a dry-run test (processes only 1 district, 1 landmark, 1 fetch).")
    args = parser.parse_args()

    print("[SYSTEM] Taipei Kid-Friendly Restaurant Strategic Dataset Expander")
    print("=========================================================")

    # 1. Load landmarks from locations.js
    all_locations = load_locations_js()
    landmarks = [loc for loc in all_locations if loc.get("type") in ["捷運站", "捷運站/商圈", "商圈/捷運站", "捷運站/地標", "地標/景點", "公園/親子景點", "親子景點", "地標/藝文"]]
    print(f"[INFO] Loaded {len(landmarks)} key landmarks/stations from locations.js")

    if not landmarks:
        print("[ERROR] No landmark coordinates found in locations.js. Exiting.")
        return

    # 2. Scan existing database to find counts by district
    existing_ids, district_counts = get_existing_places()
    
    print("\n[DATA] Current Database Balanced District Counts:")
    for dist in DISTRICTS:
        print(f"  - {dist}: {district_counts[dist]} restaurants")
    
    target_per_district = 100
    if args.test:
        print("\n[TEST] Running in TEST mode. Overriding targets to 1 district.")
        active_districts = ["文山區"]
        target_per_district = district_counts["文山區"] + 1
    else:
        active_districts = DISTRICTS

    newly_fetched_total = 0

    for district in active_districts:
        current_count = district_counts.get(district, 0)
        needed = target_per_district - current_count
        
        if needed <= 0:
            print(f"\n[INFO] {district} is already balanced with {current_count} restaurants (Target: {target_per_district}). Skipping.")
            continue
            
        print(f"\n[SCAN] Scanning '{district}' (Current: {current_count}, Target: {target_per_district}, Needed: {needed})")
        
        # Filter landmarks for this specific district
        district_landmarks = [lm for lm in landmarks if lm.get("district") == district]
        
        # Fallback: if no landmarks specifically tagged with this district, find closest coordinates
        if not district_landmarks:
            print(f"  [WARNING] No landmarks directly matched for '{district}'. Skipping.")
            continue

        if args.test:
            district_landmarks = district_landmarks[:1]
            print(f"  [TEST] Test mode: Limited to 1 landmark: '{district_landmarks[0]['name']}'")

        district_collected_ids = set()
        candidates = []

        # Stage 1: Gather candidates from all landmarks in this district using cheap searchText API
        for lm in district_landmarks:
            lm_name = lm.get("name")
            lat = lm.get("lat")
            lng = lm.get("lng")
            
            print(f"  [Stage 1] Scanning 600m radius around landmark: {lm_name} ({lat}, {lng})")
            
            for query in SEARCH_QUERIES:
                if len(candidates) >= needed * 3: # Gather surplus candidates to allow strict local filtering
                    break
                
                page_token = None
                pages = 0
                max_pages = 1 if args.test else 2
                
                while pages < max_pages:
                    results = search_places_stage1(query, lat, lng, page_token)
                    places = results.get("places", [])
                    
                    for p in places:
                        pid = p.get("id")
                        if not pid or pid in existing_ids or pid in district_collected_ids:
                            continue
                        
                        # Validate that the candidate coordinates are within 600m (0.6 km) of the landmark!
                        loc = p.get("location", {})
                        p_lat = loc.get("latitude")
                        p_lng = loc.get("longitude")
                        if p_lat and p_lng:
                            dist = calculate_distance(lat, lng, p_lat, p_lng)
                            if dist > 0.6: # Exclude if outside 600m
                                continue
                        
                        # Apply strict quality filters in memory to avoid calling Place Details on bad places
                        rating = p.get("rating", 0)
                        rating_count = p.get("userRatingCount", 0)
                        types = p.get("types", [])
                        
                        # Exclude low-rated or unpopular places
                        if rating < 4.0 or rating_count < 15:
                            continue
                            
                        # Exclude non-eating places (make sure it's a food establishment, cafe, or restaurant)
                        valid_types = {'restaurant', 'cafe', 'food', 'coffee_shop', 'brunch_restaurant'}
                        if not any(t in valid_types for t in types):
                            continue
                        
                        candidates.append(p)
                        district_collected_ids.add(pid)
                    
                    page_token = results.get("nextPageToken")
                    if not page_token:
                        break
                    pages += 1
                    time.sleep(0.2)
            
            if len(candidates) >= needed * 2:
                break

        print(f"  [STAGE 1 RESULT] Found {len(candidates)} high-quality candidates in memory for {district}.")

        # Stage 2: Fetch detailed info (reviews + summary) for the new unique places up to targeted needed count
        fetched_count = 0
        for p in candidates:
            if fetched_count >= needed:
                break
                
            pid = p.get("id")
            name = p.get("displayName", {}).get("text", "Unknown")
            
            # Double check deduplication
            output_path = os.path.join(RESPONSE_DIR, f"{pid}.json")
            if os.path.exists(output_path):
                continue
                
            print(f"  [Stage 2] Fetching reviews & details for: {name} (ID: {pid})...")
            details = fetch_place_details_stage2(pid)
            
            if details:
                # Save place profile JSON directly to response/
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(details, f, ensure_ascii=False, indent=2)
                
                fetched_count += 1
                newly_fetched_total += 1
                existing_ids.add(pid) # Add to active session existing set
                print(f"    [SUCCESS] Saved details to {output_path}")
                
                if args.test:
                    print("  [TEST] Test mode: Successful detail fetch completed. Exiting loop.")
                    break
                
                # Sleep briefly to be respectful to rate limits and cloud credits
                time.sleep(0.5)
                
        print(f"  [SUCCESS] Completed '{district}': Successfully added {fetched_count} new balanced restaurants!")
        
        if args.test:
            break

    print(f"\n=========================================================")
    print(f"[SUCCESS] Data Expansion Finished. Total newly added restaurants: {newly_fetched_total}")
    print("[INFO] Run 'node build-ai-review-index.mjs' to regenerate the frontend bundle index.")

if __name__ == "__main__":
    main()
