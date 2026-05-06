import json
import os

updates = {
    "ChIJVQR_uWusQjQRYNp5Wdmei40": {"child_seat": "Yes", "kids_meal": "Yes"},
    "ChIJaSZ-CpupQjQRaqvVbaJ4FaM": {"child_seat": "Yes"},
    "ChIJo5uKl5ipQjQRUDGwOBCHUWs": {"child_seat": "Yes"},
    "ChIJoaP21WOpQjQRujwXUxC4FME": {"child_seat": "Yes"},
    "ChIJoZlomYarQjQRQ6dO-drU7eg": {"child_seat": "Yes", "spacious": "Yes"},
    "ChIJfepvyousQjQRq2rFXvS-esU": {"child_seat": "Yes", "spacious": "Yes"},
    "ChIJ67abfVavQjQRscMhuF5_tQA": {"child_seat": "Yes", "spacious": "Yes"},
    "ChIJsS8FHNyvQjQRwtaRVpPMyAI": {"child_seat": "Yes", "spacious": "Yes"},
    "ChIJ2VWqSkKuQjQRuQkg3lsruls": {"child_seat": "Yes"}
}

ai_review_dir = r"c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\ai_review"

def update_file(place_id, attrs):
    filepath = os.path.join(ai_review_dir, f"{place_id}.json")
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if "child_seat" in attrs:
        data[" child_seat available"] = {"result": attrs["child_seat"], "evidence": "使用者提供資訊", "confidence": 1.0}
    if "kids_meal" in attrs:
        data["Kids menu available"] = {"result": attrs["kids_meal"], "evidence": "使用者提供資訊", "confidence": 1.0}
    if "spacious" in attrs:
        data["Spacious seating"] = {"result": attrs["spacious"], "evidence": "使用者提供資訊", "confidence": 1.0}

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print(f"Updated {place_id}")

for pid, attr_map in updates.items():
    update_file(pid, attr_map)
