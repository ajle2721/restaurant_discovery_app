import os
import json
import re

response_dir = "response"
ai_review_dir = "ai_review"

CHAIR_KEYWORDS = [
    "嬰兒椅", "兒童椅", "兒童餐椅", "幼兒座椅", "小孩椅子", "寶寶椅", 
    "小孩椅", "兒童用椅", "幼兒椅", "小孩餐椅", "嬰兒餐椅", "high chair", 
    "兒童座椅", "兒童坐椅", "嬰兒座椅", "寶寶餐椅", "提供餐椅", "備有餐椅", "有餐椅"
]

NEGATIVE_WORDS = [
    "沒有", "沒提供", "無提供", "未提供", "不提供", "沒看到", "自備", "沒有附", "缺", "不足"
]

def analyze_child_seat(reviews_text):
    if not reviews_text:
        return {"result": "UNKNOWN", "evidence": None, "confidence": 0.4}

    # Split text into sentences using common punctuation marks
    sentences = re.split(r'[。！，；？\n\r~]', reviews_text)
    
    found_yes = False
    found_no = False
    evidence_yes = None
    evidence_no = None

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        sentence_lower = sentence.lower()
        
        # Check if any chair keyword is in the sentence
        has_chair_keyword = any(kw in sentence_lower for kw in CHAIR_KEYWORDS)
        
        if has_chair_keyword:
            # Check for negative words in the SAME sentence
            has_negative = any(neg in sentence_lower for neg in NEGATIVE_WORDS)
            
            # Additional check: sometimes people say "沒有嬰兒椅"
            # If the sentence contains "沒有" before "兒童椅", it's a strong NO.
            if has_negative:
                found_no = True
                if not evidence_no:
                    evidence_no = sentence
            else:
                found_yes = True
                if not evidence_yes:
                    evidence_yes = sentence

    if found_no:
        # If any sentence explicitly says NO, we prioritize it (e.g. "沒有嬰兒椅")
        return {"result": "NO", "evidence": evidence_no, "confidence": 0.9}
    elif found_yes:
        # If yes and no explicit NO
        return {"result": "YES", "evidence": evidence_yes, "confidence": 0.9}
    else:
        return {"result": "UNKNOWN", "evidence": None, "confidence": 0.4}

def main():
    if not os.path.exists(response_dir) or not os.path.exists(ai_review_dir):
        print("Error: response or ai_review directory not found.")
        return

    response_files = [f for f in os.listdir(response_dir) if f.endswith(".json")]
    print(f"Processing {len(response_files)} files...")
    
    count_yes = 0
    count_no = 0
    count_unknown = 0
    count_updated = 0
    
    for filename in response_files:
        resp_path = os.path.join(response_dir, filename)
        ai_path = os.path.join(ai_review_dir, filename)
        
        # Only process if the ai_review file already exists
        if not os.path.exists(ai_path):
            continue
            
        try:
            with open(resp_path, 'r', encoding='utf-8') as f:
                resp_data = json.load(f)
            
            reviews = resp_data.get("reviews", [])
            reviews_text = " ".join([r.get("text", {}).get("text", "") for r in reviews if r.get("text")])
            if not reviews_text:
                # Some objects store it directly or differently, fallback
                reviews_text = " ".join([r.get("originalText", {}).get("text", "") for r in reviews if r.get("originalText")])
                
            analysis = analyze_child_seat(reviews_text)
            
            if analysis["result"] == "YES": count_yes += 1
            elif analysis["result"] == "NO": count_no += 1
            else: count_unknown += 1

            # Update ai_review JSON
            with open(ai_path, 'r', encoding='utf-8') as f:
                ai_data = json.load(f)
                
            # Remove old keys
            keys_to_remove = [k for k in ai_data.keys() if "high" in k.lower() and "chair" in k.lower()]
            for k in keys_to_remove:
                del ai_data[k]
                
            # Insert the new key EXACTLY as user requested
            ai_data[" child_seat available"] = analysis
            
            with open(ai_path, 'w', encoding='utf-8') as f:
                json.dump(ai_data, f, ensure_ascii=False, indent=4)
                
            count_updated += 1
                
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    print(f"\nSuccessfully updated {count_updated} ai_review files.")
    print(f"Results summary -> YES: {count_yes}, NO: {count_no}, UNKNOWN: {count_unknown}")

if __name__ == "__main__":
    main()
