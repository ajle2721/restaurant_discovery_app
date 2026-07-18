import { isPositiveAttributeValue } from "./attributes.js";

export function getCardDistrict(address, district) {
    if (district) return district;
    const cleanAddr = fixSimplifiedAddress(address || '');
    const match = cleanAddr.match(/(?:[\u53f0\u81fa]\u5317\u5e02)?([\u4e00-\u9fff]{1,4}\u5340)/);
    return match ? match[1] : '';
}

export function formatStreetAddressForCard(addressText, district) {
    if (!addressText) return '';
    let text = String(addressText).trim();
    if (district && text.startsWith(district)) {
        text = text.slice(district.length).trim();
    }
    return text;
}

export function formatAddressForCard(address, district) {
    if (!address) return '';
    const cleanAddr = fixSimplifiedAddress(address);
    const prefixRegex1 = /^\d{3}[\u53f0\u81fa]\u7063[\u81fa\u53f0]\u5317\u5e02/;
    const prefixRegex2 = /^[\u53f0\u81fa]\u7063[\u81fa\u53f0]\u5317\u5e02/;
    const prefixRegex3 = /^[\u81fa\u53f0]\u5317\u5e02/;
    let shortAddr = cleanAddr.replace(prefixRegex1, '')
                             .replace(prefixRegex2, '')
                             .replace(prefixRegex3, '')
                             .trim();
    if (district) {
        if (shortAddr.startsWith(district)) {
            return shortAddr;
        }
        const idx = shortAddr.indexOf(district);
        if (idx >= 0 && idx < 12) {
            return shortAddr.substring(idx);
        }
        return `${district} ${shortAddr}`;
    }
    return shortAddr;
}
export function fixSimplifiedAddress(addr) {
    if (!addr) return '';
    
    const charMap = {
        '东': '東',
        '义': '義',
        '万': '萬',
        '区': '區',
        '号': '號',
        '楼': '樓',
        '湾': '灣',
        '台': '臺',
        '国': '國',
        '学': '學',
        '发': '發',
        '电': '電',
        '复': '復',
        '关': '關',
        '园': '園',
        '龙': '龍',
        '兴': '興',
        '庄': '莊',
        '丰': '豐',
        '双': '雙',
        '华': '華',
        '临': '臨',
        '庆': '慶',
        '宝': '寶',
        '宁': '寧',
        '辽': '遼',
        '阳': '陽',
        '桥': '橋',
        '铁': '鐵',
        '营': '營',
        '头': '頭',
        '观': '觀',
        '门': '門',
        '乐': '樂',
        '艺': '藝',
        '爱': '愛',
        '广': '廣',
        '苏': '蘇',
        '芦': '蘆',
        '温': '溫',
        '叶': '葉',
        '荣': '榮',
        '卫': '衛',
        '丽': '麗',
        '罗': '羅',
        '恒': '恆',
        '馆': '館',
        '栋': '棟',
        '柜': '櫃',
        '县': '縣',
        '镇': '鎮',
        '乡': '鄉',
        '经': '經',
        '贸': '貿',
        '农': '農',
        '剑': '劍',
        '仑': '崙'
    };
    
    let result = '';
    for (let i = 0; i < addr.length; i++) {
        const char = addr[i];
        result += charMap[char] || char;
    }
    return result;
}


export function formatRestaurantName(name) {
    if (!name) return '';
    // Split by parenthesized parts, or delimiters (space, dash, colon, slash, pipe)
    const parts = name.split(/([\(\[【（].*?[\)\]】）]|[ \-－—:：\/／\|｜])/g).filter(p => p !== '');
    
    return parts.map(part => {
        if (/^[ \-－—:：\/／\|｜]$/.test(part)) return part;
        if (/^[\(\[【（].*?[\)\]】）]$/.test(part)) {
            return `<span class="no-wrap">${part}</span>`;
        }
        if (part.length > 0 && part.length <= 12) {
            return `<span class="no-wrap">${part}</span>`;
        }
        return part;
    }).join('<wbr>');
}

function neutralizeSummarySourceCopy(summary, privateRoomVal) {
    if (!summary) return '';
    let s = String(summary);
    if (s.includes('可包廂')) {
        let replacement = '有包廂或可包場';
        if (privateRoomVal === 'room' || privateRoomVal === 'likely_room') {
            replacement = '有包廂';
        } else if (privateRoomVal === 'venue' || privateRoomVal === 'likely_venue') {
            replacement = '可包場';
        }
        s = s.replace(/可包廂/g, replacement);
    }
    return s
        .replace(/Google Maps\s*官方標記/g, '公開地點資訊標示')
        .replace(/Google Maps\s*官方標記/g, '公開地點資訊標示')
        .replace(/Google Maps\s*標記/g, '公開地點資訊標示')
        .replace(/Google\s*Maps/g, '公開地點資訊')
        .replace(/Google\s*官方/g, '公開地點資訊')
        .replace(/Google/g, '公開地點資訊')
        .replace(/官方明確標示/g, '店家資訊顯示')
        .replace(/官方明確表示/g, '店家資訊顯示')
        .replace(/官方明確/g, '目前資料明確')
        .replace(/官方標記/g, '公開地點資訊標示')
        .replace(/官方標示/g, '公開地點資訊標示')
        .replace(/官方資訊/g, '公開地點資訊')
        .replace(/官方/g, '店家資訊')
        .replace(/根據評論分析/g, '根據目前整理資料')
        .replace(/根據評論/g, '根據目前整理資料')
        .replace(/AI根據公開評論整理/g, '根據目前整理資料產生，僅供參考')
        .replace(/AI 根據公開評論整理/g, '根據目前整理資料產生，僅供參考')
        .replace(/公開評論整理/g, '目前整理資料')
        .replace(/公開評論/g, '目前整理資料')
        .replace(/顧客評論/g, '顧客回饋')
        .replace(/評論資訊/g, '顧客回饋')
        .replace(/評論多集中/g, '目前整理資料多集中')
        .replace(/評論反映/g, '目前整理資料顯示')
        .replace(/有評論指出/g, '目前整理資料指出')
        .replace(/評論指出/g, '目前整理資料指出')
        .replace(/有評論提到/g, '目前整理資料提到')
        .replace(/有評論提及/g, '目前整理資料提及')
        .replace(/評論提到/g, '目前整理資料提到')
        .replace(/評論提及/g, '目前整理資料提及')
        .replace(/評論中目前未提及/g, '目前整理資料中未提及')
        .replace(/目前評論中較少提及/g, '目前整理資料較少提及')
        .replace(/目前評論中未提及/g, '目前整理資料中未提及')
        .replace(/目前評論中/g, '目前整理資料中')
        .replace(/評論中也未提及/g, '目前整理資料中也未提及')
        .replace(/評論中並未提及/g, '目前整理資料中未提及')
        .replace(/評論中尚未提及/g, '目前整理資料中尚未提及')
        .replace(/評論中未有明確提及/g, '目前整理資料尚未明確提及')
        .replace(/評論中未明確提及/g, '目前整理資料尚未明確提及')
        .replace(/評論中沒有提及/g, '目前整理資料中未提及')
        .replace(/評論中也提到/g, '目前整理資料也提到')
        .replace(/評論中提及/g, '目前整理資料提及')
        .replace(/評論中未提及/g, '目前整理資料中未提及')
        .replace(/評論中/g, '目前整理資料中')
        .replace(/評論未提及/g, '目前整理資料未提及')
        .replace(/評論顯示/g, '目前整理資料顯示')
        .replace(/有顧客評論提到/g, '目前整理資料提到')
        .replace(/顧客評論提到/g, '目前整理資料提到')
        .replace(/評論/g, '目前整理資料');
}

function sanitizeNoiseConflictSummary(summary, attributes = {}) {
    if (!summary || !isPositiveAttributeValue(attributes.kid_noise_tolerant)) return summary || '';

    const quietConflictPattern = /環境[^。！？!?]*(?:安靜|靜謐|靜靜聊天)|(?:安靜|靜謐|靜靜聊天|較安靜|偏安靜)[^。！？!?]*(?:帶小孩|孩童|孩子|幼童|好動|吵鬧|留意|不適合)|帶(?:好動)?小孩用餐時可能需要多加留意|帶小孩用餐時可能需要多加留意|不適合較吵鬧的孩童|可能不適合較吵鬧/;
    return String(summary)
        .replace(/\s+/g, ' ')
        .match(/[^。！？!?]+[。！？!?]?/g)
        ?.map(sentence => sentence.trim())
        .filter(sentence => sentence && !quietConflictPattern.test(sentence))
        .join('') || '';
}

function splitSummarySentences(summary) {
    const matches = String(summary || '').replace(/\s+/g, ' ').match(/[^。！？!?]+[。！？!?]?/g);
    return (matches || []).map(s => s.trim()).filter(Boolean);
}

function normalizeSummarySentence(sentence) {
    return String(sentence || '')
        .replace(/^[，、。；;\s]+/, '')
        .replace(/^(此外|另外|同時|並且|而且|整體來說|總體而言)[，,、\s]*/, '')
        .replace(/^(根據|依據)?目前整理資料(產生，僅供參考|顯示|指出|提到|提及|中)?[，,、\s]*/g, '')
        .replace(/^資料(顯示|指出|提到|提及)[，,、\s]*/g, '')
        .replace(/建議(出發|前往)前向店家確認。?/g, '')
        .replace(/建議(出發|前往)前先向店家確認。?/g, '')
        .replace(/目前尚未取得明確設備資訊，?/g, '')
        .replace(/（標示為「估」）/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isLikelyAttributeValue(value) {
    return value === 'likely' || value === 'likely_room' || value === 'likely_venue';
}

function getPrivateRoomSummaryLabel(value) {
    if (value === 'room') return '有包廂';
    if (value === 'venue') return '可包場';
    if (value === 'yes') return '有包廂或可包場';
    if (value === 'likely_room') return '可能有包廂';
    if (value === 'likely_venue') return '可包場（推估）';
    if (value === 'likely') return '可能有包廂或可包場';
    return '';
}

function joinChineseList(items) {
    const unique = [];
    const seen = new Set();
    items.forEach(item => {
        if (!item || seen.has(item)) return;
        seen.add(item);
        unique.push(item);
    });
    return unique.join('、');
}

function getPositiveFamilyFacilities(attrs) {
    const items = [];
    const add = (key, label) => {
        if (isPositiveAttributeValue(attrs[key])) {
            items.push(label + (isLikelyAttributeValue(attrs[key]) ? '（推估）' : ''));
        }
    };

    add('high_chair_available', '兒童椅');
    add('has_tableware', '兒童餐具');
    add('kids_menu', '兒童餐');
    add('has_diaper_table', '尿布台');
    add('has_play_area', '遊樂區');
    add('spacious_seating', '座位較寬敞');
    add('kid_noise_tolerant', '環境對孩子聲音較包容');

    const roomLabel = getPrivateRoomSummaryLabel(attrs.has_private_room);
    if (roomLabel) items.push(roomLabel);

    return items;
}

function getRestaurantTypeSummaryLabel(restaurant = {}) {
    const cuisine = String(restaurant.cuisine || restaurant.major_cuisine || '').trim();
    if (!cuisine) return '餐廳';

    const labels = {
        '咖啡廳': '咖啡廳',
        '早午餐': '早午餐店',
        '烘焙/甜點': '甜點店',
        '火鍋': '火鍋店',
        '披薩': '披薩店',
        '壽司': '壽司店',
        '拉麵': '拉麵店',
        '牛排館': '牛排館',
        '小酒館/餐酒館': '餐酒館'
    };
    if (labels[cuisine]) return labels[cuisine];
    if (/料理$/.test(cuisine)) return `${cuisine}餐廳`;
    return `${cuisine}餐廳`;
}

function getFallbackFamilySummaryIntro(restaurant = {}) {
    return `這間${getRestaurantTypeSummaryLabel(restaurant)}`;
}

function getFamilyCautions(attrs) {
    const cautions = [];
    if (attrs.high_chair_available === 'no') cautions.push('未提供兒童椅');
    if (attrs.has_tableware === 'no') cautions.push('未提供兒童餐具');
    if (attrs.has_diaper_table === 'no') cautions.push('無尿布台');
    if (attrs.has_play_area === 'no') cautions.push('無遊樂區');
    if (attrs.spacious_seating === 'no') cautions.push('座位較為緊密');
    if (attrs.has_private_room === 'no') cautions.push('無包廂或包場資訊');
    return cautions;
}

function facilityIsAlreadyMentioned(text, key) {
    if (!text) return false;
    const positiveText = splitSummarySentences(text)
        .filter(sentence => !/未提及|較少提及|尚未明確提及|沒有提及|並未提及/.test(sentence))
        .join('');
    const patterns = {
        high_chair_available: /兒童(座|餐|專用)?椅|高腳椅|寶寶椅/,
        has_tableware: /兒童餐具|專用(碗盤|餐具)|碗盤餐具/,
        kids_menu: /兒童餐|兒童菜單|孩子.*餐點/,
        has_diaper_table: /尿布台|哺乳室|親子廁所/,
        has_play_area: /遊樂|玩具|遊戲|遊戲區|遊樂桌|裝扮|拍照區/,
        spacious_seating: /寬敞|挑高|空間舒適|座位較寬/,
        kid_noise_tolerant: /不怕吵|不怕小孩吵|不怕小孩聲音|吵鬧.*包容|孩子聲音.*包容|氣氛歡樂|氣氛對孩子較友善|熱鬧|對孩子.*吸引力/,
        has_private_room: /包廂|包場|慶生|抓週|活動服務/
    };
    return patterns[key]?.test(positiveText) || false;
}

function getUnmentionedFamilyFacilities(attrs, sourceText) {
    const items = [];
    const add = (key, label) => {
        if (isPositiveAttributeValue(attrs[key]) && !facilityIsAlreadyMentioned(sourceText, key)) {
            items.push(label + (isLikelyAttributeValue(attrs[key]) ? '（推估）' : ''));
        }
    };

    add('high_chair_available', '提供兒童椅');
    add('has_tableware', '備有兒童餐具');
    add('kids_menu', '提供兒童餐');
    add('has_diaper_table', '設有尿布台');
    add('has_play_area', '設有遊樂區');
    add('spacious_seating', '座位較寬敞');
    add('kid_noise_tolerant', '環境對孩子聲音較包容');

    const roomLabel = getPrivateRoomSummaryLabel(attrs.has_private_room);
    if (roomLabel && !facilityIsAlreadyMentioned(sourceText, 'has_private_room')) items.push(roomLabel);

    return items;
}

function getSummarySourceText(summary, restaurant) {
    const attrs = restaurant?.attributes || {};
    return sanitizeNoiseConflictSummary(neutralizeSummarySourceCopy(summary || '', attrs.has_private_room), attrs);
}

function isSpecificRestaurantHighlight(clause) {
    return /玩具|遊樂桌|遊樂區|遊戲|圍裙|裝扮|拍照|慶生|生日|抓週|包場活動|活動服務|天然食材|新鮮|食材|餐點|烹調|口味|服務|挑高|寬敞|包廂|包場|家庭聚餐|吵鬧|包容|熱鬧/.test(clause);
}

function hasConcreteFamilyInfo(sentence) {
    return /兒童(座)?椅|高腳椅|寶寶椅|兒童餐具|專用(碗盤|餐具)|碗盤餐具|兒童餐|尿布台|哺乳室|遊樂|玩具|遊戲|包廂|包場|慶生|抓週|不怕吵|吵鬧.*包容/.test(sentence);
}

function cleanupHighlightSentence(sentence) {
    return sentence
        .replace(/該餐廳/g, '店內')
        .replace(/這家餐廳/g, '店內')
        .replace(/^[^，。]*被標記為親子友善餐廳，?/, '')
        .replace(/^[^，。]*雖然?被標記為適合兒童，但/, '')
        .replace(/^[^，。]*被標記為適合兒童，?且?/, '')
        .replace(/，?並被標記為適合兒童[^，。]*/g, '')
        .replace(/，?且被標記為適合兒童[^，。]*/g, '')
        .replace(/，?環境氛圍被標記為適合兒童/g, '')
        .replace(/，?且明確不提供兒童餐/g, '')
        .replace(/且適合親子前往/g, '')
        .replace(/適合親子前往/g, '')
        .replace(/店內以([^，。]+)，店內空間/g, '店內以$1，空間')
        .replace(/提供兒童座椅/g, '提供兒童椅')
        .replace(/店內提供可使用商場附設之尿布台|店內提供可使用商場附設尿布台|可使用商場附設之尿布台|可使用商場附設尿布台/g, '可就近使用商場內尿布台')
        .replace(/店內提供可就近使用商場內尿布台|這家餐廳提供可就近使用商場內尿布台|提供可就近使用商場內尿布台/g, '可就近使用商場內尿布台')
        .replace(/環境氣氛適合帶小孩/g, '氣氛對孩子較友善')
        .replace(/環境氣氛適合帶孩子/g, '氣氛對孩子較友善')
        .replace(/環境氣氛適合兒童/g, '氣氛對孩子較友善')
        .replace(/設有包廂/g, '有包廂')
        .replace(/舒適的獨立包廂空間/g, '獨立包廂空間')
        .replace(/，?(非常|特別|極其|特別|十分|相當)?適合家庭聚餐/g, '')
        .replace(/，?(常|非常|特別|極其|特別|十分|相當)?適合帶(孩子|小孩|兒童).*$/g, '')
        .replace(/座位較(為)?緊密/g, '')
        .replace(/^[，、。；;\s]+|[，、；;\s]+$/g, '')
        .trim()
        .replace(/，?(但|且|並|而|不過|而且|並且|但是)$/g, '')
        .replace(/^[，、。；;\s]+|[，、；;\s]+$/g, '')
        .trim();
}

function extractDistinctiveSummaryParts(summary, restaurant, maxParts = 2) {
    const source = getSummarySourceText(summary, restaurant);
    const rawSentences = splitSummarySentences(source);
    const selected = [];
    const seenKeys = new Set();

    rawSentences.forEach(rawSentence => {
        let sentence = normalizeSummarySentence(rawSentence).replace(/[。！？!?]+$/, '');
        if (!sentence) return;
        const compactRestaurantName = String(restaurant?.name || '').replace(/[\s!！.．・･。！？?-–—_＿（）()「」『』【】[]]/g, '').toLowerCase();
        const compactSentence = sentence.replace(/[\s!！.．・･。！？?-–—_＿（）()「」『』【】[]]/g, '').toLowerCase();
        if (compactSentence && compactRestaurantName.startsWith(compactSentence) && compactSentence.length <= 8) return;
        if (/Google|Maps|評論|公開地點資訊|店家資訊|目前資料/.test(sentence)) return;
        if (/僅供參考|系統推估|目前尚未取得明確設備資訊/.test(sentence)) return;
        if (/未提及|較少提及|尚未明確提及|資訊較有限|無相關親子設施資訊|目前尚無摘要資訊|目前親子友善資訊較有限|尚無摘要資訊|無摘要|建議.*(確認|考量|留意)/.test(sentence)) return;
        if (/座位較(為)?緊密.*適合帶/.test(sentence)) {
            sentence = sentence.replace(/座位較(為)?緊密，?適合帶(孩子|小孩|兒童).*$/, '');
        }
        if (/親子友善|適合兒童|適合帶/.test(sentence) && !isSpecificRestaurantHighlight(sentence) && !hasConcreteFamilyInfo(sentence)) return;

        sentence = cleanupHighlightSentence(sentence);
        if (!sentence || sentence.length < 6) return;

        const key = sentence.replace(/[，。、！？!?；;（）()「」\s]/g, '');
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        selected.push(sentence);
    });

    return selected.slice(0, maxParts);
}

function compactSummaryText(summary, restaurant, options = {}) {
    const attrs = restaurant?.attributes || {};
    const maxChars = options.maxChars || 160;
    const source = getSummarySourceText(summary, restaurant);
    let cautions = getFamilyCautions(attrs);
    if (/未提供兒童椅|無兒童椅|沒有兒童椅|不提供兒童椅|未設.*兒童椅/.test(source)) {
        cautions = cautions.filter(caution => caution !== '未提供兒童椅');
    }
    if (/座位(配置)?較(為)?緊密/.test(source)) {
        cautions = cautions.filter(caution => caution !== '座位較為緊密');
    }
    if (/空間較小|空間較為狹小|座位有限|不適合推車/.test(source)) {
        cautions = cautions.filter(caution => caution !== '座位較為緊密');
    }
    if (/沒有遊樂區|無遊樂區|未設有兒童遊戲區/.test(source)) {
        cautions = cautions.filter(caution => caution !== '無遊樂區');
    }
    if (/無尿布台|沒有尿布台|未設.*尿布台/.test(source)) {
        cautions = cautions.filter(caution => caution !== '無尿布台');
    }
    const distinctiveParts = extractDistinctiveSummaryParts(summary, restaurant, 4);
    const highlightText = distinctiveParts.join('。');
    const unmentionedFacilities = getUnmentionedFamilyFacilities(attrs, highlightText);
    const sentences = [];

    if (distinctiveParts.length > 0) {
        sentences.push(`${distinctiveParts.join('。')}。`);
    } else if (unmentionedFacilities.length > 0) {
        sentences.push(`${getFallbackFamilySummaryIntro(restaurant)}${joinChineseList(unmentionedFacilities)}。`);
        unmentionedFacilities.length = 0;
    } else if (getPositiveFamilyFacilities(attrs).length === 0) {
        sentences.push('目前整理資料未看到明確的親子友善設備。');
    }

    if (unmentionedFacilities.length > 0) {
        const onlyNoiseSupplement = unmentionedFacilities.length === 1 && /^環境/.test(unmentionedFacilities[0]);
        const prefix = sentences.length > 0 && !onlyNoiseSupplement ? '另外' : '';
        sentences.push(`${prefix}${joinChineseList(unmentionedFacilities)}。`);
    }

    if (cautions.length > 0) {
        sentences.push(`需留意${joinChineseList(cautions)}。`);
    }

    let compact = sentences.join('');
    if (compact.length > maxChars) {
        const required = sentences[0] || '';
        compact = required;
        sentences.slice(1).forEach(sentence => {
            if ((compact + sentence).length <= maxChars) {
                compact += sentence;
            }
        });
        if (compact.length > maxChars) compact = compact.slice(0, maxChars).replace(/[，、；;][^，、；;]*$/, '') + '。';
    }

    return compact
        .replace(/座位較為緊密，?適合帶(孩子|小孩|兒童).*?。/g, '座位較為緊密。')
        .replace(/座位較緊密，?適合帶(孩子|小孩|兒童).*?。/g, '座位較為緊密。')
        .replace(/需留意環境偏安靜。?/g, '')
        .replace(/Google|Maps|評論/g, '')
        .replace(/^(不過|但是|然而|此外|另外|而且|因此|並|且|但)[，\s]*/, '')
        .trim();
}


const EXACT_SUMMARY_PLACE_IDS = new Set([
    'ChIJVSlgImqtQjQRbQdqBcuQMuo',
    'ChIJLfHPyr2rQjQRSM3hOuLzSKg',
    'manual-david-alpaca',
    'ChIJg-VN6l-tQjQRRxat9_Vo0hk',
    'manual-antica-pizza-yangmingshan',
    'manual-julien-camping-restaurant',
    'ChIJMQTebJqrQjQR3p3Zb5ewRsk',
    'ChIJb61nBQmrQjQRSzjQlYaN8_Y',
    'ChIJxZuN7UurQjQRgYLtdVB27N4',
    'ChIJjRHspSCrQjQRrNW8m8IhrTA',
    'ChIJeZnryQ-pQjQRNnLc5C4JK8s',
    'ChIJieKHJvurQjQRV0sWxBYJhfI',
    'manual-new-great-gobi-ximen',
    'manual-skylark-heping-park',
    'manual-skylark-donghu-kangning',
    'ChIJ2VWqSkKuQjQRuQkg3lsruls',
    'manual-lunxian-skewers-bar',
    'manual-nice-to-meet-u-newborn-cafe'
]);

export function patchAiSummary(restaurant, summary, options = {}) {
    if (EXACT_SUMMARY_PLACE_IDS.has(restaurant?.place_id)) {
        return summary || '';
    }
    const patched = compactSummaryText(summary || '', restaurant, {
        ...options,
        maxChars: options.maxChars || 160
    });

    if (options.maxSentences) {
        return splitSummarySentences(patched).slice(0, options.maxSentences).join('');
    }

    return patched;
}

export function getDisplaySummary(restaurant, summary, options = {}) {
    return patchAiSummary(restaurant, summary || '', options) || '目前整理資料未看到明確的親子友善設備。';
}
