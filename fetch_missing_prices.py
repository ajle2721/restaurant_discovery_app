import os
import requests
import json
import time
from datetime import datetime, timedelta
from dateutil import parser as date_parser
from dotenv import load_dotenv

# Load API key from .env.txt
load_dotenv(dotenv_path=".env.txt")
API_KEY = os.getenv("GOOGLE_MAP_KEY")

if not API_KEY:
    # Try reading directly from file if dotenv doesn't load it
    if os.path.exists(".env.txt"):
        with open(".env.txt", "r") as f:
            for line in f:
                if line.startswith("GOOGLE_MAP_KEY="):
                    API_KEY = line.strip().split("=")[1].strip('"').strip("'")
                    break

if not API_KEY:
    print("Error: GOOGLE_MAP_KEY not found in .env.txt")
    print("Please set your Google Maps API key in .env.txt as GOOGLE_MAP_KEY=YOUR_KEY")
    exit(1)

RESPONSE_DIR = "response"

def get_place_details(place_id):
    """Fetches details and reviews for a place ID from Google Places API (New)."""
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    params = {
        "fields": "id,displayName,formattedAddress,rating,userRatingCount,reviews,types,location,websiteUri,internationalPhoneNumber,priceLevel",
        "key": API_KEY,
        "languageCode": "zh-Hant"
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"  - Error calling Places API for {place_id}: {e}")
    return None

def main():
    if not os.path.exists(RESPONSE_DIR):
        print(f"Error: {RESPONSE_DIR} directory does not exist.")
        exit(1)

    print("Step 1: Scanning response JSON files for missing priceLevel...")
    missing_ids = []
    
    for fn in os.listdir(RESPONSE_DIR):
        if not fn.endswith(".json"):
            continue
        
        path = os.path.join(RESPONSE_DIR, fn)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # If priceLevel is missing or empty, add to list
            if "priceLevel" not in data or not data["priceLevel"]:
                place_id = os.path.splitext(fn)[0]
                missing_ids.append((place_id, data.get("displayName", {}).get("text", "Unknown")))
        except Exception as e:
            print(f"  - Error reading {fn}: {e}")

    total_missing = len(missing_ids)
    print(f"Found {total_missing} restaurants lacking priceLevel info.")
    
    if total_missing == 0:
        print("All restaurants already have priceLevel info. No action needed.")
        return

    # Keep reviews within the last 2 years (matching fetch_details.py logic)
    two_years_ago = datetime.now() - timedelta(days=730)
    success_count = 0
    
    print("\nStep 2: Starting batch fetch from Google Places API...")
    for index, (place_id, name) in enumerate(missing_ids):
        print(f"[{index+1}/{total_missing}] Fetching: {name} ({place_id})")
        
        details = get_place_details(place_id)
        if not details:
            print(f"  - Failed to fetch details for {name}")
            continue

        # Filter reviews to keep only recent ones (within 2 years)
        all_reviews = details.get("reviews", [])
        filtered_reviews = []
        for r in all_reviews:
            publish_time_str = r.get("publishTime")
            if publish_time_str:
                try:
                    dt = date_parser.isoparse(publish_time_str).replace(tzinfo=None)
                    if dt >= two_years_ago:
                        filtered_reviews.append(r)
                except Exception:
                    pass
        details["reviews"] = filtered_reviews

        # Save back to file
        output_path = os.path.join(RESPONSE_DIR, f"{place_id}.json")
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(details, f, ensure_ascii=False, indent=2)
            
            has_price = "priceLevel" in details
            price_val = details.get("priceLevel", "NONE")
            print(f"  - Updated. Price returned: {price_val} (Has price: {has_price})")
            success_count += 1
        except Exception as e:
            print(f"  - Error saving {place_id}.json: {e}")

        # Throttle to avoid rate limiting (0.5s per request)
        time.sleep(0.5)

    print(f"\nCompleted! Successfully updated {success_count}/{total_missing} restaurants.")
    print("Please run '.\\fix_index_now.ps1' (or 'node build-ai-review-index.mjs') to compile the new database index, then commit and push changes!")

if __name__ == "__main__":
    main()
