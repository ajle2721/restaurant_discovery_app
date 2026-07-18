import csv
import json
import os
import re


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
INDEX_JS_PATH = os.path.join(BASE_DIR, "data", "generated", "restaurant-catalog.js")
GOOGLE_ATTRIBUTES_CSV_PATH = os.path.join(BASE_DIR, "data", "generated", "google_maps_place_attributes.csv")
OUTPUT_CSV_PATH = os.path.join(BASE_DIR, "data", "generated", "google_kids_menu_missing_in_site.csv")

POSITIVE_GOOGLE_STATUSES = {"", "有", "提供", "設有", "適合", "供應"}
NEGATIVE_GOOGLE_STATUSES = {"不提供", "未設有", "不允許", "不接受", "不適合", "無"}
POSITIVE_SITE_VALUES = {"yes", "likely"}


def extract_js_json_assignment(source, variable_name):
    pattern = rf"const {re.escape(variable_name)} = "
    start = source.find(pattern)
    if start == -1:
        raise ValueError(f"Cannot find const {variable_name} assignment in the restaurant catalog")
    value_start = start + len(pattern)
    value_end = source.find(";\n", value_start)
    if value_end == -1:
        raise ValueError(f"Cannot find end of const {variable_name} assignment")
    return json.loads(source[value_start:value_end])


def load_restaurants_by_place_id():
    with open(INDEX_JS_PATH, "r", encoding="utf-8") as index_file:
        source = index_file.read()

    columns = extract_js_json_assignment(source, "columns")
    rows = extract_js_json_assignment(source, "rows")

    restaurants = {}
    for row in rows:
        restaurant = dict(zip(columns, row))
        restaurants[restaurant["place_id"]] = restaurant
    return restaurants


def is_positive_google_kids_menu(row):
    if row.get("屬性名稱") != "兒童菜單":
        return False
    status = (row.get("屬性狀態") or "").strip()
    raw_label = row.get("原始標籤") or ""
    if status in NEGATIVE_GOOGLE_STATUSES:
        return False
    return status in POSITIVE_GOOGLE_STATUSES or "有兒童菜單" in raw_label


def main():
    restaurants_by_place_id = load_restaurants_by_place_id()
    candidates_by_place_id = {}

    with open(GOOGLE_ATTRIBUTES_CSV_PATH, "r", encoding="utf-8-sig", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if not is_positive_google_kids_menu(row):
                continue
            place_id = row["Place ID"]
            candidates_by_place_id.setdefault(place_id, row)

    output_rows = []
    for place_id in sorted(candidates_by_place_id):
        google_row = candidates_by_place_id[place_id]
        restaurant = restaurants_by_place_id.get(place_id)
        site_kids_menu = ""
        site_name = ""
        site_address = ""
        site_parent_friendly_level = ""
        site_summary = ""

        if restaurant:
            attributes = restaurant.get("attributes") or {}
            site_kids_menu = attributes.get("kids_menu", "")
            site_name = restaurant.get("name", "")
            site_address = restaurant.get("address", "")
            site_parent_friendly_level = restaurant.get("parent_friendly_level", "")
            site_summary = restaurant.get("card_summary") or restaurant.get("ai_summary") or ""

        if site_kids_menu in POSITIVE_SITE_VALUES:
            continue

        output_rows.append(
            {
                "Place ID": place_id,
                "Google 餐廳名稱": google_row.get("餐廳名稱", ""),
                "Google 地址": google_row.get("地址", ""),
                "Google 地圖網址": google_row.get("Google 地圖網址", ""),
                "Google 屬性分類": google_row.get("屬性分類", ""),
                "Google 屬性名稱": google_row.get("屬性名稱", ""),
                "Google 屬性狀態": google_row.get("屬性狀態", ""),
                "Google 原始標籤": google_row.get("原始標籤", ""),
                "網站餐廳名稱": site_name,
                "網站地址": site_address,
                "網站 kids_menu 目前值": site_kids_menu,
                "建議 kids_menu": "yes",
                "網站親子分級": site_parent_friendly_level,
                "網站卡片簡介": site_summary,
            }
        )

    fieldnames = [
        "Place ID",
        "Google 餐廳名稱",
        "Google 地址",
        "Google 地圖網址",
        "Google 屬性分類",
        "Google 屬性名稱",
        "Google 屬性狀態",
        "Google 原始標籤",
        "網站餐廳名稱",
        "網站地址",
        "網站 kids_menu 目前值",
        "建議 kids_menu",
        "網站親子分級",
        "網站卡片簡介",
    ]
    with open(OUTPUT_CSV_PATH, "w", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"Google positive kids menu rows: {len(candidates_by_place_id)}")
    print(f"Rows needing site update: {len(output_rows)}")
    print(f"Wrote: {OUTPUT_CSV_PATH}")


if __name__ == "__main__":
    main()
