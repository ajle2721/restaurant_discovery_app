import json
import re

def normalize(s):
    if not s: return ""
    # Remove all non-alphanumeric/Chinese characters for better matching
    return re.sub(r'[^\w\u4e00-\u9fa5]', '', s.lower().strip())

def main():
    with open('data.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r"const restaurantData = (\[[\s\S]*\]);?", content)
    if not match:
        print("Error: Could not find restaurantData")
        return
        
    data = json.loads(match.group(1))
    
    # Deduplicate by normalized (name + address)
    unique_data = {} # key -> restaurant object
    
    for r in data:
        name = r.get('name', "")
        addr = r.get('address', "") or r.get('formatted_address', "")
        
        # Use normalized name + address as the key
        key = normalize(name + addr)
        
        if key not in unique_data:
            unique_data[key] = r
        else:
            # Merge logic:
            existing = unique_data[key]
            
            # Prefer real place_id if one is ""
            if not existing.get('place_id') and r.get('place_id'):
                existing['place_id'] = r['place_id']
            
            # Prefer non-null attributes
            if existing.get('attributes', {}).get('high_chair_available') is None and r.get('attributes', {}).get('high_chair_available') is not None:
                existing['attributes'] = r['attributes']
            
            # Prefer non-empty AI summary/signals
            if not existing.get('ai_summary') and r.get('ai_summary'):
                existing['ai_summary'] = r['ai_summary']
            if not existing.get('signals') and r.get('signals'):
                existing['signals'] = r['signals']
                
            # Prefer non-empty reviews/district/ratings
            if not existing.get('district') and r.get('district'):
                existing['district'] = r['district']
            if not existing.get('reviews') and r.get('reviews'):
                existing['reviews'] = r['reviews']
            if not existing.get('user_ratings_total') and (r.get('user_ratings_total', 0) > 0):
                existing['user_ratings_total'] = r['user_ratings_total']
            if (existing.get('latitude') is None) and (r.get('latitude') is not None):
                existing['latitude'] = r['latitude']
                existing['longitude'] = r['longitude']
                
    final_list = list(unique_data.values())
    
    # 2. Write back
    new_content = f"const restaurantData = {json.dumps(final_list, indent=2, ensure_ascii=False)};"
    with open('data.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f"Successfully deduplicated. Final count: {len(final_list)}")

if __name__ == "__main__":
    main()
