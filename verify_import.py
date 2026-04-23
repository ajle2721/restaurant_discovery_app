import json
import re

def main():
    with open('data.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r"const restaurantData = (\[[\s\S]*\]);?", content)
    if not match:
        print("Error: Could not find restaurantData")
        return
        
    data = json.loads(match.group(1))
    
    # 1. Check for duplicate place_ids
    from collections import Counter
    pids = [r.get('place_id') for r in data if r.get('place_id')]
    duplicates = [pid for pid, count in Counter(pids).items() if count > 1]
    
    # 2. Check for duplicate names/addresses
    names = [r.get('name') for r in data]
    dup_names = [name for name, count in Counter(names).items() if count > 1]
    
    print(f"Total: {len(data)}")
    print(f"Duplicate place_ids: {len(duplicates)}")
    print(f"Duplicate names: {len(dup_names)}")
    if dup_names:
        print(f"Sample duplicate names: {dup_names[:5]}")
        
if __name__ == "__main__":
    main()
