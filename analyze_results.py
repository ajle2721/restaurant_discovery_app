import json
from collections import Counter

def main():
    with open('expanded_restaurants.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 1. District Summary
    districts = Counter(r['district'] for r in data)
    
    # 2. Type Summary (Approximate 70% general vs 30% family)
    family_keywords = ["family", "kids", "親子", "兒童"]
    family_count = 0
    for r in data:
        is_family = any(kw in r['name'] or kw in "".join(r.get('reviews', [])) for kw in family_keywords)
        if is_family:
            family_count += 1
            
    general_count = len(data) - family_count
    
    print(f"Total New Restaurants: {len(data)}")
    print(f"General: {general_count} ({general_count/len(data):.1%})")
    print(f"Family-oriented: {family_count} ({family_count/len(data):.1%})")
    
    print("\nDistrict Distribution:")
    for d, count in districts.most_common():
        print(f"- {d}: {count}")
    
    # 3. Generate Markdown Table (First 100 for artifact)
    table_header = "| District | Name | Rating | Address | Reviews |\n| --- | --- | --- | --- | --- |\n"
    table_rows = ""
    for r in data[:100]:
        reviews_summary = "; ".join(r['reviews']).replace('\n', ' ')[:100] + "..."
        table_rows += f"| {r['district']} | {r['name']} | {r['rating']} | {r['formatted_address']} | {reviews_summary} |\n"
    
    with open('summary_table.md', 'w', encoding='utf-8') as f:
        f.write(table_header + table_rows)
        
if __name__ == "__main__":
    main()
