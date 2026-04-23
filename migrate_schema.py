import json
import re
import os

base_dir = r"c:\Users\jason\OneDrive\桌面\restaurant map"
ai_review_dir = os.path.join(base_dir, "ai_review")
data_js_path = os.path.join(base_dir, "data.js")

def main():
    if not os.path.exists(data_js_path):
        print(f"Error: {data_js_path} not found.")
        return

    with open(data_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
    if not match:
        print("Could not find restaurantData array in data.js")
        return
    
    data = json.loads(match.group(1))
    
    attr_map = {
        "High chair available": "high_chair_available",
        "Kids menu available": "kids_menu",
        "Spacious seating": "spacious_seating",
        "kid_noise_tolerant": "kid_noise_tolerant"
    }
    
    updated_count = 0
    for item in data:
        place_id = item.get("place_id")
        if not place_id:
            continue
            
        json_path = os.path.join(ai_review_dir, f"{place_id}.json")
        
        # If we have the raw AI analysis JSON, use it as the source of truth
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as jf:
                analysis_data = json.load(jf)
            
            new_attrs = {}
            for raw_key, attr_key in attr_map.items():
                res = analysis_data.get(raw_key, {}).get("result", "Unknown")
                # Map Raw Results to lowercase ternary strings
                if res == "Yes":
                    new_attrs[attr_key] = "yes"
                elif res == "No":
                    new_attrs[attr_key] = "no"
                else:
                    new_attrs[attr_key] = "unknown"
            
            item["attributes"] = new_attrs
            updated_count += 1
        else:
            # Fallback for entries without JSON files (should be 0 given my inventory)
            # Default to "unknown" for all attributes if missing JSON, unless true.
            old_attrs = item.get("attributes", {})
            new_attrs = {}
            for k in attr_map.values():
                val = old_attrs.get(k)
                if val is True:
                    new_attrs[k] = "yes"
                else:
                    new_attrs[k] = "unknown"
            item["attributes"] = new_attrs

    # Save back to data.js
    with open(data_js_path, 'w', encoding='utf-8') as out:
        # Using 2-space indent as in previous versions
        out.write("const restaurantData = " + json.dumps(data, ensure_ascii=False, indent=2) + ";")
    
    print(f"Successfully migrated {len(data)} restaurants to 3-state logic in data.js.")

if __name__ == "__main__":
    main()
