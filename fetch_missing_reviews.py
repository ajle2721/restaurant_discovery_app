import os
import requests
import json
import time
from dotenv import load_dotenv
from datetime import datetime, timedelta
from dateutil import parser as date_parser

# Load API key
load_dotenv(dotenv_path=".env.txt")
API_KEY = os.getenv("GOOGLE_MAP_KEY")

if not API_KEY:
    # Try .env if .env.txt fails
    load_dotenv(dotenv_path=".env")
    API_KEY = os.getenv("GOOGLE_MAP_KEY")

if not API_KEY:
    print("Error: GOOGLE_MAP_KEY not found")
    exit(1)

INPUT_FILE = "missing_ids.txt"
OUTPUT_DIR = "response"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_place_details(place_id):
    """Fetches details and reviews for a place ID using Places API (New)."""
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    params = {
        "fields": "id,displayName,formattedAddress,rating,userRatingCount,reviews,types,location,websiteUri,internationalPhoneNumber",
        "key": API_KEY,
        "languageCode": "zh-Hant"
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error getting details for ID {place_id}: {e}")
    return None

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        place_ids = [line.strip() for line in f if line.strip()]

    two_years_ago = datetime.now() - timedelta(days=730)
    
    print(f"Starting batch fetch for {len(place_ids)} restaurants...")
    
    success_count = 0
    skip_count = 0

    for i, pid in enumerate(place_ids):
        output_path = os.path.join(OUTPUT_DIR, f"{pid}.json")
        
        if os.path.exists(output_path):
            # Skip if file is larger than 1KB (avoid re-fetching empty/small files)
            if os.path.getsize(output_path) > 100:
                skip_count += 1
                continue

        print(f"[{i+1}/{len(place_ids)}] Fetching ID: {pid}")
        
        details = get_place_details(pid)
        if not details:
            print(f"  - Failed to fetch details for {pid}")
            continue
            
        # Filter reviews: within 2 years
        all_reviews = details.get("reviews", [])
        filtered_reviews = []
        
        for r in all_reviews:
            publish_time_str = r.get("publishTime")
            if publish_time_str:
                try:
                    dt = date_parser.isoparse(publish_time_str).replace(tzinfo=None)
                    if dt >= two_years_ago:
                        filtered_reviews.append(r)
                except:
                    continue
        
        # Update details with filtered reviews
        details["reviews"] = filtered_reviews
        
        # Save to JSON
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(details, f, ensure_ascii=False, indent=2)
            
        success_count += 1
        print(f"  - Saved to {output_path} ({len(filtered_reviews)} reviews)")
        
        # Avoid hitting rate limits (2 RPS is usually safe for Basic/Standard)
        time.sleep(0.1)

    print(f"\nBatch fetch completed. Success: {success_count}, Skipped: {skip_count}")

if __name__ == "__main__":
    main()
