import os
import json

ai_review_dir = "ai_review"
files = [f for f in os.listdir(ai_review_dir) if f.endswith(".json")]

print(f"Auditing {len(files)} files in {ai_review_dir}...")

for filename in files:
    filepath = os.path.join(ai_review_dir, filename)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Check child_seat
        cs = data.get(" child_seat available", {})
        if cs.get("result") == "Yes":
            evidence = cs.get("evidence") or ""
            if "Google" in evidence or "官方" in evidence:
                print(f"[CHILD_SEAT] {filename}: {evidence}")
                
        # Check has_diaper_table
        dt = data.get("has_diaper_table", {})
        if dt.get("result") == "Yes":
            evidence = dt.get("evidence") or ""
            # Exclude the known mall rule: "位於百貨公司/商場/大樓內..."
            if ("Google" in evidence or "官方" in evidence) and "百貨" not in evidence and "商場" not in evidence:
                print(f"[DIAPER_TABLE] {filename}: {evidence}")
                
        # Check Kids menu
        km = data.get("Kids menu available", {})
        if km.get("result") == "Yes":
            evidence = km.get("evidence") or ""
            if "Google" in evidence or "官方" in evidence:
                print(f"[KIDS_MENU] {filename}: {evidence}")
                
    except Exception as e:
        print(f"Error reading {filename}: {e}")

print("Audit completed.")
