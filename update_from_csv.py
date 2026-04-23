import json
import csv
import re
import sys

# Set output to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def extract_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract the array from the JS file
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if not match:
        print("No JSON array found.")
        return None, None
    
    try:
        data = json.loads(match.group(0))
        return data, content[:match.start()], content[match.end():]
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        return None, None, None

def update_data(data, refined_csv_path):
    # Load refined summaries
    refined_map = {}
    with open(refined_csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            place_id = row.get('place_id')
            refined_summary = row.get('ai_summary_refined')
            if place_id and refined_summary:
                refined_map[place_id] = refined_summary
    
    # Update data
    updated_count = 0
    for item in data:
        pid = item.get('place_id')
        if pid in refined_map:
            item['ai_summary'] = refined_map[pid]
            updated_count += 1
            
    return data, updated_count

def main():
    data, prefix, suffix = extract_json('data.js')
    if data is None:
        return
    
    updated_data_list, count = update_data(data, 'restaurants_refined_final.csv')
    
    # Write back to data.js
    with open('data.js', 'w', encoding='utf-8') as f:
        f.write(prefix)
        json.dump(updated_data_list, f, ensure_ascii=False, indent=2)
        f.write(suffix)
    
    print(f"Successfully updated {count} restaurants in data.js")

if __name__ == "__main__":
    main()
