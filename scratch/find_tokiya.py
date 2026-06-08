import os
import json
import glob

response_dir = "response"
ai_review_dir = "ai_review"

files = glob.glob(os.path.join(response_dir, "*.json"))
print(f"Scanning {len(files)} files in {response_dir}...")

for filepath in files:
    try:
        with open(filepath, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
        name = data.get("displayName", {}).get("text", "")
        if "陶板屋" in name:
            place_id = os.path.splitext(os.path.basename(filepath))[0]
            print(f"\nFound Tokiya: {name} (ID: {place_id})")
            
            # Check corresponding ai_review
            ai_path = os.path.join(ai_review_dir, f"{place_id}.json")
            if os.path.exists(ai_path):
                with open(ai_path, "r", encoding="utf-8-sig") as f2:
                    ai_data = json.load(f2)
                # Print only Yes/No features
                features = {}
                for key in [" child_seat available", "Spacious seating", "Kids menu available", "kid_noise_tolerant", "has_play_area", "has_private_room", "has_tableware", "has_diaper_table"]:
                    if key in ai_data:
                        features[key.strip()] = ai_data[key].get("result")
                print(f"  AI Review Features: {features}")
            else:
                print("  No AI Review file found.")
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
