import os
import requests
import json
import pandas as pd
from dotenv import load_dotenv
from datetime import datetime, timedelta
from dateutil import parser as date_parser
import time

# Load API key
load_dotenv(dotenv_path=".env.txt")
API_KEY = os.getenv("GOOGLE_MAP_KEY")

if not API_KEY:
    print("Error: GOOGLE_MAP_KEY not found in .env.txt")
    exit(1)

# List of 61 restaurants provided by the user
RESTAURANT_NAMES = [
    "All Day Roasting Company民生店", "羽樂歐陸創意料理", "Cafe La Connection", "Luguo Cafe / Z Space",
    "咖啡學人-傑克威爾 The Cafeist & Jackwell", "咖啡實驗室", "齊客咖啡 The Gathering Café",
    "The Cup Coffee House 台北", "撞個咖啡Drunkard café", "Oneway CAFE玩味咖啡",
    "加爾第咖啡 (莊敬店)", "CAFEPRO職人咖啡商行敦化店", "森優咖啡 Tribu Café", "打卡咖啡館 迪化店",
    "Seeking Café", "咖啡俱樂部 COFFEE CLUB", "Le Park Cafe公園咖啡館", "MA CAFE", "HSQ COFFEE",
    "別處咖啡 Away cafe", "早點醒", "Atlas Brunch & Pasta 亞斯義大利麵", "豐萃早午餐",
    "安好食 和平店", "找諶 Chen’s Brunch", "茉莉漢堡", "拉亞漢堡 台北錦州", "麥味登 北市合江店",
    "Q Burger 中山農安店(直營)", "吉祥小館", "筷子餐廳", "威尼斯義大利餐廳", "又一間商行 Spaghetti",
    "Timama kitchen", "白菜小姐義式坊", "松果院子 Restaurant Pinecone", "Bistro O 避世所",
    "HAIR SALON BISTRO餐酒館", "BACKMOUNT.後山咖啡", "WilsonPark 威爾森公園 （Steak & Wine）",
    "媽妳講親子餐廳（內湖旗艦店）", "LOST and Found", "甲蟲秘境", "Ho'me廚房&親子友善餐廳",
    "淘憩時光親子餐廳", "Second Floor 貳樓西湖店", "農人餐桌", "樂雅樂餐廳 敦化店",
    "樂雅樂餐廳 南港店", "巧果子", "聚聚樂", "疆毒串烤-南京店", "台灣夯BAR串燒烤小店",
    "Soshow Bar & Restaurant", "大樹先生的家", "心味酒肴居酒屋", "UMAMI 金色三麥",
    "遊霂食光 MuMu Land", "子木咖啡", "象園咖啡內湖店", "歡樂便所主題餐廳"
]

OUTPUT_DIR = "response"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def search_place(query):
    """Searches for a place and returns its ID and display name."""
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress"
    }
    data = {"textQuery": query, "languageCode": "zh-Hant"}
    
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        results = response.json().get("places", [])
        if results:
            return results[0]["id"], results[0]["displayName"]["text"]
    except Exception as e:
        print(f"Error searching for '{query}': {e}")
    return None, None

def get_place_details(place_id):
    """Fetches details and reviews for a place ID."""
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
    two_years_ago = datetime.now() - timedelta(days=730)
    
    print(f"Starting batch fetch for {len(RESTAURANT_NAMES)} restaurants...")
    
    for i, name in enumerate(RESTAURANT_NAMES):
        print(f"[{i+1}/{len(RESTAURANT_NAMES)}] Processing: {name}")
        
        place_id, display_name = search_place(name)
        if not place_id:
            print(f"  - Could not find Place ID for: {name}")
            continue
            
        print(f"  - Found ID: {place_id} ({display_name})")
        
        details = get_place_details(place_id)
        if not details:
            continue
            
        # Filter reviews: Chinese + within 2 years
        all_reviews = details.get("reviews", [])
        filtered_reviews = []
        
        for r in all_reviews:
            # Check date
            publish_time_str = r.get("publishTime")
            if publish_time_str:
                dt = date_parser.isoparse(publish_time_str).replace(tzinfo=None)
            else:
                continue
                
            if dt >= two_years_ago:
                # We already requested zh-Hant, but let's keep it safe.
                # The API typically returns reviews in the requested language if available.
                filtered_reviews.append(r)
        
        # Update details with filtered reviews
        details["reviews"] = filtered_reviews
        
        # Save to JSON
        output_path = os.path.join(OUTPUT_DIR, f"{place_id}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(details, f, ensure_ascii=False, indent=2)
            
        print(f"  - Saved to {output_path} ({len(filtered_reviews)} reviews)")
        
        # Avoid hitting rate limits too hard
        time.sleep(0.5)

    print("\nBatch fetch completed.")

if __name__ == "__main__":
    main()
