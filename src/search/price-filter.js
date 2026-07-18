import { restaurantData } from "../data/restaurant-index.js";
import {
    getPriceSymbolForLevels,
    normalizePriceLevels,
    priceLevelOrder,
} from "../restaurants/pricing.js";

const brandPriceOverrides = {
    // New Overrides
    "雞湯桑": "PRICE_LEVEL_INEXPENSIVE",
    "Torisan": "PRICE_LEVEL_INEXPENSIVE",
    "筷炒": "PRICE_LEVEL_MODERATE",
    "KUAICHAO": "PRICE_LEVEL_MODERATE",
    "PappaRich": "PRICE_LEVEL_MODERATE",
    "PappaRich金爸爸": "PRICE_LEVEL_MODERATE",
    "SHANN SHANN": "PRICE_LEVEL_MODERATE",
    "小香": "PRICE_LEVEL_MODERATE",
    "URBAN PARADISE": "PRICE_LEVEL_EXPENSIVE",
    "鴨覓": "PRICE_LEVEL_EXPENSIVE",
    "嵩": "PRICE_LEVEL_EXPENSIVE",
    "sung": "PRICE_LEVEL_EXPENSIVE",
    
    // User requested unifications
    "TGI FRIDAYS": "PRICE_LEVEL_MODERATE",
    "TGI": "PRICE_LEVEL_MODERATE",
    "星期五美式餐廳": "PRICE_LEVEL_MODERATE",
    "金色三麥": "PRICE_LEVEL_MODERATE",
    "UMAMI": "PRICE_LEVEL_MODERATE",
    "HOOTERS美式餐廳": "PRICE_LEVEL_MODERATE",
    "HOOTERS": "PRICE_LEVEL_MODERATE",
    "波赫士領地精品咖啡館": "PRICE_LEVEL_MODERATE",
    "早吧": "PRICE_LEVEL_INEXPENSIVE",
    "Morning Bar": "PRICE_LEVEL_INEXPENSIVE",
    "渣男": "PRICE_LEVEL_MODERATE",
    "美術系壽司": "PRICE_LEVEL_MODERATE",
    
    // Latest requests
    "淪陷": "PRICE_LEVEL_MODERATE",
    "淪陷串酒社": "PRICE_LEVEL_MODERATE",
    "大衛小小羊": "PRICE_LEVEL_MODERATE",
    "阿緹卡": "PRICE_LEVEL_MODERATE",
    "朱里昂": "PRICE_LEVEL_MODERATE",
    "馬友友": "PRICE_LEVEL_MODERATE",
    "馬友友印度廚房": "PRICE_LEVEL_MODERATE",
    "The Quiet Light": "PRICE_LEVEL_INEXPENSIVE",
    "默光咖啡": "PRICE_LEVEL_INEXPENSIVE",
    "Cloud 9 Cafe": "PRICE_LEVEL_INEXPENSIVE",
    "Cloud 9": "PRICE_LEVEL_INEXPENSIVE",
    
    // 王品集團
    "王品": "PRICE_LEVEL_EXPENSIVE",
    "西堤": "PRICE_LEVEL_MODERATE",
    "陶板屋": "PRICE_LEVEL_MODERATE",
    "夏慕尼": "PRICE_LEVEL_EXPENSIVE",
    "原燒": "PRICE_LEVEL_MODERATE",
    "聚": "PRICE_LEVEL_MODERATE",
    "藝奇": "PRICE_LEVEL_MODERATE",
    "享鴨": "PRICE_LEVEL_MODERATE",
    "青花驕": "PRICE_LEVEL_EXPENSIVE",
    "莆田": "PRICE_LEVEL_MODERATE",
    "丰禾": "PRICE_LEVEL_MODERATE",
    "和牛涮": "PRICE_LEVEL_EXPENSIVE",
    "肉次方": "PRICE_LEVEL_MODERATE",
    "初瓦": "PRICE_LEVEL_MODERATE",
    "嚮辣": "PRICE_LEVEL_EXPENSIVE",
    // 饗賓餐旅
    "饗食天堂": "PRICE_LEVEL_EXPENSIVE",
    "饗饗": "PRICE_LEVEL_VERY_EXPENSIVE",
    "旭集": "PRICE_LEVEL_VERY_EXPENSIVE",
    "果然匯": "PRICE_LEVEL_MODERATE",
    "開飯": "PRICE_LEVEL_MODERATE",
    "開飯川食堂": "PRICE_LEVEL_MODERATE",
    "饗泰多": "PRICE_LEVEL_MODERATE",
    "真珠": "PRICE_LEVEL_MODERATE",
    "小福利": "PRICE_LEVEL_MODERATE",
    // 瓦城泰統
    "瓦城": "PRICE_LEVEL_MODERATE",
    "非常泰": "PRICE_LEVEL_MODERATE",
    "1010湘": "PRICE_LEVEL_MODERATE",
    "時時香": "PRICE_LEVEL_MODERATE",
    "YABI": "PRICE_LEVEL_MODERATE",
    "樂子": "PRICE_LEVEL_MODERATE",
    // 乾杯集團
    "乾杯": "PRICE_LEVEL_MODERATE",
    "老乾杯": "PRICE_LEVEL_EXPENSIVE",
    "黑毛屋": "PRICE_LEVEL_EXPENSIVE",
    "麻辣45": "PRICE_LEVEL_EXPENSIVE",
    // 馬辣集團
    "馬辣": "PRICE_LEVEL_EXPENSIVE",
    "新馬辣": "PRICE_LEVEL_EXPENSIVE",
    "問鼎": "PRICE_LEVEL_EXPENSIVE",
    "涮樂和牛": "PRICE_LEVEL_MODERATE",
    "狗一下": "PRICE_LEVEL_MODERATE",
    // 漢來集團
    "漢來": "PRICE_LEVEL_MODERATE",
    // 其他中高價名店
    "鼎泰豐": "PRICE_LEVEL_MODERATE",
    "點點心": "PRICE_LEVEL_MODERATE",
    "添好運": "PRICE_LEVEL_MODERATE",
    "高記": "PRICE_LEVEL_MODERATE",
    "春水堂": "PRICE_LEVEL_MODERATE",
    "貳樓": "PRICE_LEVEL_MODERATE",
    "樂雅樂": "PRICE_LEVEL_MODERATE",
    "Mo-Mo-Paradise": "PRICE_LEVEL_MODERATE",
    "壽司郎": "PRICE_LEVEL_MODERATE",
    "藏壽司": "PRICE_LEVEL_MODERATE",
    "欣葉": "PRICE_LEVEL_MODERATE",
    "一風堂": "PRICE_LEVEL_MODERATE",
    "屯京拉麵": "PRICE_LEVEL_MODERATE",
    "花月嵐": "PRICE_LEVEL_MODERATE",
    "大戶屋": "PRICE_LEVEL_MODERATE",
    "彌生軒": "PRICE_LEVEL_MODERATE",
    "YAYOI": "PRICE_LEVEL_MODERATE",
    "點爭鮮": "PRICE_LEVEL_MODERATE",
    "吉野家": "PRICE_LEVEL_INEXPENSIVE",
    "薩莉亞": "PRICE_LEVEL_INEXPENSIVE",
    "爭鮮": "PRICE_LEVEL_INEXPENSIVE",
    "定食8": "PRICE_LEVEL_INEXPENSIVE",
    "福勝亭": "PRICE_LEVEL_INEXPENSIVE",
    "三商巧福": "PRICE_LEVEL_INEXPENSIVE",
    "麥當勞": "PRICE_LEVEL_INEXPENSIVE",
    "摩斯": "PRICE_LEVEL_INEXPENSIVE",
    "摩斯漢堡": "PRICE_LEVEL_INEXPENSIVE",
    "肯德基": "PRICE_LEVEL_INEXPENSIVE",
    "SUBWAY": "PRICE_LEVEL_INEXPENSIVE",
    "稻舍": "PRICE_LEVEL_MODERATE",
    "稻舍食館": "PRICE_LEVEL_MODERATE",
    "Mini Club": "PRICE_LEVEL_MODERATE"
};

const brandPricesPropagated = {};
const overrideKeys = Object.keys(brandPriceOverrides).sort((a, b) => b.length - a.length);

function initBrandPricesPropagated() {
    if (typeof restaurantData === 'undefined' || !restaurantData) return;
    restaurantData.forEach(r => {
        if (r.price_level) {
            const brand = getBrandName(r.name);
            if (brand) {
                brandPricesPropagated[brand] = r.price_level;
            }
        }
    });
}

export function getBrandName(name) {
    if (!name) return "";
    let cleanName = name.trim();
    if (cleanName.toLowerCase().startsWith("the ")) {
        cleanName = cleanName.substring(4).trim();
    } else if (cleanName.toLowerCase().startsWith("a ")) {
        cleanName = cleanName.substring(2).trim();
    } else if (cleanName.toLowerCase().startsWith("an ")) {
        cleanName = cleanName.substring(3).trim();
    }
    
    const firstPart = cleanName.split(/\s+/)[0];
    if (firstPart) {
        return firstPart.split('-')[0].split('—')[0].split('~')[0].split('－')[0].split('–')[0];
    }
    return "";
}

export function inferPriceLevel(res) {
    const name = (res.name || '').trim();
    
    // 1. Check manual overrides (longest keys first)
    for (const key of overrideKeys) {
        if (name.includes(key)) {
            return brandPriceOverrides[key];
        }
    }

    const explicitPriceLevels = normalizePriceLevels(res.price_level);
    if (explicitPriceLevels.length > 0) return explicitPriceLevels[explicitPriceLevels.length - 1];
    
    // 2. Check propagated brand prices
    const brand = getBrandName(name);
    if (Object.keys(brandPricesPropagated).length === 0) {
        initBrandPricesPropagated();
    }
    if (brand && brandPricesPropagated[brand]) {
        return brandPricesPropagated[brand];
    }
    
    // 3. Keyword/cuisine-based inference
    const cuisine = (res.cuisine || '').toLowerCase();
    const summary = (res.card_summary || '').toLowerCase();
    const nameLower = name.toLowerCase();
    
    // Expensive keywords
    const expensiveKeywords = ["私廚", "無菜單", "預約制", "高級", "高檔", "頂級", "奢華", "餐酒館", "和牛", "板前", "bistronomy", "bistro", "fine dining", "omakase"];
    const isExpensive = expensiveKeywords.some(kw => nameLower.includes(kw) || cuisine.includes(kw) || summary.includes(kw));
    if (isExpensive) {
        return 'PRICE_LEVEL_EXPENSIVE';
    }

    // Moderate keywords (300 - 800)
    const moderateKeywords = [
        "咖啡", "下午茶", "義大利", "義大利麵", "披薩", "火鍋", "燒肉", "牛排", "鐵板燒",
        "義式", "韓式", "日式", "泰式", "美式", "早午餐", "西餐", 
        "歐式", "德式", "法式", "印式", "墨式", "地中海", "港式", "茶餐廳",
        "brunch", "cafe", "pasta", "pizza", "shabu", "hotpot", "steak", "bbq", "ramen"
    ];
    const isModerate = moderateKeywords.some(kw => nameLower.includes(kw) || cuisine.includes(kw) || summary.includes(kw));
    if (isModerate) {
        return 'PRICE_LEVEL_MODERATE';
    }

    // Inexpensive by default (under 300)
    return 'PRICE_LEVEL_INEXPENSIVE';
}

const dualPriceBrands = new Set([
    "雙月食品社",
    "雙月",
    "雞湯桑",
    "Torisan",
    "芝生食堂",
    "波赫士領地精品咖啡館",
    "波赫士領地",
    "安德烈廚房",
    "André Fine Food",
    "葉子異國小廚坊",
    "葉子異國",
    "大戶屋",
    "OOTOYA",
    "樂麵屋",
    "Rakumenya",
    "parco義大利麵",
    "大木屋",
    "松江8號廚房",
    "Labu cafe",
    "輕鬆餐廳",
    "Slipper Cafe 拖鞋咖啡",
    "優鮮主意",
    "荷蘭小鬆餅",
    "找午倉Brunch",
    "晴天廚房",
    "鳥玩義兒"
]);

const mediumHighPriceBrands = new Set([
    "TGI FRIDAYS",
    "TGI",
    "星期五美式餐廳",
    "金色三麥",
    "UMAMI",
    "HOOTERS美式餐廳",
    "HOOTERS",
    "海底撈"
]);

function isStrictlyHighEnd(res) {
    if (!res) return false;
    const name = res.name || '';
    
    // 1. If Google Maps explicitly rated it as Expensive/Very Expensive ($$$ or $$$$)
    const explicitPriceLevels = normalizePriceLevels(res.price_level);
    if (explicitPriceLevels.length > 0) {
        return explicitPriceLevels.every(level => level === 'PRICE_LEVEL_EXPENSIVE' || level === 'PRICE_LEVEL_VERY_EXPENSIVE');
    }
    
    // 2. Known premium high-end brands (Wang Prime, Sheraton, Grand Hyatt, Orange Shabu, etc.)
    const highEndKeywords = [
        "喜來登", "王品", "橘色", "夏慕尼", "嚮辣", "饗饗", "旭集", 
        "老乾杯", "黑毛屋", "麻辣45", "馬辣", "新馬辣", "問鼎", 
        "和牛涮", "青花驕", "饗食天堂", "寒舍艾美", "晶華", 
        "君悅", "美福", "六福", "故宮晶華", "凱達"
    ];
    
    return highEndKeywords.some(kw => name.includes(kw));
}

export function getPriceLevels(res) {
    const explicitLevels = normalizePriceLevels(res.price_level);
    const allowedGroups = new Set(explicitLevels.length > 0 ? explicitLevels : [inferPriceLevel(res)]);

    if (allowedGroups.has('PRICE_LEVEL_VERY_EXPENSIVE')) {
        allowedGroups.add('PRICE_LEVEL_EXPENSIVE');
    }

    const name = res.name || '';
    const isDual = Array.from(dualPriceBrands).some(brand => name.includes(brand));
    if (isDual) {
        allowedGroups.add('PRICE_LEVEL_INEXPENSIVE');
        allowedGroups.add('PRICE_LEVEL_MODERATE');
    }

    const inferredPrice = inferPriceLevel(res);
    const isMediumHighBrand = Array.from(mediumHighPriceBrands).some(brand => name.includes(brand));
    const isMediumHighInferred = (inferredPrice === 'PRICE_LEVEL_EXPENSIVE' || inferredPrice === 'PRICE_LEVEL_VERY_EXPENSIVE') && !isStrictlyHighEnd(res);
    if (isMediumHighBrand || isMediumHighInferred) {
        allowedGroups.add('PRICE_LEVEL_MODERATE');
        allowedGroups.add('PRICE_LEVEL_EXPENSIVE');
    }

    return priceLevelOrder.filter(level => allowedGroups.has(level));
}

export function getDisplayPriceLevels(res) {
    const explicitLevels = normalizePriceLevels(res.price_level);
    return explicitLevels.length > 0 ? explicitLevels : getPriceLevels(res);
}

export function getDisplayPriceSymbol(res) {
    return getPriceSymbolForLevels(getDisplayPriceLevels(res));
}

export function matchesPriceFilter(res, priceFilter) {
    if (!priceFilter || priceFilter.size === 0) return true;
    const allowedGroups = new Set(getPriceLevels(res));
    return Array.from(priceFilter).some(userPrice => allowedGroups.has(userPrice));
}

