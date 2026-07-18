import os
import json

response_dir = "response"
review_dir = "ai_review"

response_files = [f for f in os.listdir(response_dir) if f.endswith(".json")]
review_files = [f for f in os.listdir(review_dir) if f.endswith(".json")]

missing = []
unevaluated = []
evaluated = []

for rf in response_files:
    review_path = os.path.join(review_dir, rf)
    if not os.path.exists(review_path):
        missing.append(rf)
        continue
    
    try:
        with open(review_path, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
            reason = data.get("reason", "")
            if reason in ["連鎖/商場規則預設評估", "AI語意綜合與連鎖/商場規則評估"]:
                unevaluated.append(rf)
            else:
                evaluated.append(rf)
    except Exception:
        unevaluated.append(rf)

print(f"Total response files: {len(response_files)}")
print(f"Total review files: {len(review_files)}")
print(f"Missing from AI Review: {len(missing)}")
print(f"Rules-only / Unevaluated (Fallback): {len(unevaluated)}")
print(f"Fully Evaluated (AI / Manual): {len(evaluated)}")
print(f"Progress: {len(evaluated)} / {len(response_files)} ({len(evaluated)/len(response_files)*100:.2f}%)")

if missing:
    print("\nMissing files details:")
    for m in missing[:10]:
        print(f"  {m}")
    if len(missing) > 10:
        print("  ...")
