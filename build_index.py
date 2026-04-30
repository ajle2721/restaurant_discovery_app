
import os
import json

def main():
    base_dir = os.getcwd()
    ai_review_dir = os.path.join(base_dir, "ai_review")
    response_dir = os.path.join(base_dir, "response")
    output_path = os.path.join(ai_review_dir, "index.js")

    taipei_districts = ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"]

    def normalize_result(result):
        if not result: return "unknown"
        val = str(result).strip().lower()
        if val == "yes": return "yes"
        if val == "no": return "no"
        return "unknown"

    def get_chinese_level(level):
        mapping = {
            "High": "高",
            "Medium": "中",
            "Needs Attention": "需留意",
            "Insufficient Info": "資訊不足"
        }
        return mapping.get(level, "資訊不足")

    def read_json_safe(path):
        # 依次嘗試多種編碼，並檢查內容是否包含亂碼標記
        encodings = ['utf-8-sig', 'utf-8', 'utf-16', 'big5', 'cp950']
        for enc in encodings:
            try:
                with open(path, 'r', encoding=enc) as f:
                    data = json.load(f)
                    # 簡單檢查一下讀出來的文字是否包含明顯的編碼錯誤字元
                    test_str = str(data)
                    if '' not in test_str:
                        return data
            except:
                continue
        # 如果都有亂碼，最後只好隨便選一個能跑的
        for enc in encodings:
            try:
                with open(path, 'r', encoding=enc) as f:
                    return json.load(f)
            except:
                continue
        return None

    records = []
    print("🚀 正在執行容錯打包，修復農人餐桌與亂碼問題...")

    files = [f for f in os.listdir(ai_review_dir) if f.endswith(".json")]
    files.sort()

    for filename in files:
        place_id = filename.replace(".json", "")
        response_path = os.path.join(response_dir, f"{place_id}.json")
        ai_path = os.path.join(ai_review_dir, filename)

        if os.path.exists(response_path):
            response = read_json_safe(response_path)
            ai_review = read_json_safe(ai_path)
            
            if response is None or ai_review is None:
                continue

            name = response.get("displayName", {}).get("text", "")
            address = response.get("formattedAddress", "").replace("臺", "台").replace("区", "區")
            
            district = ""
            for d in taipei_districts:
                if d in address:
                    district = d
                    break
            
            # 如果還是沒抓到 district，嘗試從地址的前幾個字硬抓
            if not district:
                if "中正" in address: district = "中正區"
                elif "內湖" in address: district = "內湖區"
                # ... 其他行政區以此類推

            google_maps_url = f"https://www.google.com/maps/search/?api=1&query={name}&query_place_id={place_id}"
            
            signals = ai_review.get("generated_signals", [])
            if isinstance(signals, str):
                signals = [signals]
            
            high_chair = "unknown"
            if " child_seat available" in ai_review:
                high_chair = normalize_result(ai_review[" child_seat available"].get("result"))
            elif "child_seat available" in ai_review:
                high_chair = normalize_result(ai_review["child_seat available"].get("result"))

            records.append({
                "place_id": place_id,
                "name": name,
                "address": address,
                "formatted_address": address,
                "district": district,
                "rating": str(response.get("rating", "")),
                "user_ratings_total": response.get("userRatingCount", 0),
                "latitude": response.get("location", {}).get("latitude"),
                "longitude": response.get("location", {}).get("longitude"),
                "url": google_maps_url,
                "google_maps_url": google_maps_url,
                "attributes": {
                    "high_chair_available": high_chair,
                    "kids_menu": normalize_result(ai_review.get("Kids menu available", {}).get("result")),
                    "spacious_seating": normalize_result(ai_review.get("Spacious seating", {}).get("result")),
                    "kid_noise_tolerant": normalize_result(ai_review.get("kid_noise_tolerant", {}).get("result")),
                },
                "ai_summary": ai_review.get("generated_summary", ""),
                "signals": signals,
                "parent_friendly_score": ai_review.get("parent_friendly_score", 0),
                "parent_friendly_level": get_chinese_level(ai_review.get("parent_friendly_level")),
                "reason": ai_review.get("reason", "綜合評估"),
                "reviews": response.get("reviews", [])
            })

    content = f"const restaurantData = {json.dumps(records, ensure_ascii=False, indent=2)};\n"
    with open(output_path, "w", encoding="utf-8-sig") as f:
        f.write(content)

    print(f"✨ 打包成功！特別檢查：農人餐桌應已歸類至中正區。")

if __name__ == "__main__":
    main()
