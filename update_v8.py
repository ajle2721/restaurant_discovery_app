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
    # Look for the first '[' and the last ']'
    start_idx = content.find('[')
    end_idx = content.rfind(']')
    
    if start_idx == -1 or end_idx == -1:
        print("No JSON array found.")
        return None, None, None
    
    try:
        json_str = content[start_idx:end_idx+1]
        data = json.loads(json_str)
        return data, content[:start_idx], content[end_idx+1:]
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
            humanized_summary = row.get('ai_summary_humanized')
            if place_id and humanized_summary:
                refined_map[place_id] = humanized_summary
    
    # Update data
    updated_count = 0
    not_found = []
    for item in data:
        pid = item.get('place_id')
        if pid in refined_map:
            item['ai_summary'] = refined_map[pid]
            updated_count += 1
        else:
            not_found.append(pid)
            
    return data, updated_count, not_found

def main():
    data_file = 'data.js'
    csv_file = 'restaurants_refined_v8.csv'
    
    data, prefix, suffix = extract_json(data_file)
    if data is None:
        return
    
    updated_data_list, count, not_found = update_data(data, csv_file)
    
    # Write back to data.js
    with open(data_file, 'w', encoding='utf-8') as f:
        f.write(prefix)
        json.dump(updated_data_list, f, ensure_ascii=False, indent=2)
        f.write(suffix)
    
    print(f"Successfully updated {count} restaurants in {data_file}")
    if not_found:
        print(f"Warning: {len(not_found)} restaurants in data.js were not found in the CSV.")

if __name__ == "__main__":
    main()
