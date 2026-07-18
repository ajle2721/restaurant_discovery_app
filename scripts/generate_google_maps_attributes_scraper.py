import os
import json
import re
import csv
import time
import sys
import argparse
import random
import urllib.parse

# Instructions for the user:
# This script uses Playwright to scrape Google Maps place attributes.
# Enter the Nix development shell before running:
#   nix develop
# Then run:
#   python generate_google_maps_attributes_scraper.py --limit 10
# Progress is checkpointed after every restaurant. Use --reset to start over.

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("[ERROR] Playwright is unavailable. Enter the project shell with: nix develop")
    sys.exit(1)

base_dir = os.path.dirname(os.path.abspath(__file__))
ai_review_dir = os.path.join(base_dir, "ai_review")
index_js_path = os.path.join(ai_review_dir, "index.js")
output_csv_path = os.path.join(base_dir, "high_chair_list.csv")
attributes_csv_path = os.path.join(base_dir, "google_maps_place_attributes.csv")
attributes_json_path = os.path.join(base_dir, "google_maps_place_attributes.json")
summaries_csv_path = os.path.join(base_dir, "google_maps_place_summaries.csv")
checkpoint_path = os.path.join(base_dir, ".google_maps_attributes_scraper_checkpoint.json")
checkpoint_schema_version = 3
high_chair_fieldnames = ["Place ID", "餐廳名稱", "地址", "Google 地圖網址", "高腳椅屬性", "佐證/說明"]
summary_fieldnames = [
    "Place ID",
    "餐廳名稱",
    "地址",
    "Google 地圖網址",
    "Google 評分",
    "Google 評論數",
    "Google 類別",
    "Google 價位",
]
attribute_fieldnames = [
    "Place ID",
    "餐廳名稱",
    "地址",
    "Google 地圖網址",
    "屬性分類",
    "屬性名稱",
    "屬性狀態",
    "原始標籤",
]
status_prefixes = [
    "不提供",
    "未設有",
    "不允許",
    "不接受",
    "不適合",
    "提供",
    "設有",
    "允許",
    "接受",
    "適合",
    "需要",
    "不需要",
    "免費",
    "付費",
    "有",
    "無",
]
ignored_attribute_labels = {"下一頁", "上一頁"}


def parse_args():
    parser = argparse.ArgumentParser(description="Scrape Google Maps about-tab place attributes.")
    parser.add_argument("--limit", type=int, help="Only scan the first N restaurants.")
    parser.add_argument(
        "--delay-min",
        type=float,
        default=6.0,
        help="Minimum delay in seconds between restaurant visits (default: 6).",
    )
    parser.add_argument(
        "--delay-max",
        type=float,
        default=12.0,
        help="Maximum delay in seconds between restaurant visits (default: 12).",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Discard saved progress and start this scan from the beginning.",
    )
    parser.add_argument(
        "--output-dir",
        default=base_dir,
        help="Directory for CSV/JSON outputs and checkpoint (default: project directory).",
    )
    parser.add_argument(
        "--output-prefix",
        default="",
        help="Optional filename prefix for outputs, useful for smoke tests.",
    )
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be at least 1")
    if args.delay_min < 0 or args.delay_max < args.delay_min:
        parser.error("delays must satisfy 0 <= --delay-min <= --delay-max")
    args.output_dir = os.path.abspath(args.output_dir)
    return args


def configure_output_paths(args):
    global output_csv_path
    global attributes_csv_path
    global attributes_json_path
    global summaries_csv_path
    global checkpoint_path

    os.makedirs(args.output_dir, exist_ok=True)
    prefix = f"{args.output_prefix}_" if args.output_prefix else ""
    output_csv_path = os.path.join(args.output_dir, f"{prefix}high_chair_list.csv")
    attributes_csv_path = os.path.join(args.output_dir, f"{prefix}google_maps_place_attributes.csv")
    attributes_json_path = os.path.join(args.output_dir, f"{prefix}google_maps_place_attributes.json")
    summaries_csv_path = os.path.join(args.output_dir, f"{prefix}google_maps_place_summaries.csv")
    checkpoint_path = os.path.join(args.output_dir, f".{prefix}google_maps_attributes_scraper_checkpoint.json")


def write_high_chair_results(results):
    with open(output_csv_path, "w", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=high_chair_fieldnames)
        writer.writeheader()
        writer.writerows(results)


def write_attribute_results(attribute_rows, attribute_summaries):
    with open(attributes_csv_path, "w", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=attribute_fieldnames)
        writer.writeheader()
        writer.writerows(attribute_rows)

    with open(attributes_json_path, "w", encoding="utf-8") as jsonfile:
        json.dump(attribute_summaries, jsonfile, ensure_ascii=False, indent=2)


def write_summary_results(summary_rows):
    with open(summaries_csv_path, "w", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=summary_fieldnames)
        writer.writeheader()
        writer.writerows(summary_rows)


def save_checkpoint(
    selected_place_ids,
    processed_place_ids,
    high_chair_results,
    attribute_rows,
    attribute_summaries,
    summary_rows,
):
    checkpoint = {
        "schema_version": checkpoint_schema_version,
        "selected_place_ids": selected_place_ids,
        "processed_place_ids": sorted(processed_place_ids),
        "high_chair_results": high_chair_results,
        "attribute_rows": attribute_rows,
        "attribute_summaries": attribute_summaries,
        "summary_rows": summary_rows,
    }
    temporary_path = f"{checkpoint_path}.tmp"
    with open(temporary_path, "w", encoding="utf-8") as checkpoint_file:
        json.dump(checkpoint, checkpoint_file, ensure_ascii=False, indent=2)
    os.replace(temporary_path, checkpoint_path)


def split_attribute_label(label, text):
    label = (label or "").strip()
    text = (text or "").strip()
    for prefix in status_prefixes:
        if label.startswith(prefix) and len(label) > len(prefix):
            return label[len(prefix):].strip() or text or label, prefix
    return text or label, ""


def is_noise_line(line):
    if not line:
        return True
    if "目前看到的 Google 地圖內容受限" in line:
        return True
    return not re.search(r"[A-Za-z0-9\u4e00-\u9fff]", line)


def normalize_review_count(value):
    if not value:
        return ""
    return re.sub(r"[^\d]", "", value)


def extract_first_price(text):
    match = re.search(
        r"((?:NT\$|[$＄])\s?\d[\d,]*(?:\s?[-–~]\s?(?:NT\$|[$＄])?\s?\d[\d,]*)?)",
        text,
    )
    if not match:
        return ""
    return re.sub(r"\s+", "", match.group(1))


def collect_overview_summary(page, restaurant):
    main_panel = page.locator('div[role="main"]').first
    main_text = main_panel.inner_text(timeout=5000) if main_panel.count() > 0 else ""

    rating = ""
    rating_label = ""
    rating_locator = page.locator('div[role="main"] [role="img"][aria-label*="顆星"]')
    if rating_locator.count() > 0:
        rating_label = rating_locator.first.get_attribute("aria-label") or ""
        rating_match = re.search(r"(\d+(?:\.\d+)?)", rating_label)
        if rating_match:
            rating = rating_match.group(1)
    if not rating:
        rating_match = re.search(r"^\s*(\d+(?:\.\d+)?)\s*$", main_text, re.MULTILINE)
        if rating_match:
            rating = rating_match.group(1)

    review_count = ""
    review_candidates = page.locator('div[role="main"] [aria-label*="評論"]').evaluate_all(
        """
        elements => elements.map(element => ({
            label: element.getAttribute("aria-label") || "",
            text: element.innerText || ""
        }))
        """
    )
    for candidate in review_candidates:
        candidate_text = f"{candidate.get('label', '')} {candidate.get('text', '')}"
        match = re.search(r"([\d,]+)\s*(?:則)?評論", candidate_text)
        if match:
            review_count = normalize_review_count(match.group(1))
            break
    if not review_count:
        match = re.search(r"\(([\d,]+)\)", main_text)
        if match:
            review_count = normalize_review_count(match.group(1))

    categories = []
    for category in page.locator('div[role="main"] button.DkEaL').all_inner_texts():
        category = category.strip()
        if category and category not in categories:
            categories.append(category)

    price_range = extract_first_price(main_text)

    return {
        "Place ID": restaurant["place_id"],
        "餐廳名稱": restaurant["name"],
        "地址": restaurant["address"],
        "Google 地圖網址": restaurant["url"],
        "Google 評分": rating,
        "Google 評論數": review_count,
        "Google 類別": "、".join(categories),
        "Google 價位": price_range,
    }


def assign_attribute_categories(region_text, attributes):
    current_category = ""
    assigned = [False] * len(attributes)

    for raw_line in region_text.splitlines():
        line = raw_line.strip()
        if is_noise_line(line):
            continue

        matched_index = None
        for index, attribute in enumerate(attributes):
            if not assigned[index] and attribute["name"] == line:
                matched_index = index
                break

        if matched_index is None:
            current_category = line
        else:
            attributes[matched_index]["category"] = current_category
            assigned[matched_index] = True

    return attributes


def collect_about_attributes(page):
    main_panel = page.locator('div[role="main"]')
    if main_panel.count() > 0:
        main_panel.first.scroll_into_view_if_needed()

    for _ in range(8):
        page.mouse.wheel(0, 1200)
        time.sleep(0.2)

    about_region = page.locator('div[role="region"][aria-label$="簡介"]')
    if about_region.count() == 0:
        about_region = page.locator('div[role="region"]')

    region_text = about_region.first.inner_text(timeout=5000) if about_region.count() > 0 else ""
    raw_items = about_region.first.locator("[aria-label]").evaluate_all(
        """
        elements => elements.map(element => ({
            tag: element.tagName,
            label: element.getAttribute("aria-label") || "",
            text: element.innerText || ""
        }))
        """
    ) if about_region.count() > 0 else []

    attributes = []
    seen = set()
    for item in raw_items:
        label = item.get("label", "").strip()
        text = item.get("text", "").strip()
        if not label or label in ignored_attribute_labels:
            continue
        if not text or is_noise_line(text):
            continue

        name, status = split_attribute_label(label, text)
        if not name or name in ignored_attribute_labels:
            continue

        dedupe_key = (name, status, label)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        attributes.append({
            "category": "",
            "name": name,
            "status": status,
            "raw_label": label,
        })

    return assign_attribute_categories(region_text, attributes)


def has_confirmed_high_chair(attributes, page):
    for attribute in attributes:
        if attribute["name"] == "兒童高腳椅" and attribute["status"] not in {"不提供", "未設有", "不允許", "無"}:
            return True
    return "兒童高腳椅" in page.content()


args = parse_args()
configure_output_paths(args)

# 1. Read index.js to get all restaurants
restaurants = []
if os.path.exists(index_js_path):
    print(f"Reading restaurant metadata from {index_js_path}...")
    with open(index_js_path, "r", encoding="utf-8-sig") as f:
        content = f.read()
    
    rows_match = re.search(r'const rows = (\[.*?\]);', content, re.DOTALL)
    columns_match = re.search(r'const columns = (\[.*?\]);', content, re.DOTALL)
    if rows_match and columns_match:
        try:
            columns = json.loads(columns_match.group(1))
            rows = json.loads(rows_match.group(1))
            
            name_idx = columns.index("name")
            id_idx = columns.index("place_id")
            address_idx = columns.index("address")
            url_idx = columns.index("url") if "url" in columns else -1
            
            for row in rows:
                place_id = row[id_idx]
                restaurants.append({
                    "place_id": place_id,
                    "name": row[name_idx],
                    "address": row[address_idx],
                    "url": row[url_idx] if url_idx != -1 else f"https://www.google.com/maps/place/?q=place_id:{place_id}"
                })
        except Exception as e:
            print("Error parsing index.js:", e)
else:
    print("[ERROR] index.js not found.")
    sys.exit(1)

if args.limit:
    print(f"Limiting scan to the first {args.limit} restaurants for testing...")
    restaurants = restaurants[:args.limit]
else:
    print(f"Total restaurants to scan: {len(restaurants)}")

selected_place_ids = [restaurant["place_id"] for restaurant in restaurants]
processed_place_ids = set()
high_chair_results = []
attribute_rows = []
attribute_summaries = []
summary_rows = []

if args.reset and os.path.exists(checkpoint_path):
    os.remove(checkpoint_path)
    print("Discarded the previous checkpoint.")
elif os.path.exists(checkpoint_path):
    try:
        with open(checkpoint_path, "r", encoding="utf-8") as checkpoint_file:
            checkpoint = json.load(checkpoint_file)
        if (
            checkpoint.get("schema_version") == checkpoint_schema_version
            and checkpoint.get("selected_place_ids") == selected_place_ids
        ):
            processed_place_ids = set(checkpoint.get("processed_place_ids", []))
            high_chair_results = checkpoint.get("high_chair_results", [])
            attribute_rows = checkpoint.get("attribute_rows", [])
            attribute_summaries = checkpoint.get("attribute_summaries", [])
            summary_rows = checkpoint.get("summary_rows", [])
            print(
                f"Resuming from checkpoint: {len(processed_place_ids)}/{len(restaurants)} "
                "restaurants already completed."
            )
        else:
            print("Checkpoint schema or restaurant selection changed; starting a new checkpoint.")
    except (OSError, ValueError, TypeError) as error:
        print(f"[WARNING] Could not read checkpoint; starting over: {error}")

remaining_restaurants = [
    restaurant for restaurant in restaurants
    if restaurant["place_id"] not in processed_place_ids
]

# 2. Setup Playwright scraping
interrupted = False

if remaining_restaurants:
    try:
        with sync_playwright() as p:
            print("Launching headless browser...")
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                locale="zh-TW",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            page = context.new_page()

            for request_index, restaurant in enumerate(remaining_restaurants):
                name = restaurant["name"]
                place_id = restaurant["place_id"]
                progress = len(processed_place_ids) + 1
                url = (
                    "https://www.google.com/maps/search/?api=1"
                    f"&query={urllib.parse.quote(name)}&query_place_id={place_id}"
                )

                print(f"[{progress}/{len(restaurants)}] Checking {name} ({place_id})...")
                try:
                    page.goto(url, timeout=30000)
                    time.sleep(2.5)

                    overview_summary = collect_overview_summary(page, restaurant)
                    summary_rows.append(overview_summary)
                    print(
                        "    -> 總覽摘要: "
                        f"評分={overview_summary['Google 評分'] or '-'}, "
                        f"評論數={overview_summary['Google 評論數'] or '-'}, "
                        f"類別={overview_summary['Google 類別'] or '-'}, "
                        f"價位={overview_summary['Google 價位'] or '-'}"
                    )

                    about_tab = page.locator('button:has-text("簡介")')
                    if about_tab.count() > 0:
                        about_tab.first.click()
                        time.sleep(1)

                    attributes = collect_about_attributes(page)
                    has_high_chair = has_confirmed_high_chair(attributes, page)
                    status = "提供" if has_high_chair else "未標記/無"
                    print(f"    -> 簡介屬性: {len(attributes)}")
                    print(f"    -> 兒童高腳椅: {status}")

                    attribute_summaries.append({
                        "place_id": place_id,
                        "name": name,
                        "address": restaurant["address"],
                        "google_maps_url": restaurant["url"],
                        "overview_summary": overview_summary,
                        "attributes": attributes,
                    })

                    for attribute in attributes:
                        attribute_rows.append({
                            "Place ID": place_id,
                            "餐廳名稱": name,
                            "地址": restaurant["address"],
                            "Google 地圖網址": restaurant["url"],
                            "屬性分類": attribute["category"],
                            "屬性名稱": attribute["name"],
                            "屬性狀態": attribute["status"],
                            "原始標籤": attribute["raw_label"],
                        })

                    if has_high_chair:
                        high_chair_results.append({
                            "Place ID": place_id,
                            "餐廳名稱": name,
                            "地址": restaurant["address"],
                            "Google 地圖網址": restaurant["url"],
                            "高腳椅屬性": "提供 (Yes)",
                            "佐證/說明": "Google 地圖「簡介」頁面明確標記「兒童高腳椅」",
                        })

                    processed_place_ids.add(place_id)
                    save_checkpoint(
                        selected_place_ids,
                        processed_place_ids,
                        high_chair_results,
                        attribute_rows,
                        attribute_summaries,
                        summary_rows,
                    )
                    write_high_chair_results(high_chair_results)
                    write_summary_results(summary_rows)
                    write_attribute_results(attribute_rows, attribute_summaries)
                    print("    -> Progress saved.")
                except Exception as error:
                    print(f"    [ERROR] Failed to check {name}: {error}")

                if request_index < len(remaining_restaurants) - 1:
                    delay = random.uniform(args.delay_min, args.delay_max)
                    print(f"    -> Waiting {delay:.1f} seconds before the next visit...")
                    time.sleep(delay)

            browser.close()
    except KeyboardInterrupt:
        interrupted = True
        print("\nInterrupted. Saved progress will be used on the next run.")

# 3. Write results to CSV
print(f"Writing {len(high_chair_results)} verified high-chair restaurants to {output_csv_path}...")
write_high_chair_results(high_chair_results)
print(f"Writing {len(summary_rows)} place summaries to {summaries_csv_path}...")
write_summary_results(summary_rows)
print(f"Writing {len(attribute_rows)} place attributes to {attributes_csv_path}...")
write_attribute_results(attribute_rows, attribute_summaries)

unfinished_count = len(selected_place_ids) - len(processed_place_ids)
if unfinished_count == 0:
    if os.path.exists(checkpoint_path):
        os.remove(checkpoint_path)
    print("Done! CSV updated successfully; checkpoint cleared.")
elif interrupted:
    sys.exit(130)
else:
    print(f"[WARNING] {unfinished_count} restaurants remain; rerun the same command to retry them.")
    sys.exit(1)
