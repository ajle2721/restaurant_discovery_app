import json
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

def main():
    data = extract_json('data.js')
    if not data:
        return
    
    for x in data:
        if 'ai_summary' in x:
            print(f"NAME: {x['name']}")
            print(f"SUMMARY: {x['ai_summary']}")
            print(f"SIGNALS: {x.get('signals', [])}")
            print("---")

if __name__ == "__main__":
    main()
