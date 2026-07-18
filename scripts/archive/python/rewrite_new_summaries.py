import os
import json
import urllib.request
import urllib.error
import time

def call_gemini(prompt, api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 200
        }
    }
    
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            try:
                text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
                return text
            except KeyError:
                print("Error parsing Gemini response:", result)
                return None
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return None

def main():
    env_path = ".env"
    api_key = None
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    api_key = line.strip().split("=", 1)[1]
                    break

    if not api_key:
        print("GEMINI_API_KEY not found in .env")
        return

    # Read the 68 new restaurant IDs from fetch_missing_response.py
    import importlib.util
    spec = importlib.util.spec_from_file_location("fetch_missing", "fetch_missing_response.py")
    fetch_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fetch_module)
    missing_ids = fetch_module.MISSING_PLACE_IDS

    mall_keywords = [
        "新光三越", "sogo", "遠東百貨", "遠百", "微風", "breeze", 
        "統一時代", "京站", "qsquare", "美麗華", "誠品", "att 4 fun", 
        "環球", "global mall", "大葉高島屋", "大葉髙島屋", "bellavita", 
        "兒童新樂園", "101", "citylink", "明曜百貨", "忠泰樂生活", 
        "台北車站", "南港車站", "松山車站", "科教館", "天文館", "動物園"
    ]

    count = 0
    for place_id in missing_ids:
        resp_path = f"response/{place_id}.json"
        rev_path = f"ai_review/{place_id}.json"
        
        if not os.path.exists(resp_path) or not os.path.exists(rev_path):
            continue
            
        with open(resp_path, 'r', encoding='utf-8') as f:
            response_data = json.load(f)
            
        with open(rev_path, 'r', encoding='utf-8') as f:
            review_data = json.load(f)
            
        old_summary = review_data.get("generated_summary", "")
        if not old_summary or "官方標示" in old_summary:
            continue # already rewritten or empty
            
        extras = []
        if response_data.get("goodForChildren") is True:
            extras.append("餐廳官方標示適合兒童，預期有提供兒童椅及兒童餐具")
        if response_data.get("menuForChildren") is True:
            extras.append("餐廳標示有提供兒童餐")
            
        addr = (response_data.get("formattedAddress") or "").lower()
        name = (response_data.get("displayName", {}).get("text") or "").lower()
        
        if any(kw in addr or kw in name for kw in mall_keywords):
            extras.append("餐廳位於商場或園區內，周邊通常設有尿布台等便利設施")
            
        if not extras:
            continue # no need to rewrite
            
        official_info = "、".join(extras) + "。"
        
        prompt = f"""請根據以下「現有的餐廳評論摘要」以及「官方提供的額外資訊」，將這兩段資訊重寫合併成一段約 50-80 字以內、語氣自然、流暢且客觀的餐廳簡介。
請務必將所有資訊自然地融合在一段話中，像是一篇完整的短文，不要使用條列式，也不要使用「此外」、「另外」等生硬的連接詞來強行拼接。

現有的餐廳評論摘要：{old_summary}
官方提供的額外資訊：{official_info}

請直接輸出重寫後的摘要內容，不要包含任何其他問候語或解釋。"""

        print(f"Rewriting {place_id} ({name})...")
        new_summary = call_gemini(prompt, api_key)
        if new_summary:
            print(f"  Old: {old_summary}")
            print(f"  New: {new_summary}")
            review_data["generated_summary"] = new_summary
            review_data["card_summary"] = new_summary
            
            with open(rev_path, 'w', encoding='utf-8') as f:
                json.dump(review_data, f, ensure_ascii=False, indent=4)
            count += 1
            time.sleep(1) # rate limit

    print(f"Successfully rewrote {count} summaries.")

if __name__ == "__main__":
    import sys
    import builtins
    _original_print = builtins.print
    def safe_print(*args, **kwargs):
        sep = kwargs.get('sep', ' ')
        end = kwargs.get('end', '\n')
        file = kwargs.get('file', sys.stdout)
        msg = sep.join(str(arg) for arg in args)
        encoding = getattr(file, 'encoding', None) or 'utf-8'
        try:
            msg = msg.encode(encoding, errors='replace').decode(encoding)
        except Exception:
            pass
        new_kwargs = {k: v for k, v in kwargs.items() if k not in ('sep', 'end', 'file')}
        _original_print(msg, end=end, file=file, **new_kwargs)
    builtins.print = safe_print

    main()
