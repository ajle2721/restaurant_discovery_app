import os
import json

response_dir = "response"
output_dir = "ai_review"

response_files = set(f for f in os.listdir(response_dir) if f.endswith(".json"))
output_files = set(f for f in os.listdir(output_dir) if f.endswith(".json"))

target_files = []
for filename in response_files & output_files:
    path = os.path.join(output_dir, filename)
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
            r = data.get("reason", "No Reason")
            if r in ["AI語意綜合與連鎖/商場規則評估", "連鎖/商場規則預設評估"]:
                target_files.append(filename)
    except Exception:
        pass

has_reviews_count = 0
no_reviews_count = 0

for filename in target_files:
    path = os.path.join(response_dir, filename)
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
            reviews = data.get("reviews", [])
            has_valid_review = False
            for r in reviews:
                text_obj = r.get("originalText") or r.get("text") or {}
                if text_obj.get("text", "").strip():
                    has_valid_review = True
                    break
            if has_valid_review:
                has_reviews_count += 1
            else:
                no_reviews_count += 1
    except Exception:
        no_reviews_count += 1

print(f"Total target files with no-LLM reasons: {len(target_files)}")
print(f"Of these, files with reviews (will call LLM): {has_reviews_count}")
print(f"Of these, files with no reviews (will skip LLM call): {no_reviews_count}")
