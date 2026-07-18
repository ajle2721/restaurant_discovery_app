import os
import json
import re

response_dir = "response"
output_dir = "ai_review"
os.makedirs(output_dir, exist_ok=True)

# Extended keywords for child-friendly detection
TAG_KEYWORDS = {
    "high_chair_available": {
        "Yes": ["嬰兒椅", "兒童椅", "提供餐椅", "有餐椅", "小椅子", "提供椅"],
        "No": [] # Hard to prove "No" from text alone unless they say "沒有嬰兒椅"
    },
    "kids_menu": {
        "Yes": ["兒童餐", "小朋友餐", "寶寶粥", "小份量餐"],
        "No": []
    },
    "spacious_seating": {
        "Yes": ["寬敞", "大空間", "不擁擠", "適合推車", "放得下推車", "空間大"],
        "No": ["擁擠", "位置小", "位子小", "空間狹小", "不適合推車"]
    },
    "kid_noise_tolerant": {
        "Yes": ["友善", "包容", "不介意小孩", "常見家庭", "熱鬧"],
        "No": ["安靜", "很靜", "氣氛店", "不適合吵雜", "破壞氣氛"]
    }
}

def analyze_reviews(reviews_text, restaurant_name):
    analysis = {}
    
    for tag, keywords in TAG_KEYWORDS.items():
        result = "Unknown"
        evidence = None
        
        # Check for positive signals
        for kw in keywords["Yes"]:
            if kw in reviews_text:
                result = "Yes"
                # Find the sentence containing the keyword
                sentences = re.split(r'[。！，\n\s]', reviews_text)
                for s in sentences:
                    if kw in s:
                        evidence = s.strip()
                        break
                break
        
        # Check for negative signals if Still Unknown or specifically for space/noise
        if result == "Unknown" and keywords["No"]:
            for kw in keywords["No"]:
                if kw in reviews_text:
                    result = "No"
                    sentences = re.split(r'[。！，\n\s]', reviews_text)
                    for s in sentences:
                        if kw in s:
                            evidence = s.strip()
                            break
                    break
        
        analysis[tag] = {"result": result, "evidence": evidence, "confidence": 0.8 if result != "Unknown" else 0.4}
    
    # Map to the specific keys requested (note: some keys in user's prompt were capitalized)
    final_output = {
        "High chair available": analysis["high_chair_available"],
        "Stroller accessible": analysis["spacious_seating"], # Using space as proxy for stroller
        "Spacious seating": analysis["spacious_seating"],
        "Kids menu available": analysis["kids_menu"],
        "kid_noise_tolerant": analysis["kid_noise_tolerant"]
    }
    return final_output

def main():
    response_files = [f for f in os.listdir(response_dir) if f.endswith(".json")]
    print(f"Processing {len(response_files)} response files...")
    
    count = 0
    for filename in response_files:
        filepath = os.path.join(response_dir, filename)
        output_path = os.path.join(output_dir, filename)
        
        # Skip if already exists (don't overwrite original 61)
        if os.path.exists(output_path):
            continue
            
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            name = data.get("displayName", {}).get("text", "Unknown")
            reviews = data.get("reviews", [])
            reviews_text = " ".join([r.get("text", {}).get("text", "") for r in reviews])
            
            analysis = analyze_reviews(reviews_text, name)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(analysis, f, ensure_ascii=False, indent=4)
            count += 1
            
        except Exception as e:
            print(f"Error processing {filename}: {e}")
            
    print(f"Successfully generated {count} AI analysis files.")

if __name__ == "__main__":
    main()
