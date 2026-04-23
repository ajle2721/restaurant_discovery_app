import json
import re

def main():
    with open(r'c:\Users\jason\OneDrive\桌面\restaurant map\data.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract the array from "const restaurantData = [...];"
    match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
    if not match:
        print("Could not find restaurantData array")
        return
    
    data_str = match.group(1)
    # The JS array might have some trailing commas or things that JSON doesn't like, 
    # but looking at the file it seems to be fairly standard JSON-like.
    # Let's try simple replacement or just regex if JSON fails.
    
    try:
        data = json.loads(data_str)
    except json.JSONDecodeError:
        # If it fails, maybe there are trailing commas.
        # Let's try a more robust way to find "attributes": { ... }
        data = []
        # Find each restaurant object
        res_matches = re.findall(r'\{[^{}]*"attributes":\s*\{[^{}]*\}\s*[^}]*\}', data_str, re.DOTALL)
        # This regex is primitive, but let's see if we can just scan for "attributes"
        # and "name".
        
    # Let's just use regex to find names and check attributes directly if JSON fails.
    # But wait, I can just read the file and look for "attributes": { ... "all false" ... }
    
    # Let's try a better regex for the whole object
    restaurants = re.findall(r'\{\s*"name":\s*"(.*?)".*?"attributes":\s*\{(.*?)\}', content, re.DOTALL)
    
    no_tag_restaurants = []
    for name, attrs_str in restaurants:
        is_friendly = False
        if '"high_chair_available": true' in attrs_str: is_friendly = True
        if '"kids_menu": true' in attrs_str: is_friendly = True
        if '"spacious_seating": true' in attrs_str: is_friendly = True
        if '"kid_noise_tolerant": true' in attrs_str: is_friendly = True
        
        if not is_friendly:
            no_tag_restaurants.append(name)
            
    import sys
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
        
    print(f"Found {len(no_tag_restaurants)} restaurants with no tags:")
    for name in no_tag_restaurants:
        print(f"- {name}")


if __name__ == "__main__":
    main()
