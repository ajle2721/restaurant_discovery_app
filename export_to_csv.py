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
        return None
    
    try:
        data = json.loads(match.group(0))
        return data
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        return None

def export_to_csv(data, output_path):
    fields = [
        'place_id', 'name', 'formatted_address', 
        'high_chair_available', 'kids_menu', 'spacious_seating', 'kid_noise_tolerant', 
        'review_signals', 'ai_summary'
    ]
    
    with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        
        for item in data:
            row = {}
            row['place_id'] = item.get('place_id', '')
            row['name'] = item.get('name', '')
            row['formatted_address'] = item.get('formatted_address', '')
            
            # Attributes
            attrs = item.get('attributes', {})
            row['high_chair_available'] = attrs.get('high_chair_available', '')
            row['kids_menu'] = attrs.get('kids_menu', '')
            row['spacious_seating'] = attrs.get('spacious_seating', '')
            row['kid_noise_tolerant'] = attrs.get('kid_noise_tolerant', '')
            
            # Signals (as string)
            signals = item.get('signals', [])
            row['review_signals'] = " | ".join(signals) if isinstance(signals, list) else signals
            
            row['ai_summary'] = item.get('ai_summary', '')
            
            writer.writerow(row)

def main():
    data = extract_json('data.js')
    if data:
        export_to_csv(data, 'restaurants_export.csv')
        print(f"Successfully exported {len(data)} restaurants to restaurants_export.csv")

if __name__ == "__main__":
    main()
