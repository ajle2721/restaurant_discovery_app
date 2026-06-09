import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_pattern = r'function patchAiSummary\(restaurant, summary\) \{'
end_pattern = r'return patched;\n\}'

# Find the entire function block using regex
match = re.search(r'function patchAiSummary\(restaurant, summary\) \{.*?return patched;\n\}', content, re.DOTALL)
if not match:
    print("Could not find patchAiSummary function!")
    exit(1)

print("Found function patchAiSummary!")

new_function = """function patchAiSummary(restaurant, summary) {
    if (!summary) return '';
    
    const hasHighChair = restaurant.attributes && restaurant.attributes.high_chair_available === 'yes';
    const hasTableware = restaurant.attributes && restaurant.attributes.has_tableware === 'yes';
    
    let patched = summary;
    
    if (hasHighChair || hasTableware) {
        // Define regex for two common unmentioned clause structures:
        // Structure 1: "目前評論中並未提及兒童座椅、餐具、尿布台或遊戲區等設施"
        const regex1 = /(目前|但)?評論中?(並|尚未)?(未提及|尚未提及|並未提及|較少提及|未特別提及)([a-zA-Z0-9\\\\u4e00-\\\\u9fa5、或及與／/]+?)(等(親子|具體|親子友善)?(設施|設備|資訊|服務))/g;
        
        // Structure 2: "但店內是否提供兒童椅、兒童餐具或尿布台等設施，評論中尚未提及。"
        const regex2 = /(是否提供)?([a-zA-Z0-9\\\\u4e00-\\\\u9fa5、或及與／/]+?)(等(親子|具體|親子友善)?(設施|設備|資訊|服務))，?評論中?(並|尚未)?(未及|未提及|尚未提及|並未提及|較少提及|未特別提及|尚未提及)/g;
        
        const replacer = (fullMatch, prefixOrOpt, midOrList, verbOrSuffix, listOrNone, suffixOrNone, optWordOrNone, verbOrNone) => {
            let listStr = "";
            if (verbOrSuffix && verbOrSuffix.includes('等')) {
                // regex2 matched: prefixOrOpt (是否提供), midOrList (listStr), verbOrSuffix (suffixStr)
                listStr = midOrList;
            } else {
                // regex1 matched: prefix, optWord, verb, listStr, suffixStr
                listStr = listOrNone;
            }
            
            if (!listStr) return fullMatch;
            
            const hasChairMention = /兒童椅|兒童座椅|座椅/.test(listStr);
            const hasTablewareMention = /兒童餐具|餐具/.test(listStr);
            const hasDiaperMention = /尿布台/.test(listStr);
            const hasPlayMention = /遊戲區|遊樂區|遊戲設施/.test(listStr);
            const hasKidsMenuMention = /兒童餐|專屬的兒童餐點|兒童餐點/.test(listStr);
            
            let remains = [];
            if (hasKidsMenuMention) remains.push('兒童餐');
            if (hasDiaperMention) remains.push('尿布台');
            if (hasPlayMention) remains.push('遊戲區');
            
            // Only keep what the restaurant doesn't officially have
            if (hasChairMention && !hasHighChair) remains.push('兒童椅');
            if (hasTablewareMention && !hasTableware) remains.push('兒童餐具');
            
            let shouldHave = '';
            if (hasHighChair && hasTableware && (hasChairMention || hasTablewareMention)) {
                shouldHave = '應備有兒童椅與兒童餐具';
            } else if (hasHighChair && hasChairMention) {
                shouldHave = '應備有兒童椅';
            } else if (hasTableware && hasTablewareMention) {
                shouldHave = '應備有兒童餐具';
            }
            
            if (!shouldHave) return fullMatch;
            
            const isKidsMenuNo = restaurant.attributes && restaurant.attributes.kids_menu === 'no';
            const saysNoKidsMenu = /不提供兒童餐|並不提供兒童餐|不提供專屬的兒童餐點|不提供專屬/.test(patched) || patched.includes('不提供專屬的兒童餐點') || patched.includes('不提供兒童餐點');
            
            if (isKidsMenuNo || saysNoKidsMenu) {
                remains = remains.filter(r => r !== '兒童餐');
                let remainsStr = '';
                if (remains.length > 0) {
                    remainsStr = `，且目前評論中未特別提及${remains.join('與')}等設施`;
                }
                return `${shouldHave}，但店家並未提供兒童餐${remainsStr}`;
            } else {
                let remainsStr = '';
                if (remains.length > 0) {
                    if (remains.length === 1) {
                        remainsStr = `，但目前評論中未特別提及${remains[0]}`;
                    } else {
                        const last = remains.pop();
                        remainsStr = `，但目前評論中未特別提及${remains.join('、')}與${last}等設施`;
                    }
                }
                return `${shouldHave}${remainsStr}`;
            }
        };
        
        // Execute replaces
        let beforeReplace = patched;
        patched = patched.replace(regex1, replacer);
        if (patched === beforeReplace) {
            patched = patched.replace(regex2, replacer);
        }
        
        // Cleanup duplicates/weird transitions
        patched = patched.replace(/不過[，]?店家(官方標記顯示|目前)?不提供兒童餐[，]?且/g, '');
        patched = patched.replace(/但餐廳並不提供兒童餐點。[目前]*?\\\\s*/g, '');
        patched = patched.replace(/且官方明確表示不提供兒童餐。[目前]*?\\\\s*/g, '');
        patched = patched.replace(/不過，店家明確標示不提供兒童餐，且/g, '');
        patched = patched.replace(/不過，店家目前不提供兒童餐，且/g, '');
        
        // Specific fallback checks
        if (patched.includes('目前評論中較少提及與親子用餐相關的具體資訊')) {
            const facilities = [];
            if (hasHighChair) facilities.push('兒童椅');
            if (hasTableware) facilities.push('兒童餐具');
            patched = patched.replace('目前評論中較少提及與親子用餐相關的具體資訊', `應備有\${facilities.join('與')}，但目前評論中較少提及相關細節`);
        }
    }
    
    return patched;
}"""

updated_content = content[:match.start()] + new_function + content[match.end():]

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(updated_content)

print("Successfully updated app.js!")
