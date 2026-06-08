import os
import json

output_dir = "ai_review"
found = False
for filename in os.listdir(output_dir):
    if filename.endswith(".json"):
        path = os.path.join(output_dir, filename)
        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
                if data.get("reason") == "AI語意綜合與連鎖/商場規則評估":
                    with open("scratch/one_reason_content.txt", "w", encoding="utf-8") as out:
                        out.write(f"File: {filename}\n")
                        json.dump(data, out, ensure_ascii=False, indent=2)
                    found = True
                    break
        except Exception as e:
            pass
if not found:
    print("Not found")
