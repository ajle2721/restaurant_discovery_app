import os
import json

response_dir = "response"
output_dir = "ai_review"

response_files = set(f for f in os.listdir(response_dir) if f.endswith(".json"))
output_files = set(f for f in os.listdir(output_dir) if f.endswith(".json"))

with open("scratch/count_summary.txt", "w", encoding="utf-8") as out:
    out.write(f"Response files count: {len(response_files)}\n")
    out.write(f"AI Review files count: {len(output_files)}\n")
    out.write(f"Intersection: {len(response_files & output_files)}\n")
    out.write(f"Only in response: {len(response_files - output_files)}\n")
    out.write(f"Only in AI Review: {len(output_files - response_files)}\n\n")

    # Count reasons for files that are in the intersection
    reasons = {}
    for filename in response_files & output_files:
        path = os.path.join(output_dir, filename)
        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
                r = data.get("reason", "No Reason")
                reasons[r] = reasons.get(r, 0) + 1
        except Exception as e:
            reasons[f"Error: {e}"] = reasons.get(f"Error: {e}", 0) + 1

    out.write("Reasons for files that exist in response:\n")
    for r, count in sorted(reasons.items(), key=lambda x: x[1], reverse=True):
        out.write(f"  {r}: {count}\n")

print("Done writing to scratch/count_summary.txt")
