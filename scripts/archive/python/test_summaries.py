import json
import os
import re

def patch_ai_summary(attrs, summary):
    if not summary: return ""

    has_high_chair = attrs.get('high_chair_available') == 'yes'
    has_tableware = attrs.get('has_tableware') == 'yes'
    kids_menu = attrs.get('kids_menu')
    is_kids_menu_no = (kids_menu == 'no')

    patched = summary
    
    regex1 = re.compile(r'((?:不過|但|且|另外|此外|其實)?\s*(?:，|,|、)?\s*(?:需注意|值得注意(?:的是)?|注意)?\s*(?:，|,|、)?\s*(?:currently|目前)?)\s*(?:顧客)?(?:評論中|店內)?(?:並|尚未)?(未提及|尚未提及|並未提及|較少提及|未特別提及|未及|未提到|較少提及|未多提及)\s*([a-zA-Z0-9\u4e00-\u9fa5、或及與／/]+?)\s*(等[\u4e00-\u9fa5]{0,15}(?:設施|設備|資訊|服務|設備需求|環境|細節|功能|資訊)(?:[\u3002\uff0c\u002c\u002e\s])?)')
    
    def replacer1(m):
        prefix = m.group(1) or ""
        verb = m.group(2) or ""
        listStr = m.group(3) or ""
        suffix = m.group(4) or ""
        
        has_chair_mention = bool(re.search(r'兒童椅|兒童座椅|座椅', listStr))
        has_tableware_mention = bool(re.search(r'兒童餐具|餐具', listStr))
        has_diaper_mention = bool(re.search(r'尿布台', listStr))
        has_play_mention = bool(re.search(r'遊戲區|遊樂區|遊戲設施', listStr))
        has_kids_menu_mention = bool(re.search(r'兒童餐|兒童餐點|專屬的兒童餐點', listStr))

        remains = []
        if not is_kids_menu_no and has_kids_menu_mention: remains.append('兒童餐')
        if has_diaper_mention: remains.append('尿布台')
        if has_play_mention: remains.append('遊戲區')
        if has_chair_mention and not has_high_chair: remains.append('兒童椅')
        if has_tableware_mention and not has_tableware: remains.append('兒童餐具')

        shouldHave = ''
        if has_high_chair and has_tableware and (has_chair_mention or has_tableware_mention):
            shouldHave = '應備有兒童椅與兒童餐具'
        elif has_high_chair and has_chair_mention:
            shouldHave = '應備有兒童椅'
        elif has_tableware and has_tableware_mention:
            shouldHave = '應備有兒童餐具'

        if not shouldHave: return m.group(0)

        endPunc = ''
        if re.search(r'[\u3002\uff0c\u002c\u002e\s]$', suffix):
            endPunc = suffix[-1]
            if endPunc.strip() == '': endPunc = '。'
        else:
            endPunc = '。'

        if is_kids_menu_no:
            remainsStr = ''
            if remains:
                remainsStr = f"，且目前評論中未特別提及{'與'.join(remains)}等設施"
            return f"{shouldHave}，但店家並未提供兒童餐{remainsStr}{endPunc}"
        else:
            remainsStr = ''
            if remains:
                remainsStr = f"，但目前評論中未特別提及{'與'.join(remains)}等設施"
            return f"{shouldHave}{remainsStr}{endPunc}"

    patched = regex1.sub(replacer1, patched)
    return patched

issues = []
ai_review_dir = 'ai_review'
response_dir = 'response'

if os.path.exists(ai_review_dir):
    for filename in os.listdir(ai_review_dir):
        if not filename.endswith('.json'): continue
        try:
            with open(os.path.join(ai_review_dir, filename), 'r', encoding='utf-8') as f:
                review = json.load(f)
            attrs = {}
            if os.path.exists(os.path.join(response_dir, filename)):
                with open(os.path.join(response_dir, filename), 'r', encoding='utf-8') as f:
                    place_data = json.load(f)
                    attrs = place_data.get('attributes', {})
            
            orig_summary = review.get('summary', '')
            patched = patch_ai_summary(attrs, orig_summary)
            
            if patched != orig_summary and '應備有' in patched:
                if re.search(r'(?:不過|但|且|然而|需注意|值得注意的是?|另外|此外)(?:，|,|、)?\s*應備有', patched):
                    issues.append((filename, patched))
        except Exception as e:
            pass

print(f"Found {len(issues)} issues.")
for f, t in issues:
    print(f"{f}:\n{t}\n")