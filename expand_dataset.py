import os
import requests
import json
import time
from dotenv import load_dotenv

# Load API key
load_dotenv()
API_KEY = os.getenv("GOOGLE_MAP_KEY")

if not API_KEY:
    print("Error: GOOGLE_MAP_KEY not found in .env")
    exit(1)

DISTRICTS = [
    "信義區", "大安區", "中山區", "松山區", "內湖區", "中正區", 
    "大同區", "士林區", "北投區", "萬華區", "南港區", "文山區"
]
QUERIES = ["restaurant", "cafe", "brunch", "family restaurant", "親子餐廳"]

EXISTING_IDS_FILE = 'existing_ids.txt'
OUTPUT_FILE = 'expanded_restaurants.json'

def load_existing_ids():
    if os.path.exists(EXISTING_IDS_FILE):
        with open(EXISTING_IDS_FILE, 'r') as f:
            return set(line.strip() for line in f if line.strip())
    return set()

def search_places(query, district, next_page_token=None):
    """Searches for places using the New Places API (v1)."""
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.types,nextPageToken"
    }
    
    full_query = f"Taipei {district} {query}"
    data = {"textQuery": full_query, "languageCode": "zh-Hant", "pageSize": 20}
    if next_page_token:
        data["pageToken"] = next_page_token
        
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error searching for '{full_query}': {e}")
        return {}

def get_place_reviews(place_id):
    """Fetches top 3 reviews for a place."""
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    params = {
        "fields": "reviews",
        "key": API_KEY,
        "languageCode": "zh-Hant"
    }
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        res_json = response.json()
        reviews = res_json.get("reviews", [])
        return [r.get("text", {}).get("text", "") for r in reviews[:3]]
    except Exception as e:
        print(f"Error getting reviews for {place_id}: {e}")
        return []

def main():
    existing_ids = load_existing_ids()
    new_restaurants = []
    seen_ids = set()
    
    target_per_district = 30 # Aiming for 30+ new ones per district to ensure balance
    
    print(f"Starting expansion. Target: {target_per_district} new restaurants per district.")
    
    for district in DISTRICTS:
        district_collected = 0
        print(f"\nScanning District: {district}")
        
        for q in QUERIES:
            if district_collected >= target_per_district:
                break
                
            print(f"  Query: {q}")
            token = None
            pages_fetched = 0
            
            while pages_fetched < 3 and district_collected < target_per_district:
                result_batch = search_places(q, district, token)
                places = result_batch.get("places", [])
                
                for p in places:
                    pid = p.get("id")
                    if not pid or pid in existing_ids or pid in seen_ids:
                        continue
                    
                    # Basic quality filtering
                    rating_count = p.get("userRatingCount", 0)
                    if rating_count < 10:
                        continue
                        
                    # Extract data
                    res_data = {
                        "place_id": pid,
                        "name": p.get("displayName", {}).get("text", "Unknown"),
                        "formatted_address": p.get("formattedAddress", "Unknown"),
                        "rating": p.get("rating", 0),
                        "user_ratings_total": rating_count,
                        "latitude": p.get("location", {}).get("latitude"),
                        "longitude": p.get("location", {}).get("longitude"),
                        "district": district,
                        "types": p.get("types", [])
                    }
                    
                    # Fetch reviews
                    res_data["reviews"] = get_place_reviews(pid)
                    
                    new_restaurants.append(res_data)
                    seen_ids.add(pid)
                    district_collected += 1
                    
                    if district_collected % 5 == 0:
                        print(f"    - Collected {district_collected} in {district} (Total: {len(new_restaurants)})")
                    
                    if district_collected >= target_per_district:
                        break
                
                token = result_batch.get("nextPageToken")
                if not token:
                    break
                pages_fetched += 1
                time.sleep(1.0) # Slightly slower to avoid rate limits with many districts

    print(f"\nCollection finished. Total new unique restaurants: {len(new_restaurants)}")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(new_restaurants, f, ensure_ascii=False, indent=2)
    
    print(f"Data saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
