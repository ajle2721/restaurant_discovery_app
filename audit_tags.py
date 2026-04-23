import json
import re
from collections import Counter

data_js_path = r'c:\Users\jason\OneDrive\桌面\restaurant map\data.js'

def audit_data_js():
    with open(data_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
    if not match:
        print("Could not find restaurantData array")
        return None

    data = json.loads(match.group(1))
    attrs = ['high_chair_available', 'kids_menu', 'spacious_seating', 'kid_noise_tolerant']
    
    stats = {a: Counter() for a in attrs}
    
    for item in data:
        d_attrs = item.get('attributes', {})
        for a in attrs:
            val = d_attrs.get(a)
            stats[a][str(val)] += 1
            
    return stats

def main():
    print("--- Final Audit of data.js (Ternary Logic: yes/no/unknown) ---")
    js_stats = audit_data_js()
    if js_stats:
        for attr, counts in js_stats.items():
            print(f"\n{attr}:")
            print(f"  - yes: {counts.get('yes', 0)}")
            print(f"  - no: {counts.get('no', 0)}")
            print(f"  - unknown: {counts.get('unknown', 0)}")
            
            # Check for any old boolean values
            booleans = counts.get('True', 0) + counts.get('False', 0) + counts.get('true', 0) + counts.get('false', 0)
            if booleans > 0:
                print(f"  [WARNING] Found {booleans} legacy boolean values!")

if __name__ == "__main__":
    main()
