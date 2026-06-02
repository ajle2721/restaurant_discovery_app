import os
import sys

# Set standard output to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

filepath = os.path.join("ai_review", "index.js")
try:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    place_id = "ChIJc_6fMzerQjQRHcqXwpPVxFo"
    start = content.find(place_id)
    if start != -1:
        print(content[start - 100 : start + 1800])
    else:
        print(f"Could not find {place_id} in {filepath}")
except Exception as e:
    print(f"Error: {e}")
