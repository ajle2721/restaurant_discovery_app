import csv
import json
from pathlib import Path


SOURCE_DIR = Path("response")
OUTPUT_FILE = Path("feedback.csv")
MAX_REVIEWS = 5


def extract_review_text(review):
    text = review.get("text", {}).get("text", "")
    if not text:
        text = review.get("originalText", {}).get("text", "")
    return " ".join(text.split())


def build_row(json_path):
    with json_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    row = {"place_id": data.get("id", "")}
    reviews = data.get("reviews", [])

    for index in range(MAX_REVIEWS):
        key = f"review_content_{index + 1}"
        row[key] = extract_review_text(reviews[index]) if index < len(reviews) else ""

    return row


def main():
    if not SOURCE_DIR.exists():
        raise FileNotFoundError(f"Directory not found: {SOURCE_DIR}")

    fieldnames = ["place_id"] + [f"review_content_{index}" for index in range(1, MAX_REVIEWS + 1)]
    rows = [build_row(json_path) for json_path in sorted(SOURCE_DIR.glob("*.json"))]

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
