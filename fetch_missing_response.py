"""
fetch_missing_response.py
--------------------------
補抓 68 間「有 ai_review 但缺少 response JSON」的餐廳詳細資料。
因為我們已有 Place ID，直接跳過搜尋步驟，只呼叫 Place Details API。

執行方式（需先確認 .env.txt 內有 GOOGLE_MAP_KEY）：
    python fetch_missing_response.py

完成後記得執行 build 重建前端 bundle：
    node build-ai-review-index.mjs
"""

import sys
import builtins

# 強制 stdout 使用 UTF-8，避免 Windows cp950 編碼錯誤
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# safe_print：確保任何字元都能輸出，遇到無法編碼的字元以 ? 替代
_original_print = builtins.print
def safe_print(*args, **kwargs):
    sep = kwargs.get('sep', ' ')
    end = kwargs.get('end', '\n')
    msg = sep.join(str(a) for a in args)
    try:
        _original_print(msg, end=end)
    except UnicodeEncodeError:
        safe_msg = msg.encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')
        _original_print(safe_msg, end=end)
builtins.print = safe_print

import os
import json
import time
import urllib.request
import urllib.parse
import urllib.error

# ── 載入 API Key ───────────────────────────────────────────────
def load_env():
    for env_file in [".env", ".env.txt"]:
        if os.path.exists(env_file):
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ[key.strip()] = val.strip()

load_env()
API_KEY = os.environ.get("GOOGLE_MAP_KEY")

if not API_KEY:
    print("[ERROR] 找不到 GOOGLE_MAP_KEY，請確認 .env.txt 檔案。")
    exit(1)

# ── 68 間缺少 response JSON 的餐廳 Place ID ───────────────────
MISSING_PLACE_IDS = [
    "ChIJa52S0RmrQjQReEXMetVBYVM",
    "ChIJa75-XgCrQjQRTByUnJ2cOrs",
    "ChIJbebEdA6sQjQRaasm9Wu4mNI",
    "ChIJbZT4cGerQjQRbnqoTY6Ikag",
    "ChIJd_eNsgOrQjQRHFSYRBGxHCA",
    "ChIJe-xManurQjQR86B2AsLZUD8",
    "ChIJeQ2ZPcWpQjQR9CIDyjxAE3A",
    "ChIJe_9Xzq2tQjQRW_X242Ij31g",
    "ChIJfbKZpxKsQjQRvtD8q4M0Su8",
    "ChIJfeUCFeSpQjQR9fJzBtezjXI",
    "ChIJffZkwGSrQjQRRunrr_xZnVc",
    "ChIJfWgSz7urQjQRYAMY3X9FpWQ",
    "ChIJg4NaH0urQjQRK2ZqWRK3uvo",
    "ChIJgVgvZACpQjQRDve-1LbXFfk",
    "ChIJi475b6epQjQRlF1j2NEtN54",
    "ChIJiXRE-LupQjQRyd6HpdaxYCQ",
    "ChIJj4daWvOpQjQRmdZLtt75moo",
    "ChIJk0ASfQCtQjQR4hxS92gLUi0",
    "ChIJkbeqYWypQjQRvQWa7UGvPK0",
    "ChIJkQSnesWrQjQRV2pDGYqGIfc",
    "ChIJkS8XEwCpQjQR2zjrzEux8C0",
    "ChIJmaVySZ-rQjQRFNg_hzak7II",
    "ChIJn-m0V3qrQjQR-O8CeS4igvM",
    "ChIJn5OMO-2sQjQR342e0SjlCts",
    "ChIJnWGDlLKvQjQRTjk8b6Zq9wE",
    "ChIJo7OG_d2pQjQRaNzCBrpkous",
    "ChIJo8cmveipQjQR5EtNvSKd0mw",
    "ChIJoSkH1gipQjQR9GlRUDB6OgY",
    "ChIJoTSvuMGpQjQRK52LGjwSjcM",
    "ChIJoZlomYarQjQRQ6dO-drU7eg",
    "ChIJqQiO7kSpQjQRXfHwz8UCk78",
    "ChIJrfSsHgCrQjQRvEyfO8edh-Y",
    "ChIJryhpjFGrQjQRZgy0WI846oI",
    "ChIJs0t5m5CtQjQRMGEZlhs8eRI",
    "ChIJt5OKts-rQjQRxF4W2kf_-K4",
    "ChIJteW1fA2rQjQRnn1ngG3VKkE",
    "ChIJtWbWXESrQjQRNOOGVZuQOTc",
    "ChIJtyqVvb2pQjQRzhv78XzZ5Sw",
    "ChIJtZ0SogypQjQREQTIrZgANWI",
    "ChIJu1Cbju6rQjQRfHWLfwSBGjg",
    "ChIJuQTi1UurQjQRY_XJpSR0edQ",
    "ChIJuXc7QdGrQjQRRe9R3EsNDIA",
    "ChIJv7cGYWqtQjQRs6u8khox1OM",
    "ChIJvz0AwVmvQjQRa3dZ9XjMP28",
    "ChIJwTIC3uKtQjQRhXTeWjCsZvc",
    "ChIJwTl8w2erQjQRYdU-b3oz5F0",
    "ChIJxcrmDVSrQjQRuREs1tHCvN4",
    "ChIJxdRGEdirQjQRKLWOk-uOq5k",
    "ChIJxQLzBACpQjQR7aLkwWucdr0",
    "ChIJxS5AOACpQjQRESSmGlpIraI",
    "ChIJXS_yRcSrQjQR_GMKPRJ_Hnk",
    "ChIJXV9KedqpQjQRIKMWFU6bpTQ",
    "ChIJY3SpVBqpQjQR2n727CJgCuk",
    "ChIJyc-XtzCqQjQRB0mNbAizAmI",
    "ChIJYR9wWIytQjQR8gzoVNqYgy8",
    "ChIJYYuh_6-uQjQRdRs0Vw2YV4k",
    "ChIJZ2twoMirQjQRJNJcu10orfk",
    "ChIJZ4DQRqKpQjQR9IJ4UG9nqus",
    "ChIJZ7FzJUutQjQRqXgyxibc8kE",
    "ChIJZb55kW6rQjQR3vVUh5vYQ9w",
    "ChIJZb9VDgCpQjQRhaY_ZUUnN9w",
    "ChIJZc85mP-vQjQRenjCFHRVXvE",
    "ChIJzwp4oA6tQjQREDQBvyIbhqI",
    "ChIJZxaW3SOrQjQRGzm1zwc6r2U",
    "ChIJ_6itUgWsQjQRriwusI9z4lo",
    "ChIJ_bpJRJqpQjQRXz73PDJ74XA",
    "ChIJ_WZLPdGrQjQRAemg-ZR7K6I",
    "ChIJ_____5arQjQRmrr_ju481bw",
]

RESPONSE_DIR = "response"
os.makedirs(RESPONSE_DIR, exist_ok=True)

# ── Place Details API 呼叫 ──────────────────────────────────────
def fetch_place_details(place_id):
    """直接用 Place ID 呼叫 Place Details (New) API，取得含評論的完整資料。"""
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    fields = ",".join([
        "id",
        "displayName",
        "formattedAddress",
        "rating",
        "userRatingCount",
        "reviews",
        "types",
        "location",
        "websiteUri",
        "internationalPhoneNumber",
        "priceLevel",
        "goodForChildren",
        "menuForChildren",
    ])
    params = {
        "fields": fields,
        "key": API_KEY,
        "languageCode": "zh-Hant",
    }
    full_url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(full_url)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
            print(f"  [HTTP {e.code}] {body[:200]}")
        except Exception:
            print(f"  [HTTP {e.code}] {e}")
        return None
    except Exception as e:
        print(f"  [ERROR] {e}")
        return None


# ── 主流程 ──────────────────────────────────────────────────────
def main():
    total = len(MISSING_PLACE_IDS)
    print(f"[START] 開始補抓 {total} 間餐廳的 Google Places 資料...")
    print(f"        輸出目錄：{RESPONSE_DIR}/")
    print("=" * 60)

    success_count = 0
    skip_count = 0
    fail_count = 0

    for i, place_id in enumerate(MISSING_PLACE_IDS, 1):
        output_path = os.path.join(RESPONSE_DIR, f"{place_id}.json")

        # 若檔案已存在則跳過（避免重複扣款）
        if os.path.exists(output_path):
            print(f"[{i:02d}/{total}] SKIP  已存在：{place_id}")
            skip_count += 1
            continue

        print(f"[{i:02d}/{total}] FETCH {place_id} ...", end=" ", flush=True)
        data = fetch_place_details(place_id)

        if data:
            name = data.get("displayName", {}).get("text", "(無名稱)")
            reviews_count = len(data.get("reviews", []))
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"OK  [{name}]  ({reviews_count} 則評論)")
            success_count += 1
        else:
            print(f"FAIL (Place ID 可能已失效或被刪除)")
            fail_count += 1

        # 避免過快打 API（每次間隔 0.5 秒）
        time.sleep(0.5)

    print("=" * 60)
    print(f"[完成] 成功：{success_count}  跳過：{skip_count}  失敗：{fail_count}")
    if success_count > 0:
        print()
        print("下一步：重建前端 bundle，讓這些餐廳出現在網站上：")
        print("    node build-ai-review-index.mjs")


if __name__ == "__main__":
    main()
