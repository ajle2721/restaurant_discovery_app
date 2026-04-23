import os
import json
import pandas as pd

SOURCE_DIR = "response"
OUTPUT_FILE = "aggregated_restaurants.csv"

def format_review(review):
    """Formats a review dictionary into a single string."""
    if not review:
        return ""
    
    author = review.get("authorAttribution", {}).get("displayName", "匿名")
    time = review.get("publishTime", "未知時間")
    rating = review.get("rating", "無評分")
    text = review.get("text", {}).get("text", "").replace("\n", " ").strip()
    
    return f"[{author} | {time} | {rating}分]: {text}"

def main():
    all_data = []
    
    if not os.path.exists(SOURCE_DIR):
        print(f"Error: Directory '{SOURCE_DIR}' not found.")
        return

    json_files = [f for f in os.listdir(SOURCE_DIR) if f.endswith(".json")]
    print(f"Processing {len(json_files)} JSON files...")

    for filename in json_files:
        filepath = os.path.join(SOURCE_DIR, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            place_id = data.get("id")
            name = data.get("displayName", {}).get("text", "未知")
            address = data.get("formattedAddress", "未知")
            overall_rating = data.get("rating", "N/A")
            
            # Google Map Link
            map_url = f"https://www.google.com/maps/search/?api=1&query_place_id={place_id}" if place_id else ""
            
            row = {
                "餐廳名稱": name,
                "Google Map地址": address,
                "評分": overall_rating,
                "Google Map網址": map_url
            }
            
            # Process up to 5 reviews
            reviews = data.get("reviews", [])
            for i in range(1, 6):
                review_content = ""
                if i <= len(reviews):
                    review_content = format_review(reviews[i-1])
                row[f"評論{i}"] = review_content
            
            all_data.append(row)
            
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    if all_data:
        # Reorder columns to match user requirement:
        # 餐廳名稱、Google Map地址、評分、評論1~5、Google Map網址
        columns = ["餐廳名稱", "Google Map地址", "評分", "評論1", "評論2", "評論3", "評論4", "評論5", "Google Map網址"]
        df = pd.DataFrame(all_data, columns=columns)
        
        df.to_csv(OUTPUT_FILE, index=False, encoding="utf-8-sig")
        print(f"Successfully aggregated data to {OUTPUT_FILE}")
    else:
        print("No data found to aggregate.")

if __name__ == "__main__":
    main()
