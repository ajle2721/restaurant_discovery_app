import os
import json

response_dir = r"c:\Users\jason\OneDrive\桌面\restaurant map\response"
review_dir = r"c:\Users\jason\OneDrive\桌面\restaurant map\ai_review"

response_files = [f.replace(".json", "") for f in os.listdir(response_dir) if f.endswith(".json")]
review_files = [f.replace(".json", "") for f in os.listdir(review_dir) if f.endswith(".json")]

missing = [f for f in response_files if f not in review_files]

print(f"Total response files: {len(response_files)}")
print(f"Total review files: {len(review_files)}")
print(f"Missing: {len(missing)}")

# Get restaurant names for missing ones
missing_with_names = []
for mid in missing:
    try:
        with open(os.path.join(response_dir, f"{mid}.json"), 'r', encoding='utf-8') as f:
            data = json.load(f)
            name = data.get("displayName", {}).get("text", mid)
            missing_with_names.append((mid, name))
    except Exception:
        missing_with_names.append((mid, mid))

for mid, name in missing_with_names:
    print(f"{mid}: {name}")
