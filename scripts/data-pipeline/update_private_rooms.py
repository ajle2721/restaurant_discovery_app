import os
import json
import re

base_dir = os.getcwd()
response_dir = os.path.join(base_dir, "response")
ai_review_dir = os.path.join(base_dir, "data", "ai_review")

# Positive patterns to detect private rooms or venue booking
POS_PATTERNS = [
    r"有包廂", r"獨立包廂", r"包廂很", r"包廂(內|裡|外)", r"小包廂", r"大包廂", r"包廂空間", 
    r"包廂低消", r"預訂包廂", r"訂包廂", r"個室", r"獨立空間", r"獨立區域", r"包房",
    r"可以包場", r"提供包場", r"有包場", r"適合包場", r"包場辦", r"包場聚", r"包場活動"
]

# Negation patterns to exclude
NEG_PATTERNS = [
    r"(沒有|無|未提供|不提供|不設|沒)包廂", r"無提供包廂", r"不設包廂",
    r"(沒有|無|未提供|不提供|不開放|不設|沒)包場", r"不能包場", r"無法包場"
]

def split_into_sentences(text):
    sentences = re.split(r'[。！!？?，,；;\n\r]', text)
    return [s.strip() for s in sentences if s.strip()]

def main():
    print("Scanning reviews to detect private rooms and booking capabilities...")
    
    if not os.path.exists(response_dir) or not os.path.exists(ai_review_dir):
        print("Error: response or ai_review directory does not exist.")
        return

    response_files = [f for f in os.listdir(response_dir) if f.endswith(".json")]
    
    updated_count = 0
    
    for filename in response_files:
        place_id = os.path.splitext(filename)[0]
        resp_path = os.path.join(response_dir, filename)
        ai_path = os.path.join(ai_review_dir, f"{place_id}.json")
        
        if not os.path.exists(ai_path):
            continue
            
        with open(resp_path, "r", encoding="utf-8") as f:
            resp_data = json.load(f)
            
        with open(ai_path, "r", encoding="utf-8") as f:
            content = f.read()
            if content.startswith('\ufeff'):
                content = content[1:]
            ai_data = json.loads(content)
            
        # Check if already Yes with some manual reason/evidence
        has_private = ai_data.get("has_private_room", {})
        if has_private.get("result") == "Yes" and has_private.get("evidence"):
            # Keep manual/existing yes
            continue
            
        reviews = resp_data.get("reviews", [])
        found_pos_evidence = None
        has_negation = False
        
        for r in reviews:
            text_obj = r.get("originalText") or r.get("text") or {}
            text = text_obj.get("text", "")
            if not text:
                continue
                
            sentences = split_into_sentences(text)
            for s in sentences:
                # Check for negations first
                neg_match = False
                for pattern in NEG_PATTERNS:
                    if re.search(pattern, s):
                        neg_match = True
                        break
                if neg_match:
                    has_negation = True
                    continue
                    
                # Check for positive matches
                for pattern in POS_PATTERNS:
                    if re.search(pattern, s):
                        found_pos_evidence = s
                        break
                if found_pos_evidence:
                    break
            if found_pos_evidence:
                break
                
        # If we found positive evidence and no strong negative indicator in the same context
        if found_pos_evidence and not has_negation:
            ai_data["has_private_room"] = {
                "result": "Yes",
                "evidence": found_pos_evidence,
                "confidence": 0.9
            }
            
            with open(ai_path, "w", encoding="utf-8") as f:
                json.dump(ai_data, f, ensure_ascii=False, indent=4)
            updated_count += 1
            
    print(f"Done! Updated {updated_count} restaurants with 'Yes' for private rooms.")

if __name__ == "__main__":
    main()
