import os
import json
import csv

base_dir = r"c:\Users\aou\Desktop\Alice\Study\side project\restaurant map"
ai_review_dir = os.path.join(base_dir, "ai_review")
response_dir = os.path.join(base_dir, "response")

# 1. Get all place_ids from ai_review
ai_files = [f for f in os.listdir(ai_review_dir) if f.endswith(".json")]
skipped_ids = []

for f in ai_files:
    place_id = os.path.splitext(f)[0]
    response_path = os.path.join(response_dir, f"{place_id}.json")
    if not os.path.exists(response_path):
        skipped_ids.append(place_id)

print(f"Total skipped place IDs (missing response JSON): {len(skipped_ids)}")

# 2. Build a mapping of place_id -> name from all potential files in the workspace
id_to_name = {}

# Helper to add from CSV
def add_from_csv(file_path, id_col, name_col):
    full_path = os.path.join(base_dir, file_path)
    if os.path.exists(full_path):
        try:
            with open(full_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    pid = row.get(id_col)
                    name = row.get(name_col)
                    if pid and name:
                        id_to_name[pid.strip()] = name.strip()
        except Exception as e:
            print(f"Error reading CSV {file_path}: {e}")

# Helper to add from JSON list/dict
def add_from_json(file_path):
    full_path = os.path.join(base_dir, file_path)
    if os.path.exists(full_path):
        try:
            with open(full_path, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict):
                            pid = item.get("place_id") or item.get("placeId")
                            name = item.get("name") or item.get("displayName")
                            if pid and name:
                                if isinstance(name, dict):
                                    name = name.get("text")
                                id_to_name[pid] = name
                elif isinstance(data, dict):
                    # check if format is id -> dict
                    for pid, val in data.items():
                        if isinstance(val, dict):
                            name = val.get("name") or val.get("displayName")
                            if isinstance(name, dict):
                                name = name.get("text")
                            if name:
                                id_to_name[pid] = name
        except Exception as e:
            print(f"Error reading JSON {file_path}: {e}")

# Add from known files
add_from_json("expanded_restaurants.json")
add_from_json("expanded_restaurants_enriched.json")
add_from_json("taipei_locations_complete.json")
add_from_json("missing_restaurants.json")

add_from_csv("aggregated_restaurants.csv", "place_id", "name")
add_from_csv("annotated_v2.csv", "place_id", "name")
add_from_csv("annotated_v3_with_signals.csv", "place_id", "name")
add_from_csv("annotated_v5_signals_final.csv", "place_id", "name")
add_from_csv("restaurants_refined_v8.csv", "place_id", "name")
add_from_csv("feedback.csv", "place_id", "name")

# 3. Match skipped place IDs and report names
results = []
for pid in skipped_ids:
    name = id_to_name.get(pid, "Unknown Name")
    results.append((pid, name))

# Sort by name
results.sort(key=lambda x: x[1])

print("\n--- List of Restaurants Missing Response Data ---")
for idx, (pid, name) in enumerate(results, 1):
    print(f"{idx}. {name} (Place ID: {pid})")

# Write output to a file for easy reading
out_path = os.path.join(base_dir, "scratch", "skipped_restaurants_list.txt")
with open(out_path, "w", encoding="utf-8") as f:
    f.write("List of Restaurants with missing response data:\n")
    for idx, (pid, name) in enumerate(results, 1):
        f.write(f"{idx}. {name} (Place ID: {pid})\n")
print(f"\nWritten details to {out_path}")
