import os
import json
from collections import Counter

output_dir = "ai_review"
reasons = Counter()
for filename in os.listdir(output_dir):
    if filename.endswith(".json"):
        path = os.path.join(output_dir, filename)
        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
                reasons[data.get("reason", "No Reason")] += 1
        except Exception as e:
            reasons[f"Error: {e}"] += 1

# Write summary to a file to avoid console encoding issues
with open("scratch/reasons_summary.txt", "w", encoding="utf-8") as out:
    for reason, count in reasons.most_common():
        out.write(f"{reason}: {count}\n")

print("Finished writing to scratch/reasons_summary.txt")
