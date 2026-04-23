import json
import re
import os

data_js_path = r'c:\Users\jason\OneDrive\桌面\restaurant map\data.js'
output_path = r'c:\Users\jason\OneDrive\桌面\restaurant map\missing_ids.txt'
response_dir = r'c:\Users\jason\OneDrive\桌面\restaurant map\response'

with open(data_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the JSON part from data.js
match = re.search(r'const restaurantData = (\[.*\]);', content, re.DOTALL)
if not match:
    # If standard regex fails, try to find the first [ and last ]
    start = content.find('[')
    end = content.rfind(']') + 1
    if start != -1 and end != -1:
        data_str = content[start:end]
    else:
        print("Could not find data array")
        exit(1)
else:
    data_str = match.group(1)

# Basic cleanup for JS to JSON (handling trailing commas if any, though likely not needed)
try:
    data = json.loads(data_str)
except json.JSONDecodeError:
    print("JSON decode error, attempting manual regex extraction...")
    # fallback: search for each object
    place_ids = re.findall(r'"place_id":\s*"(.*?)"', content)
    # This might match all, but let's try to find those with null attributes
    # Better to just use the successfully imported data.js if it's valid JSON
    exit(1)

missing_ids = []
for item in data:
    attrs = item.get("attributes")
    # If attributes is null or missing, it's a target
    if attrs is None or not any(attrs.values()):
        place_id = item.get("place_id")
        if place_id:
            # Also check if we already have the raw response
            # res_path = os.path.join(response_dir, f"{place_id}.json")
            # if not os.path.exists(res_path):
            missing_ids.append(place_id)

with open(output_path, 'w', encoding='utf-8') as f:
    for pid in missing_ids:
        f.write(f"{pid}\n")

print(f"Found {len(missing_ids)} targets. Saved to {output_path}")
