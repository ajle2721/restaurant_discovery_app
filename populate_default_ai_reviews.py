import os
import json
import re
import sys
import builtins

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

# Extended keywords matching the AI prompts and behaviors
TAG_KEYWORDS = {
    "child_seat": {
        "Yes": ["兒童椅", "嬰兒椅", "餐椅", "兒童座椅", "嬰兒座椅", "提供餐椅", "有餐椅", "high chair", "baby chair", "booster seat"],
        "No": ["沒有兒童椅", "不提供兒童椅", "無兒童椅", "沒兒童餐椅", "沒嬰兒椅"]
    },
    "kids_menu": {
        "Yes": ["兒童餐", "小朋友餐", "寶寶餐", "寶寶粥", "kids menu"],
        "No": ["沒有兒童餐", "不提供兒童餐", "無兒童餐", "沒有提供兒童餐"]
    },
    "spacious_seating": {
        "Yes": ["空間大", "寬敞", "不擁擠", "適合推車", "放得下推車", "環境很舒服", "店內很舒服", "空間不擠", "寬闊"],
        "No": ["擁擠", "位置小", "位子小", "空間狹小", "不適合推車", "走道很窄", "位子擠", "位置擠", "空間很小", "很小一間"]
    },
    "noise_tolerant": {
        "Yes": ["親子友善", "帶小孩", "小孩開心", "適合小孩", "家庭客", "熱鬧", "吵鬧", "很多小孩", "吵雜"],
        "No": ["安靜", "氣氛店", "怕吵", "不適合帶小孩", "不適合小孩", "安靜的環境", "很安靜"]
    }
}

def analyze_reviews(reviews_text, name):
    results = {
        " child_seat available": {"result": "Unknown", "evidence": None, "confidence": 0.4},
        "Spacious seating": {"result": "Unknown", "evidence": None, "confidence": 0.4},
        "Kids menu available": {"result": "Unknown", "evidence": None, "confidence": 0.4},
        "kid_noise_tolerant": {"result": "Unknown", "evidence": None, "confidence": 0.4}
    }
    
    signals = []
    
    # Split text into simple sentences for evidence extraction
    sentences = re.split(r'[。！，；!?\n\r]', reviews_text)
    
    # Helper to check if a keyword in a sentence is preceded by a negation word
    def is_negated(sentence, keyword):
        idx = sentence.find(keyword)
        if idx == -1:
            return False
        # Look back up to 4 characters
        pre = sentence[max(0, idx-4):idx]
        negations = ["不", "沒有", "無", "未", "不太", "不會", "沒"]
        for neg in negations:
            if neg in pre:
                return True
        return False

    # Helper to find a complete sentence with keyword, checking for negations
    def find_evidence(keywords_list, check_negation=False):
        for s in sentences:
            s_clean = s.strip()
            if not s_clean:
                continue
            for kw in keywords_list:
                if kw in s_clean:
                    if check_negation and is_negated(s_clean, kw):
                        continue  # Skip if negated
                    return s_clean
        return None

    # 1. Child Seat
    evidence_yes = find_evidence(TAG_KEYWORDS["child_seat"]["Yes"], check_negation=True)
    evidence_no = find_evidence(TAG_KEYWORDS["child_seat"]["No"])
    if evidence_yes:
        results[" child_seat available"] = {"result": "Yes", "evidence": evidence_yes, "confidence": 0.8}
        signals.append(evidence_yes)
    elif evidence_no:
        results[" child_seat available"] = {"result": "No", "evidence": evidence_no, "confidence": 0.8}
        signals.append(evidence_no)

    # 2. Spacious Seating
    evidence_yes = find_evidence(TAG_KEYWORDS["spacious_seating"]["Yes"], check_negation=True)
    evidence_no = find_evidence(TAG_KEYWORDS["spacious_seating"]["No"])
    if evidence_yes:
        results["Spacious seating"] = {"result": "Yes", "evidence": evidence_yes, "confidence": 0.8}
        signals.append(evidence_yes)
    elif evidence_no:
        results["Spacious seating"] = {"result": "No", "evidence": evidence_no, "confidence": 0.8}
        signals.append(evidence_no)

    # 3. Kids Menu
    evidence_yes = find_evidence(TAG_KEYWORDS["kids_menu"]["Yes"], check_negation=True)
    evidence_no = find_evidence(TAG_KEYWORDS["kids_menu"]["No"])
    if evidence_yes:
        results["Kids menu available"] = {"result": "Yes", "evidence": evidence_yes, "confidence": 0.8}
        signals.append(evidence_yes)
    elif evidence_no:
        results["Kids menu available"] = {"result": "No", "evidence": evidence_no, "confidence": 0.8}
        signals.append(evidence_no)

    # 4. Noise Tolerant
    evidence_yes = find_evidence(TAG_KEYWORDS["noise_tolerant"]["Yes"], check_negation=True)
    evidence_no = find_evidence(TAG_KEYWORDS["noise_tolerant"]["No"])
    if evidence_yes:
        results["kid_noise_tolerant"] = {"result": "Yes", "evidence": evidence_yes, "confidence": 0.8}
        signals.append(evidence_yes)
    elif evidence_no:
        results["kid_noise_tolerant"] = {"result": "No", "evidence": evidence_no, "confidence": 0.8}
        signals.append(evidence_no)

    # Calculate score & level
    score = 0
    if results[" child_seat available"]["result"] == "Yes": score += 2
    if results["Spacious seating"]["result"] == "Yes": score += 1
    if results["Kids menu available"]["result"] == "Yes": score += 1
    if results["kid_noise_tolerant"]["result"] == "Yes": score += 1
    
    if (results[" child_seat available"]["result"] == "No" or 
        results["Spacious seating"]["result"] == "No" or 
        results["kid_noise_tolerant"]["result"] == "No"):
        score -= 2
        
    if score >= 3:
        level = "高"
    elif score > 0:
        level = "中"
    else:
        level = "資訊不足"
        
    # Generate summary based on detected attributes
    summary_parts = []
    if results[" child_seat available"]["result"] == "Yes":
        summary_parts.append("有提供兒童座椅")
    if results["Spacious seating"]["result"] == "Yes":
        summary_parts.append("用餐空間寬敞舒服")
    elif results["Spacious seating"]["result"] == "No":
        summary_parts.append("但空間較為擁擠")
        
    if results["Kids menu available"]["result"] == "Yes":
        summary_parts.append("並有提供兒童餐點")
        
    if results["kid_noise_tolerant"]["result"] == "Yes":
        summary_parts.append("環境氣氛適合帶小孩用餐，親子友善")
    elif results["kid_noise_tolerant"]["result"] == "No":
        summary_parts.append("但環境較安靜，可能不太適合好動吵鬧的小孩")

    if summary_parts:
        summary_text = f"根據評論分析，這家餐廳{', '.join(summary_parts)}。"
    else:
        summary_text = "目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。"

    results["parent_friendly_score"] = score
    results["parent_friendly_level"] = level
    results["reason"] = "離線關鍵字快速評估"
    results["generated_signals"] = signals
    results["generated_summary"] = summary_text

    return results

def main():
    print("[SYSTEM] Taipei Kid-Friendly Restaurant Offline AI Review Populator")
    print("=========================================================")

    response_files = [f for f in os.listdir(response_dir) if f.endswith(".json")]
    print(f"[DATA] Scanning {len(response_files)} response profiles...")

    skipped_count = 0
    created_count = 0

    for filename in response_files:
        place_id = os.path.splitext(filename)[0]
        output_path = os.path.join(output_dir, f"{place_id}.json")

        # Overwrite only if it is a newly populated file from this session
        if os.path.exists(output_path):
            try:
                with open(output_path, 'r', encoding='utf-8') as check_f:
                    check_data = json.load(check_f)
                if check_data.get("reason") != "離線關鍵字快速評估":
                    skipped_count += 1
                    continue
            except Exception:
                skipped_count += 1
                continue

        filepath = os.path.join(response_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            name = data.get("displayName", {}).get("text", "Unknown")
            reviews = data.get("reviews", [])
            
            reviews_text = ""
            for i, r in enumerate(reviews, 1):
                text_obj = r.get("originalText") or r.get("text") or {}
                text = text_obj.get("text", "")
                if text:
                    reviews_text += f"{text}\n"

            # Execute rapid evaluation
            analysis = analyze_reviews(reviews_text, name)

            # Write standard json file
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(analysis, f, ensure_ascii=False, indent=4)
                
            created_count += 1
            if created_count % 100 == 0:
                print(f"  [PROGRESS] Processed {created_count} new offline analysis profiles...")

        except Exception as e:
            print(f"  [ERROR] processing {filename}: {e}")

    print("=========================================================")
    print(f"[SUCCESS] Offline Review Population Completed.")
    print(f"  - Existing original reviews kept: {skipped_count}")
    print(f"  - Newly populated default/offline analysis: {created_count}")
    print(f"  - Total analysis files now in 'ai_review/': {skipped_count + created_count}")

if __name__ == "__main__":
    main()
