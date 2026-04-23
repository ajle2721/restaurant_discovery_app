import os
import requests
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

# List of Place IDs
PLACE_IDS = [
    "ChIJlVNfWeqrQjQRqO4OMZ0keZ4",
    "ChIJfzjbheitQjQRa3PNwDBxq6E",
    "ChIJsS8FHNyvQjQRwtaRVpPMyAI",
    "ChIJCyKuHW-sQjQRLbLgae6QWSU",
    "ChIJaSZ-CpupQjQRaqvVbaJ4FaM"
]

def fetch_reviews(place_id):
    """
    Fetches reviews for a given place_id using Google Places API (New).
    Note: Limited to 5 reviews by Google.
    """
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    params = {
        "fields": "displayName,reviews",
        "key": API_KEY,
        "languageCode": "zh-Hant" # Request Traditional Chinese reviews
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        restaurant_name = data.get("displayName", {}).get("text", "Unknown")
        reviews = data.get("reviews", [])
        
        return restaurant_name, reviews
    except Exception as e:
        print(f"Error fetching data for Place ID {place_id}: {e}")
        return "Error", []

def main():
    all_rows = []
    one_year_ago = datetime.now() - timedelta(days=365)
    output_file = "restaurant_reviews.csv"
    
    # Load existing reviews if file exists
    existing_df = pd.DataFrame()
    if os.path.exists(output_file):
        try:
            existing_df = pd.read_csv(output_file)
            print(f"Loaded {len(existing_df)} existing reviews from {output_file}")
        except Exception as e:
            print(f"Error loading existing CSV: {e}")

    print("Starting to fetch Chinese reviews...")
    
    for pid in PLACE_IDS:
        name, reviews = fetch_reviews(pid)
        print(f"Fetched {len(reviews)} reviews for: {name}")
        
        for r in reviews:
            publish_time_str = r.get("publishTime")
            if publish_time_str:
                dt = date_parser.isoparse(publish_time_str).replace(tzinfo=None)
            else:
                dt = datetime.now()

            if dt >= one_year_ago:
                all_rows.append({
                    "Restaurant Name": name,
                    "Place ID": pid,
                    "Reviewer": r.get("authorAttribution", {}).get("displayName", "Anonymous"),
                    "Rating": r.get("rating"),
                    "Text": r.get("text", {}).get("text", ""),
                    "Relative Time": r.get("relativePublishTimeDescription"),
                    "Publish Time": publish_time_str
                })
    
    if all_rows:
        new_df = pd.DataFrame(all_rows)
        # Combine with existing reviews
        if not existing_df.empty:
            combined_df = pd.concat([existing_df, new_df], ignore_index=True)
        else:
            combined_df = new_df
            
        # Remove duplicates based on Restaurant Name, Reviewer, and Text
        # This prevents identical reviews from being added twice if they were fetched before
        combined_df.drop_duplicates(subset=["Restaurant Name", "Reviewer", "Text"], keep="first", inplace=True)
        
        combined_df.to_csv(output_file, index=False, encoding="utf-8-sig")
        print(f"Successfully updated {output_file}. Total reviews: {len(combined_df)}")
    else:
        print("No new reviews found within the last year for these places.")

if __name__ == "__main__":
    main()
