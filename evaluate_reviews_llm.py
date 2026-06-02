import os
import json
import time
import argparse
import google.generativeai as genai

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

load_env()

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("❌ 錯誤：找不到 GEMINI_API_KEY。請確認您的 .env 檔案中有設定 GEMINI_API_KEY=您的金鑰")
    exit(1)

genai.configure(api_key=API_KEY)

# 為了確保能順利在免費額度內跑完 400 多筆，我們使用 gemini-1.5-flash (免費版每日上限 1500 次)
# 若使用 gemini-1.5-pro 免費版每日上限僅 50 次會不夠跑。
MODEL_NAME = 'gemini-1.5-flash' 
model = genai.GenerativeModel(
    MODEL_NAME,
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.2 # 降低隨機性，讓判斷更穩定
    )
)

SYSTEM_PROMPT = """
You are an expert at analyzing restaurant reviews for kid-friendliness.
Evaluate the restaurant based on its reviews. 
Return ONLY a valid JSON object. Do not wrap it in markdown.

Labels to evaluate:
1. " child_seat available"
Strict: Only 'Yes' if explicitly mentions 兒童椅, 嬰兒椅, 餐椅, 兒童座椅, 嬰兒座椅, high chair, baby chair, booster seat, etc. "椅子" or "座位" alone do not count. 
If not explicitly mentioned, return 'Unknown'.
2. "Spacious seating"
Semantic: Describe the dining space/environment size or crowdedness. 
Yes: 空間大, 寬敞, 店內環境很舒服, 適合推車, 放得下推車. 
No: 空間不大, 很小, 擁擠, 狹小, 位子擠, 不適合推車. 
Do not count: 魚很大, 份量很大, 項目很多.
If unclear or not mentioned, return 'Unknown'.
3. "Kids menu available"
Strict: Only 'Yes' if explicitly mentions 兒童餐, 寶寶餐, kids menu, 寶寶粥. 
'No' if explicitly says no kids menu. 'Unknown' if not mentioned.
4. "kid_noise_tolerant"
Loose: Is the environment suitable for bringing kids/not afraid of noise?
Yes: 有家庭客, 親子友善, 小孩很多, 氣氛熱鬧, 適合帶小孩.
No: 很安靜, 適合約會, 氣氛安靜, 明確不適合小孩, 怕吵. 
Understand the whole sentence context.

Key requirements:
1. `evidence` must be a complete sentence from the review. Do not just capture a fragment. If no evidence, set to null.
2. `generated_signals` must be an array of strings containing all sentences related to the 4 labels (both positive and negative). If all 4 are Unknown, return [].
3. Do not guess. If no info, mark 'Unknown'.
4. `confidence`: If result is 'Unknown', confidence is 0.4. Otherwise 0.9.
5. `generated_summary`: Make it natural, fluent, and specific based on the findings. Do not use the same template for every restaurant. If all are Unknown, write "目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。"

Output JSON Format:
{
  " child_seat available": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "Spacious seating": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "Kids menu available": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "kid_noise_tolerant": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "generated_signals": ["sentence 1", "sentence 2"],
  "generated_summary": "fluent summary"
}
"""

def evaluate_restaurant(reviews_text, restaurant_name):
    prompt = f"{SYSTEM_PROMPT}\n\nRestaurant Name: {restaurant_name}\nReviews:\n{reviews_text}\n\nProvide the JSON:"
    response = model.generate_content(prompt)
    return json.loads(response.text)

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
        
    if score >= 3:
        level = "高"
    elif score > 0:
        level = "中"
    else:
        level = "資訊不足"
        
    return score, level

def main():
    parser = argparse.ArgumentParser(description="Evaluate restaurant reviews using Gemini API")
    parser.add_argument("--test", action="store_true", help="只測試前 2 筆資料")
    args = parser.parse_args()

    response_files = [f for f in os.listdir(response_dir) if f.endswith(".json")]
    if args.test:
        response_files = response_files[:2]
        print(f"🧪 測試模式：只處理 {len(response_files)} 筆資料...")
    else:
        print(f"🚀 開始處理 {len(response_files)} 筆資料...")
    
    count = 0
    for filename in response_files:
        filepath = os.path.join(response_dir, filename)
        output_path = os.path.join(output_dir, filename)
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            name = data.get("displayName", {}).get("text", "Unknown")
            reviews = data.get("reviews", [])
            
            # Combine all reviews into a single text block
            reviews_text = ""
            for i, r in enumerate(reviews, 1):
                text_obj = r.get("originalText") or r.get("text") or {}
                text = text_obj.get("text", "")
                if text:
                    reviews_text += f"Review {i}:\n{text}\n\n"
                    
            if not reviews_text.strip():
                print(f"⚠️ {filename} ({name}) 沒有評論資料，自動建立預設『資訊不足』評估（省下 AI Token）。")
                final_output = {
                    " child_seat available": {"result": "Unknown", "evidence": None, "confidence": 0.4},
                    "Spacious seating": {"result": "Unknown", "evidence": None, "confidence": 0.4},
                    "Kids menu available": {"result": "Unknown", "evidence": None, "confidence": 0.4},
                    "kid_noise_tolerant": {"result": "Unknown", "evidence": None, "confidence": 0.4},
                    "parent_friendly_score": 0,
                    "parent_friendly_level": "資訊不足",
                    "reason": "目前無足夠評論資料進行AI評估",
                    "generated_signals": [],
                    "generated_summary": "目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。"
                }
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(final_output, f, ensure_ascii=False, indent=4)
                count += 1
                continue
                
            print(f"🔄 正在分析: {name} ({filename})...")
            
            # Call LLM
            analysis = evaluate_restaurant(reviews_text, name)
            
            # Calculate final scores
            score, level = calculate_score(analysis)
            
            # Ensure the specific keys with spaces match the expected structure
            final_output = {
                " child_seat available": analysis.get(" child_seat available", {"result": "Unknown", "evidence": None, "confidence": 0.4}),
                "Spacious seating": analysis.get("Spacious seating", {"result": "Unknown", "evidence": None, "confidence": 0.4}),
                "Kids menu available": analysis.get("Kids menu available", {"result": "Unknown", "evidence": None, "confidence": 0.4}),
                "kid_noise_tolerant": analysis.get("kid_noise_tolerant", {"result": "Unknown", "evidence": None, "confidence": 0.4}),
                "parent_friendly_score": score,
                "parent_friendly_level": level,
                "reason": "AI語意綜合評估",
                "generated_signals": analysis.get("generated_signals", []),
                "generated_summary": analysis.get("generated_summary", "目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。")
            }
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(final_output, f, ensure_ascii=False, indent=4)
                
            count += 1
            
            # 小睡一下避免觸發免費用戶 API 速率限制 (15 RPM)
            if not args.test:
                time.sleep(3)
                
        except Exception as e:
            print(f"❌ 處理 {filename} 時發生錯誤: {e}")
            
    print(f"✅ 成功完成 {count} 筆餐廳的 AI 分析！")

if __name__ == "__main__":
    main()
