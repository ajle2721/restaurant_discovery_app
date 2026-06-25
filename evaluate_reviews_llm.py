import os
import json
import time
import argparse
import re
import sys
import builtins
import urllib.request
import urllib.error
import urllib.parse

# Save original print to avoid infinite recursion
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

response_dir = "response"
output_dir = "ai_review"
os.makedirs(output_dir, exist_ok=True)

# 嘗試手動讀取 .env，避免依賴 python-dotenv
def load_env():
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()
    elif os.path.exists(".env.txt"):
        with open(".env.txt", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

load_env()

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("[ERROR] 找不到 GEMINI_API_KEY。請確認您的 .env 檔案中有設定 GEMINI_API_KEY=您的金鑰")
    exit(1)

# 載入連鎖品牌預設規則
BRAND_RULES = {}
if os.path.exists("brand_rules.json"):
    try:
        with open("brand_rules.json", "r", encoding="utf-8") as f:
            BRAND_RULES = json.load(f)
        print(f"[INFO] 成功載入 {len(BRAND_RULES)} 個連鎖品牌的評估規則。")
    except Exception as e:
        print(f"[WARNING] 載入 brand_rules.json 失敗: {e}")
else:
    print("[WARNING] 找不到 brand_rules.json，將無法套用連鎖品牌預設規則。")

SYSTEM_PROMPT = """
You are an expert at analyzing restaurant reviews and attributes for kid-friendliness.
Evaluate the restaurant based on its reviews and Google Maps Attributes.
Return ONLY a valid JSON object. Do not wrap it in markdown.

Labels to evaluate:
1. " child_seat available"
Strict: Only 'Yes' if reviews explicitly mention 兒童椅, 嬰兒椅, 餐椅, 兒童座椅, 嬰兒座椅, high chair, baby chair, booster seat, etc. Do not infer this from generic child-friendly attributes like 'Good for children'.
If not explicitly mentioned, return 'Unknown'.
2. "Spacious seating"
Semantic: Describe the dining space/environment size or crowdedness. 
Yes: 空間大, 寬敞, 店內環境很舒服, 適合推車, 放得下推車. 
No: 空間不大, 很小, 擁擠, 狹小, 位子擠, 不適合推車. 
If unclear or not mentioned, return 'Unknown'.
3. "Kids menu available"
Strict: Only 'Yes' if reviews explicitly mention 兒童餐, 寶寶餐, kids menu, 寶寶粥, OR if Google Maps Attributes has "Menu for children". 
'No' if explicitly says no kids menu. 'Unknown' if not mentioned.
4. "kid_noise_tolerant"
Loose: Is the environment suitable for bringing kids/not afraid of noise?
Yes: 有家庭客, 親子友善, 小孩很多, 氣氛熱鬧, 適合帶小孩, OR Google Maps Attributes has "Good for children".
No: 很安靜, 氣氛安靜, 不適合小孩, 怕吵. 
5. "has_play_area"
Yes: Has play area, slide, toys, kids club, etc. (遊戲區, 遊戲角, 溜滑梯, 玩具, 遊戲室, 決明子沙坑).
No: Explicitly says no play area. 'Unknown' if not mentioned.
6. "has_private_room"
Yes: Explicitly mentions 包廂, private room.
No: Explicitly says no private room. 'Unknown' if not mentioned.
7. "has_tableware"
Yes: Explicitly mentions 兒童餐具, 兒童碗, 兒童餐盤, kids tableware, kids cups, etc.
No: 'Unknown' if not mentioned.
8. "has_diaper_table"
Yes: Explicitly mentions 尿布台, 尿布檯, 尿布床, 換尿布, diaper table, baby changing table, diaper changing station.
No: 'Unknown' if not mentioned.

Key requirements:
1. `evidence` must be a complete sentence from the review or 'Google Maps Attributes'. If no evidence, set to null.
2. `generated_signals` must be an array of strings containing all sentences/sources related to the evaluated labels.
3. Do not guess. If no info, mark 'Unknown'.
4. `confidence`: If result is 'Unknown', confidence is 0.4. Otherwise 0.9 (or 1.0 if from Google Maps Attributes).
5. `generated_summary`: Make it natural, fluent, and specific based on findings. If all are Unknown, write "目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。"

Output JSON Format:
{
  " child_seat available": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "Spacious seating": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "Kids menu available": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "kid_noise_tolerant": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "has_play_area": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "has_private_room": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "has_tableware": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "has_diaper_table": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "generated_signals": ["sentence 1", "sentence 2"],
  "generated_summary": "fluent summary"
}
"""

def clean_brand_name(name):
    if not name:
        return ""
    # Remove contents in brackets/parentheses
    cleaned = re.sub(r'([\(（\[【])(.*?)([\)）\]】])', '', name)
    # Suffixes to strip to find the base brand name
    BRANCH_PATTERNS = [
        r'\s*\(.*?店\)$', r'\s*（.*?店）$', r'\s*\[.*?店\]$', r'\s*【.*?店】$',
        r'\s+臺?北\w*店$', r'\s*\w+店$', r'\s*\w+分店$', r'\s*-\s*\w+店$', r'\s*-\w+店$',
        r'\s+旗旗店$', r'\s+門市$', r'\s*\w+門市$', r'\s*\w+館$', r'\s+臺?北\w*館$'
    ]
    for pattern in BRANCH_PATTERNS:
        cleaned = re.compile(pattern, re.IGNORECASE).sub('', cleaned)
    cleaned = re.sub(r'[\/／\|｜~～].*$', '', cleaned)
    return cleaned.strip()

def is_in_shopping_mall(name, address):
    mall_keywords = [
        "百貨", "商場", "廣場", "購物中心", "誠品", "SOGO", "微風", 
        "新光三越", "遠東", "FE21", "統一時代", "京站", "美麗華", 
        "BELLAVITA", "ATT 4 FUN", "三創", "CITYLINK", "LALAPORT", 
        "大葉高島屋", "明曜", "NOKE", "環球購物", "GLOBAL MALL",
        "大樓", "地下街"
    ]
    name_upper = name.upper()
    address_upper = address.upper()
    for kw in mall_keywords:
        if kw in name_upper or kw in address_upper:
            return True
    return False

def evaluate_restaurant(reviews_text, restaurant_name, google_attrs_text="None"):
    # 使用 Google Gemini REST API，免除對 google-generativeai 套件的依賴
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={API_KEY}"
    prompt = f"{SYSTEM_PROMPT}\n\nRestaurant Name: {restaurant_name}\nGoogle Maps Attributes:\n{google_attrs_text}\n\nReviews:\n{reviews_text}\n\nProvide the JSON:"
    
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
            
        text_content = resp_data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text_content)
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8")
            print(f"  [AI ERROR] HTTP {e.code}: {err_body}")
        except Exception:
            print(f"  [AI ERROR] HTTP {e.code}: {e}")
        raise e
    except Exception as e:
        print(f"  [AI ERROR] Request failed: {e}")
        raise e

def calculate_score(analysis):
    score = 0
    if analysis.get(" child_seat available", {}).get("result") == "Yes": score += 2
    if analysis.get("Spacious seating", {}).get("result") == "Yes": score += 1
    if analysis.get("Kids menu available", {}).get("result") == "Yes": score += 1
    if analysis.get("kid_noise_tolerant", {}).get("result") == "Yes": score += 1
    
    if (analysis.get(" child_seat available", {}).get("result") == "No" or 
        analysis.get("Spacious seating", {}).get("result") == "No" or 
        analysis.get("kid_noise_tolerant", {}).get("result") == "No"):
        score -= 2
        
    # 新版等級計算規則
    has_tableware = analysis.get("has_tableware", {}).get("result") == "Yes"
    has_high_chair = (analysis.get(" child_seat available", {}).get("result") == "Yes" or 
                      analysis.get("child_seat available", {}).get("result") == "Yes")
    has_kids_menu = analysis.get("Kids menu available", {}).get("result") == "Yes"
    has_play_area = analysis.get("has_play_area", {}).get("result") == "Yes"
    
    is_recommended = (has_tableware and has_high_chair) or (has_kids_menu or has_play_area)
    
    # 統計任意 Yes 項目數
    keys = [" child_seat available", "child_seat available", "Spacious seating", "Kids menu available", 
            "kid_noise_tolerant", "has_play_area", "has_private_room", "has_tableware", "has_diaper_table"]
    total_yes = 0
    for k in keys:
        if analysis.get(k, {}).get("result") == "Yes":
            total_yes += 1
            
    if is_recommended:
        level = "高"
    elif total_yes >= 1:
        level = "中"
    else:
        level = "資訊不足"
        
    return score, level

def main():
    parser = argparse.ArgumentParser(description="Evaluate restaurant reviews using Gemini API REST endpoint")
    parser.add_argument("--test", action="store_true", help="只測試前 2 筆資料")
    parser.add_argument("--force", action="store_true", help="強制重新評估已有資料的餐廳（保留手動修改）")
    parser.add_argument("--rules-only", action="store_true", help="僅套用連鎖品牌與百貨商場規則，不調用 Gemini API")
    args = parser.parse_args()

    response_files = [f for f in os.listdir(response_dir) if f.endswith(".json")]
    if args.test:
        response_files = response_files[:2]
        print(f"[TEST] 測試模式：只處理 {len(response_files)} 筆資料...")
    else:
        print(f"[INFO] 開始處理 {len(response_files)} 筆資料...")
    
    count = 0
    for filename in response_files:
        filepath = os.path.join(response_dir, filename)
        output_path = os.path.join(output_dir, filename)
        place_id = os.path.splitext(filename)[0]
        
        # 讀取現有的 AI review JSON 以保留手動更改 (confidence >= 1.0)
        existing_ai = None
        if os.path.exists(output_path):
            try:
                with open(output_path, 'r', encoding='utf-8-sig') as f_ex:
                    existing_ai = json.load(f_ex)
            except Exception:
                pass
                
        # 智慧跳過邏輯：如果已有真實的 AI 分析（reason 不是規則預設），且沒有啟用 force/test，則跳過
        if existing_ai and not args.force and not args.test:
            reason = existing_ai.get("reason", "")
            if reason != "連鎖/商場規則預設評估" and reason != "AI語意綜合與連鎖/商場規則評估":
                count += 1
                continue
        
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
                
            name = data.get("displayName", {}).get("text", "Unknown")
            address = data.get("formattedAddress") or data.get("formatted_address") or ""
            reviews = data.get("reviews", [])
            
            # 取得 Google 官方親子與兒童屬性
            good_for_children = data.get("goodForChildren")
            menu_for_children = data.get("menuForChildren")
            
            google_attributes = []
            if good_for_children is True:
                google_attributes.append("Good for children (官方標記：適合兒童)")
            elif good_for_children is False:
                google_attributes.append("Not good for children (官方標記：不適合兒童)")
                
            if menu_for_children is True:
                google_attributes.append("Menu for children (官方標記：提供兒童餐)")
            elif menu_for_children is False:
                google_attributes.append("No menu for children (官方標記：不提供兒童餐)")
                
            google_attrs_text = "\n".join(google_attributes) if google_attributes else "None"
            
            # 整理評論文字
            reviews_text = ""
            for i, r in enumerate(reviews, 1):
                text_obj = r.get("originalText") or r.get("text") or {}
                text = text_obj.get("text", "")
                if text:
                    reviews_text += f"Review {i}:\n{text}\n\n"
            
            # 連鎖品牌規則提取
            brand = clean_brand_name(name)
            applied_brand_rules = BRAND_RULES.get(brand, {})
            if applied_brand_rules:
                print(f"    [BRAND RULE] 發現 '{name}' 的連鎖品牌規則: {brand}")
            
            # 判斷是否位於百貨商場/大樓
            in_mall = is_in_shopping_mall(name, address)
            
            # 判斷是否為連鎖/高價位
            price_level = data.get("priceLevel") or data.get("price_level")
            is_expensive = (price_level in ["PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"]) or any(kw in name.upper() for kw in ["飯店", "酒店", "會館", "賓館", "VILLA"])
            is_chain = bool(applied_brand_rules)
            
            # 判斷是否有手動設定
            preserved_keys = {}
            if existing_ai:
                for k in [" child_seat available", "Spacious seating", "Kids menu available", "kid_noise_tolerant", "has_play_area", "has_private_room", "has_tableware", "has_diaper_table"]:
                    if k in existing_ai and existing_ai[k].get("confidence", 0) >= 1.0:
                        preserved_keys[k] = existing_ai[k]
            
            # 沒有評論資料的退路或在 rules-only 模式下
            called_llm = False
            if not reviews_text.strip() or args.rules_only:
                if args.rules_only:
                    # 規則模式下跳過呼叫
                    pass
                else:
                    print(f"[WARNING] {filename} ({name}) 沒有評論資料，自動建立預設評估。")
                analysis = {}
            else:
                print(f"[INFO] 正在分析: {name} ({filename})...")
                try:
                    analysis = evaluate_restaurant(reviews_text, name, google_attrs_text)
                    called_llm = True
                except Exception as e:
                    print(f"  [AI ERROR] Gemini 呼叫失敗: {e}，將使用預設空值。")
                    analysis = {}
            
            # 融合 LLM 回傳、連鎖店規則、商場預設尿布台與手動保留
            final_attrs = {}
            keys_to_evaluate = [
                (" child_seat available", "Unknown"),
                ("Spacious seating", "Unknown"),
                ("Kids menu available", "Unknown"),
                ("kid_noise_tolerant", "Unknown"),
                ("has_play_area", "Unknown"),
                ("has_private_room", "Unknown"),
                ("has_tableware", "Unknown"),
                ("has_diaper_table", "Unknown")
            ]
            
            for index_key, default_val in keys_to_evaluate:
                # 1. 優先保留人工修改 (confidence >= 1.0)
                if index_key in preserved_keys:
                    final_attrs[index_key] = preserved_keys[index_key]
                    continue
                    
                # 2. 次優先套用連鎖店品牌規則
                if index_key in applied_brand_rules:
                    final_attrs[index_key] = {
                        "result": applied_brand_rules[index_key]["result"],
                        "evidence": applied_brand_rules[index_key]["evidence"],
                        "confidence": applied_brand_rules[index_key]["confidence"]
                    }
                    continue
                    
                # 3. 百貨公司與商場預設勾選尿布台
                if index_key == "has_diaper_table" and in_mall:
                    final_attrs[index_key] = {
                        "result": "Yes",
                        "evidence": "位於百貨公司/商場/大樓內，可使用商場/大樓附設之尿布台",
                        "confidence": 1.0
                    }
                    continue
                    
                # 3.5 依據 Google 官方「適合兒童」屬性自動設定兒童椅、兒童餐具與環境適合兒童用餐
                if (index_key == " child_seat available" or index_key == "has_tableware" or index_key == "kid_noise_tolerant") and good_for_children is True:
                    if (index_key == " child_seat available" or index_key == "has_tableware") and not (in_mall or is_chain or is_expensive):
                        # 如果不是商場、連鎖或高價位餐廳，即使官方標示適合兒童，也不自動預設有椅/餐具，需依賴評論/LLM
                        pass
                    else:
                        final_attrs[index_key] = {
                            "result": "Yes",
                            "evidence": "Google 官方商標或設施提供兒童椅" if index_key == " child_seat available" else ("Google 官方商標或設施提供兒童餐具" if index_key == "has_tableware" else "Google 官方登記適合兒童用餐"),
                            "confidence": 1.0
                        }
                        continue

                    
                # 4. 套用 LLM 評估或預設空值
                item = analysis.get(index_key, {"result": default_val, "evidence": None, "confidence": 0.4})
                final_attrs[index_key] = item
            
            # 計算分數與評等
            score, level = calculate_score(final_attrs)
            
            # 綜合摘要整理與衝突修正
            summary = analysis.get("generated_summary", "")
            is_fallback = not summary.strip() or "較少提及" in summary or "少提及" in summary
            
            if is_fallback:
                parts = []
                if final_attrs[" child_seat available"]["result"] == "Yes":
                    parts.append("兒童座椅")
                if final_attrs["has_tableware"]["result"] == "Yes":
                    parts.append("兒童餐具")
                if final_attrs["Kids menu available"]["result"] == "Yes":
                    parts.append("兒童餐點")
                if final_attrs["has_diaper_table"]["result"] == "Yes":
                    if in_mall:
                        parts.append("可使用商場附設之尿布台")
                    else:
                        parts.append("尿布台")
                if final_attrs["has_play_area"]["result"] == "Yes":
                    parts.append("遊戲區")
                if final_attrs["kid_noise_tolerant"]["result"] == "Yes":
                    parts.append("環境氣氛適合帶小孩")
                
                if parts:
                    summary = f"這家餐廳提供{'、'.join(parts)}。目前評論中較少提及其他親子用餐的具體細節，建議前往前可先向店家確認。"
                else:
                    summary = "目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。"
            else:
                if in_mall and "尿布台" not in summary and final_attrs["has_diaper_table"]["result"] == "Yes":
                    summary = "位於百貨商場大樓內，可方便使用附設尿布台。" + summary
            
            # 收集 signals (去重)
            signals = set()
            for k, val in final_attrs.items():
                ev = val.get("evidence")
                if ev:
                    signals.add(ev)
            for s in analysis.get("generated_signals", []):
                if s:
                    signals.add(s)
            
            # 設定原因標示，用來做智慧跳過
            if preserved_keys:
                reason_str = "人工校正與AI綜合評估"
            elif called_llm:
                reason_str = "AI語意綜合與連鎖/商場與評論語意分析"
            else:
                reason_str = "連鎖/商場規則預設評估"
            
            final_output = {
                " child_seat available": final_attrs[" child_seat available"],
                "Spacious seating": final_attrs["Spacious seating"],
                "Kids menu available": final_attrs["Kids menu available"],
                "kid_noise_tolerant": final_attrs["kid_noise_tolerant"],
                "has_play_area": final_attrs["has_play_area"],
                "has_private_room": final_attrs["has_private_room"],
                "has_tableware": final_attrs["has_tableware"],
                "has_diaper_table": final_attrs["has_diaper_table"],
                "parent_friendly_score": score,
                "parent_friendly_level": level,
                "reason": reason_str,
                "generated_signals": list(signals),
                "generated_summary": summary,
                "card_summary": existing_ai.get("card_summary", "") if existing_ai else ""
            }
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(final_output, f, ensure_ascii=False, indent=4)
                
            count += 1
            print(f"    [SUCCESS] 已儲存 AI 分析至 {output_path}")
            
            # 小睡一下避免觸發免費用戶 API 速率限制 (15 RPM)
            if not args.test and not args.rules_only:
                time.sleep(4.2)
                
        except Exception as e:
            print(f"[ERROR] 處理 {filename} 時發生錯誤: {e}")
            
    print(f"[SUCCESS] 成功完成 {count} 筆餐廳的 AI 分析！")

if __name__ == "__main__":
    main()
