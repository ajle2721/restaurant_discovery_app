import json
import csv
import os
import glob
from opencc import OpenCC
import re

def main():
    print("Initializing OpenCC (s2twp)...")
    cc = OpenCC('s2twp')  # Simplified to Traditional (Taiwan, with phrases)

    def convert_text(text):
        if not isinstance(text, str):
            return text
        return cc.convert(text)

    def convert_dict(data):
        if isinstance(data, dict):
            return {k: convert_dict(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [convert_dict(i) for i in data]
        elif isinstance(data, str):
            return convert_text(data)
        else:
            return data

    # 1. Convert JSON files in ai_review directory
    ai_review_dir = os.path.join(os.path.dirname(__file__), 'ai_review')
    json_files = glob.glob(os.path.join(ai_review_dir, '*.json'))
    
    print(f"Processing {len(json_files)} JSON files in ai_review...")
    converted_json_count = 0
    for filename in json_files:
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Check if there's any change before writing to save time
            original_str = json.dumps(data, ensure_ascii=False)
            converted_data = convert_dict(data)
            converted_str = json.dumps(converted_data, ensure_ascii=False)

            if original_str != converted_str:
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(converted_data, f, ensure_ascii=False, indent=4)
                converted_json_count += 1
        except Exception as e:
            print(f"Error processing {filename}: {e}")
    print(f"Updated {converted_json_count} JSON files.")

    # 2. Convert CSV files
    csv_files = ['restaurant_reviews.csv', 'aggregated_restaurants.csv']
    for filename in csv_files:
        filepath = os.path.join(os.path.dirname(__file__), filename)
        if not os.path.exists(filepath):
            continue
        
        print(f"Processing {filename}...")
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                rows = list(reader)

            converted_rows = []
            file_changed = False
            for row in rows:
                converted_row = [convert_text(cell) for cell in row]
                converted_rows.append(converted_row)
                if row != converted_row:
                    file_changed = True

            if file_changed:
                with open(filepath, 'w', encoding='utf-8', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerows(converted_rows)
                print(f"Updated {filename}.")
            else:
                print(f"No changes needed for {filename}.")
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    # 3. Convert data.js
    data_js_path = os.path.join(os.path.dirname(__file__), 'data.js')
    if os.path.exists(data_js_path):
        print("Processing data.js...")
        try:
            with open(data_js_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            converted_content = convert_text(content)
            
            if content != converted_content:
                with open(data_js_path, 'w', encoding='utf-8') as f:
                    f.write(converted_content)
                print("Updated data.js.")
            else:
                print("No changes needed for data.js.")
        except Exception as e:
            print(f"Error processing data.js: {e}")

    print("Conversion complete!")

if __name__ == "__main__":
    main()
