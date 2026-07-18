import os
import json
import re

ai_review_dir = "ai_review"
response_dir = "response"

def get_unique_features(reviews_data):
    """Extract unique kid-friendly features from reviews if present."""
    text = ""
    for r in reviews_data.get("reviews", []):
        text_obj = r.get("originalText") or r.get("text") or {}
        text += " " + text_obj.get("text", "")
    
    features = []
    if re.search(r"主題", text): features.append("主題特色")
    if re.search(r"遊戲區|遊戲室|溜滑梯|球池", text): features.append("設有遊戲區")
    if re.search(r"聚餐|聚會|家族", text): features.append("適合多家庭聚餐")
    if re.search(r"慶生|生日", text): features.append("適合辦慶生活動")
    if re.search(r"戶外|庭院|草地|草皮", text): features.append("有戶外活動空間")
    if re.search(r"熱鬧|吵雜", text): features.append("氣氛熱鬧自在")
    if re.search(r"寵物|貓|狗|動物", text): features.append("有可愛小動物")
    if re.search(r"甜點|下午茶", text): features.append("適合帶小孩吃下午茶")
    if re.search(r"景觀|風景", text): features.append("有景觀視野")
    
    return features

def generate_card_summary(level, features, ai_summary):
    """Generate card summary according to user rules."""
    
    # Heuristic: if ai_summary mentions something unique but not in my feature list
    unique_hint = ""
    if "餐點" in ai_summary: unique_hint = "餐點口味適合親子"
    if "氣氛" in ai_summary: unique_hint = "用餐氛圍輕鬆"
    
    if level == "高":
        if features:
            f = features[0]
            return f"{f}，用餐氛圍輕鬆熱鬧，適合家庭聚餐。"
        else:
            return "氣氛輕鬆熱鬧，適合帶小孩一同聚餐體驗。"
            
    elif level == "中":
        if features:
            f = features[0]
            return f"{f}，空間尚算舒適，適合作為備選方案。"
        else:
            return "空間舒適，適合家庭用餐，但設施資訊較少。"
            
    elif level == "需留意" or level == "Needs Attention":
        if "空間" in ai_summary and ("小" in ai_summary or "擁擠" in ai_summary or "緊湊" in ai_summary):
            return "空間較小且座位有限，帶小孩前往需留意。"
        if "安靜" in ai_summary:
            return "環境較為安靜，帶小孩用餐可能需要多留意。"
        return "部分用餐條件較受限，建議查看詳情後再做決定。"
        
    else: # 資訊不足
        return "目前親子設施相關資訊較有限，建議前往前再確認。"

def main():
    files = [f for f in os.listdir(ai_review_dir) if f.endswith(".json") and f != "index.js"]
    print(f"Generating card_summaries for {len(files)} files...")
    
    updated_count = 0
    for filename in files:
        ai_path = os.path.join(ai_review_dir, filename)
        resp_path = os.path.join(response_dir, filename)
        
        try:
            with open(ai_path, "r", encoding="utf-8") as f:
                ai_data = json.load(f)
            
            # Default to empty if response doesn't exist
            resp_data = {}
            if os.path.exists(resp_path):
                with open(resp_path, "r", encoding="utf-8") as f:
                    resp_data = json.load(f)
            
            level = ai_data.get("parent_friendly_level", "資訊不足")
            ai_summary = ai_data.get("generated_summary", "")
            features = get_unique_features(resp_data)
            
            card_summary = generate_card_summary(level, features, ai_summary)
            if card_summary:
                card_summary = card_summary.replace(",", "，")
            
            # Truncate if necessary (though our templates are short)
            if len(card_summary) > 45:
                card_summary = card_summary[:42] + "..."
                
            ai_data["card_summary"] = card_summary
            if "generated_summary" in ai_data and isinstance(ai_data["generated_summary"], str):
                ai_data["generated_summary"] = ai_data["generated_summary"].replace(",", "，")
            
            with open(ai_path, "w", encoding="utf-8") as f:
                json.dump(ai_data, f, ensure_ascii=False, indent=4)
            updated_count += 1
            
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    print(f"Successfully updated {updated_count} files with card_summary.")

if __name__ == "__main__":
    main()
