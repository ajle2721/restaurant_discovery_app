import os
import json

base_dir = os.getcwd()
ai_review_dir = os.path.join(base_dir, "ai_review")
index_js_path = os.path.join(ai_review_dir, "index.js")

def map_value(val):
    val_str = str(val or "").strip().lower()
    if val_str == "yes":
        return "Yes"
    if val_str == "no":
        return "No"
    return "Unknown"

def main():
    print("Unpacking index.js back to individual JSON files (Python version)...")
    
    if not os.path.exists(index_js_path):
        print(f"Error: {index_js_path} does not exist.")
        return

    # Read the index.js file
    with open(index_js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Locate the JSON array assignment
    start = content.find("[")
    end = content.rfind("]")
    if start == -1 or end == -1:
        print("Error: Could not locate JSON array inside index.js.")
        return

    json_str = content[start : end + 1]
    
    try:
        records = json.loads(json_str)
    except Exception as e:
        print(f"Error parsing JSON from index.js: {e}")
        return

    print(f"Parsed {len(records)} records from index.js.")

    updated_count = 0
    created_count = 0

    for record in records:
        place_id = record.get("place_id")
        if not place_id:
            continue

        json_filename = f"{place_id}.json"
        json_path = os.path.join(ai_review_dir, json_filename)

        # Load existing individual JSON if it exists, otherwise start fresh
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    file_content = f.read()
                    if file_content.startswith('\ufeff'):
                        file_content = file_content[1:]
                    ai_review_data = json.loads(file_content)
                updated_count += 1
            except Exception as e:
                print(f"Error reading existing file {json_path}: {e}. Overwriting.")
                ai_review_data = {}
                created_count += 1
        else:
            ai_review_data = {}
            created_count += 1

        # 1. Map attributes
        attrs = record.get("attributes", {})
        
        # High chair mapping: keep existing key if present
        high_chair_key = "child_seat available"
        for k in [" child_seat available", "child_seat available", "High chair available"]:
            if k in ai_review_data:
                high_chair_key = k
                break
        
        attr_mapping = {
            "high_chair_available": high_chair_key,
            "kids_menu": "Kids menu available",
            "spacious_seating": "Spacious seating",
            "kid_noise_tolerant": "kid_noise_tolerant",
            "has_play_area": "has_play_area",
            "has_private_room": "has_private_room",
            "has_tableware": "has_tableware",
            "has_diaper_table": "has_diaper_table"
        }

        for index_key, json_key in attr_mapping.items():
            if index_key in attrs:
                new_val = map_value(attrs[index_key])
                if json_key in ai_review_data and isinstance(ai_review_data[json_key], dict):
                    ai_review_data[json_key]["result"] = new_val
                    # Boost confidence to 1.0 if it is Yes/No and was low (e.g. 0.4)
                    if new_val in ["Yes", "No"] and ai_review_data[json_key].get("confidence", 0) <= 0.4:
                        ai_review_data[json_key]["confidence"] = 1.0
                else:
                    ai_review_data[json_key] = {
                        "result": new_val,
                        "evidence": None,
                        "confidence": 1.0 if new_val != "Unknown" else 0.4
                    }

        # 2. Map other top-level fields
        ai_review_data["generated_summary"] = record.get("ai_summary", "")
        ai_review_data["card_summary"] = record.get("card_summary", "")
        ai_review_data["generated_signals"] = record.get("signals", [])
        ai_review_data["parent_friendly_score"] = record.get("parent_friendly_score", 0)
        ai_review_data["parent_friendly_level"] = record.get("parent_friendly_level", "資訊不足")
        ai_review_data["reason"] = record.get("reason", "綜合評估")

        # Write the updated JSON back to file
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(ai_review_data, f, ensure_ascii=False, indent=4)
        except Exception as e:
            print(f"Error writing to {json_path}: {e}")

    print(f"Done! Updated {updated_count} files, created {created_count} files in {ai_review_dir}.")

if __name__ == "__main__":
    main()
