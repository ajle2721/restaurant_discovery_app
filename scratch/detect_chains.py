import json
import collections

try:
    with open('ai_review/index.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove 'const restaurantData = ' and ';'
    json_str = content.replace('const restaurantData = ', '').rstrip(';')
    data = json.loads(json_str)
    
    names = [item['name'] for item in data]
    
    # Simple chain detection: extract base name (remove branch name like "中山店")
    # This is a heuristic.
    
    chain_names = collections.defaultdict(list)
    for name in names:
        # Common patterns for branch names
        base_name = name
        for suffix in ["店", "分店", "(", "（", " |"]:
            if suffix in name:
                base_name = name.split(suffix)[0].strip()
                break
        chain_names[base_name].append(name)
    
    print("Detected Chains (Base Name appearing multiple times):")
    for base, variants in sorted(chain_names.items()):
        if len(variants) > 1:
            print(f"- {base}: {', '.join(variants)}")
            
except Exception as e:
    print(f"Error: {e}")
