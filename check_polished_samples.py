import json
import re
import random
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

data_js_path = r'c:\Users\jason\OneDrive\桌面\restaurant map\data.js'

def main():
    with open(data_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
    if not match:
        return
    
    data = json.loads(match.group(1))
    samples = random.sample(data, 10)
    
    print("--- 10 Polished Summary Samples ---")
    for s in samples:
        print(f"Name: {s.get('name')}")
        print(f"Summary: {s.get('ai_summary')}")
        print("-" * 20)

if __name__ == "__main__":
    main()
