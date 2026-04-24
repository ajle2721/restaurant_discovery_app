import os
import json
import re

response_dir = "response"
output_dir = "ai_review"
os.makedirs(output_dir, exist_ok=True)

# Strict regex matching patterns
PATTERNS = {
    "high_chair_available": {
        "Yes": [r"有.*(兒童椅|嬰兒椅|餐椅|小椅子|高腳椅)", r"提供.*(兒童椅|嬰兒椅|餐椅|小椅子)", r"備有.*(兒童椅|嬰兒椅|餐椅)"],
        "No": [r"沒有.*(兒童椅|嬰兒椅|餐椅)", r"沒.*(兒童椅|嬰兒椅|餐椅)", r"無.*(兒童椅|嬰兒椅|餐椅)", r"不提供.*(兒童椅|嬰兒椅|餐椅)"]
    },
    "spacious_seating": {
        "Yes": [r"空間(很)?(大|寬敞)", r"寬敞", r"推車(很)?方便", r"好推車", r"可以推車", r"適合推車", r"放得下推車", r"空間很夠"],
        "No": [r"空間(狹)?小", r"小小(的)?店", r"座位(間)?(很|太|較)?(擠|近|小)", r"位置(很|太|較)?(擠|近|小)", r"位子(很|太|較)?(擠|近|小)", r"不適合推車", r"推車進不去", r"沒地方放推車", r"偏擁擠", r"較擁擠"]
    },
    "kids_menu": {
        "Yes": [r"兒童餐", r"寶寶粥", r"小朋友餐", r"寶寶餐"],
        "No": [r"沒有兒童餐", r"沒兒童餐", r"無兒童餐", r"沒有寶寶粥", r"不提供兒童餐"]
    },
    "kid_noise_tolerant": {
        "Yes": [r"(?<!不)適合(帶)?小孩", r"親子友善", r"兒童友善", r"歡迎小孩", r"(?<!不)適合親子", r"對小孩友善", r"對孩子友善", r"小朋友友善", r"非常適合(帶)?小朋友", r"(?<!不)適合(家庭|全家|聚餐)", r"(?<!不)熱鬧", r"帶小孩也(很)?方便"],
        "No": [r"(?<!不)(很|滿|太)?安靜", r"氣氛店", r"謝絕小孩", r"不接待(小孩|小朋友)", r"不適合(帶)?(小孩|嬰兒|小朋友)", r"拒絕小孩", r"怕吵", r"輕聲細語"]
    }
}

def split_into_sentences(text):
    # Split on common punctuation marks
    sentences = re.split(r'[。！!？?，,；;\n]', text)
    return [s.strip() for s in sentences if s.strip()]

def evaluate_restaurant(data):
    reviews = data.get("reviews", [])
    all_sentences = []
    
    for r in reviews:
        text_obj = r.get("originalText") or r.get("text") or {}
        text = text_obj.get("text", "")
        if text:
            all_sentences.extend(split_into_sentences(text))
            
    analysis = {}
    all_signals = []
    
    for tag, patterns in PATTERNS.items():
        yes_sentences = []
        no_sentences = []
        
        for sentence in all_sentences:
            for pattern in patterns["Yes"]:
                if re.search(pattern, sentence):
                    yes_sentences.append(sentence)
                    break
            for pattern in patterns["No"]:
                if re.search(pattern, sentence):
                    no_sentences.append(sentence)
                    break
                    
        if len(yes_sentences) > 0 and len(no_sentences) == 0:
            result = "Yes"
        elif len(no_sentences) > 0 and len(yes_sentences) == 0:
            result = "No"
        elif len(yes_sentences) > 0 and len(no_sentences) > 0:
            result = "No" 
        else:
            result = "Unknown"
            
        evidence = []
        if yes_sentences:
            evidence.extend(yes_sentences)
        if no_sentences:
            evidence.extend(no_sentences)
            
        evidence = list(set(evidence))
        all_signals.extend(evidence)
        
        analysis[tag] = {
            "result": result,
            "evidence": evidence[0] if evidence else None,
            "confidence": 0.9 if result != "Unknown" else 0.4
        }
    
    all_signals = list(set(all_signals))
    
    # Generate ai_summary based on tags and signals
    positives = []
    negatives = []
    if analysis["high_chair_available"]["result"] == "Yes":
        positives.append("提供兒童椅")
    elif analysis["high_chair_available"]["result"] == "No":
        negatives.append("未提供兒童椅")
        
    if analysis["spacious_seating"]["result"] == "Yes":
        positives.append("空間寬敞")
    elif analysis["spacious_seating"]["result"] == "No":
        negatives.append("座位較擁擠/空間偏小")
        
    if analysis["kids_menu"]["result"] == "Yes":
        positives.append("有兒童餐點")
        
    if analysis["kid_noise_tolerant"]["result"] == "Yes":
        positives.append("對親子家庭友善")
    elif analysis["kid_noise_tolerant"]["result"] == "No":
        negatives.append("氣氛安靜/不適合帶小孩")
        
    if not positives and not negatives:
        summary = "目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。"
    else:
        parts = []
        if positives:
            parts.append("評論指出這家餐廳" + "、".join(positives))
        if negatives:
            parts.append("但需留意" + "、".join(negatives))
        summary = "，".join(parts) + "。"

    score = 0
    if analysis["high_chair_available"]["result"] == "Yes": score += 2
    if analysis["spacious_seating"]["result"] == "Yes": score += 1
    if analysis["kids_menu"]["result"] == "Yes": score += 1
    if analysis["kid_noise_tolerant"]["result"] == "Yes": score += 1
    
    if analysis["high_chair_available"]["result"] == "No" or analysis["spacious_seating"]["result"] == "No" or analysis["kid_noise_tolerant"]["result"] == "No":
        score -= 2
        
    if score >= 3:
        level = "高"
    elif score > 0:
        level = "中"
    else:
        level = "資訊不足"
        
    final_output = {
        " child_seat available": analysis["high_chair_available"],
        "Spacious seating": analysis["spacious_seating"],
        "Kids menu available": analysis["kids_menu"],
        "kid_noise_tolerant": analysis["kid_noise_tolerant"],
        "parent_friendly_score": score,
        "parent_friendly_level": level,
        "reason": "綜合評估",
        "generated_signals": all_signals,
        "generated_summary": summary
    }
    return final_output

def main():
    response_files = [f for f in os.listdir(response_dir) if f.endswith(".json")]
    print(f"Re-evaluating {len(response_files)} response files with strict logic...")
    
    count = 0
    for filename in response_files:
        filepath = os.path.join(response_dir, filename)
        output_path = os.path.join(output_dir, filename)
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            analysis = evaluate_restaurant(data)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(analysis, f, ensure_ascii=False, indent=4)
            count += 1
            
        except Exception as e:
            print(f"Error processing {filename}: {e}")
            
    print(f"Successfully re-evaluated {count} AI analysis files.")

if __name__ == "__main__":
    main()
