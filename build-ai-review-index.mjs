import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const baseDir = process.cwd();
const aiReviewDir = path.join(baseDir, "ai_review");
const outputPath = path.join(aiReviewDir, "index.js");

const cuisinesMappingPath = path.join(aiReviewDir, "cuisines_mapping.json");
let cuisinesMapping = {};
if (fs.existsSync(cuisinesMappingPath)) {
  try {
    cuisinesMapping = JSON.parse(fs.readFileSync(cuisinesMappingPath, "utf8"));
  } catch (err) {
    console.error("Error loading cuisines_mapping.json:", err.message);
  }
}

const temporarilyHiddenPlaceIds = new Set([
  "ChIJH_WVdGWpQjQRunfMO1rsZiU", // 舒啡•序 RelaxCafeChic, temporarily closed
]);

temporarilyHiddenPlaceIds.add("ChIJXUuOM7mrQjQRUTsJAPEerr0"); // Micky House Brunch, closed

const columns = [
  "place_id",
  "name",
  "address",
  "district",
  "price_level",
  "cuisine",
  "latitude",
  "longitude",
  "url",
  "attributes",
  "ai_summary",
  "card_summary",
  "parent_friendly_level",
  "cuisine_group",
];

const manualRecords = [
  [
    "manual-jinguobei-hotpot-neihu",
    "金鍋盃小火鍋",
    "11452臺北市內湖區港華里環山路二段37號",
    "內湖區",
    "PRICE_LEVEL_MODERATE",
    "火鍋",
    25.0856,
    121.5677,
    "https://www.google.com/maps/search/?api=1&query=%E9%87%91%E9%8D%8B%E7%9B%83%E5%B0%8F%E7%81%AB%E9%8D%8B%2011452%E8%87%BA%E5%8C%97%E5%B8%82%E5%85%A7%E6%B9%96%E5%8D%80%E6%B8%AF%E8%8F%AF%E9%87%8C%E7%92%B0%E5%B1%B1%E8%B7%AF%E4%BA%8C%E6%AE%B537%E8%99%9F",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "room",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "以平價、大份量與頂級海鮮與肉盤聞名的寵物友善火鍋店（大型犬可落地）。店家看到有小孩會主動詢問是否需要兒童椅和兒童餐具，空間挑高且寬敞，桌距適中不擁擠。環境適合聊天，亦有包廂可供多人聚餐。",
    "平價大份量的寵物友善火鍋店，店家會主動詢問兒童椅與兒童餐具需求；空間挑高寬敞、桌距舒適，也有包廂適合多人聚餐。",
    "高",
  ],
];

manualRecords.push([
  "manual-nice-to-meet-u-newborn-cafe",
  "NICE to MEET U newborn & café 寶寶友善咖啡廳（預約制）",
  "111臺北市士林區天福里忠誠路二段166巷28弄1號",
  "士林區",
  null,
  "咖啡廳",
  25.11643,
  121.53262,
  "https://www.google.com/maps/search/?api=1&query=NICE%20to%20MEET%20U%20newborn%20%26%20caf%C3%A9%20%E5%AF%B6%E5%AF%B6%E5%8F%8B%E5%96%84%E5%92%96%E5%95%A1%E5%BB%B3%20111%E8%87%BA%E5%8C%97%E5%B8%82%E5%A3%AB%E6%9E%97%E5%8D%80%E5%A4%A9%E7%A6%8F%E9%87%8C%E5%BF%A0%E8%AA%A0%E8%B7%AF%E4%BA%8C%E6%AE%B5166%E5%B7%B728%E5%BC%841%E8%99%9F",
  {
    high_chair_available: "yes",
    kids_menu: "yes",
    spacious_seating: "unknown",
    kid_noise_tolerant: "yes",
    has_play_area: "yes",
    has_private_room: "unknown",
    has_tableware: "yes",
    has_diaper_table: "yes",
  },
  "為親子家庭特別設計的咖啡廳，除了兒童椅/寶寶椅、兒童餐具、各年齡層的寶寶副食品外，也提供消毒鍋、兒童床和有質感的遊樂區，店內也有親子廁所（設有尿布台），特別適合帶寶寶前往。",
  "為親子家庭特別設計的寶寶友善咖啡廳，備有兒童椅、兒童餐具、寶寶副食品、消毒鍋、兒童床、遊樂區與設有尿布台的親子廁所。",
  "高",
]);

manualRecords.push(
  [
    "manual-little-tree-food-daan",
    "小小樹食 大安店",
    "台北市大安區大安路一段116巷17號",
    "大安區",
    "PRICE_LEVEL_MODERATE",
    "蔬食料理",
    25.04088,
    121.54614,
    "https://www.google.com/maps/search/?api=1&query=%E5%B0%8F%E5%B0%8F%E6%A8%B9%E9%A3%9F%20%E5%A4%A7%E5%AE%89%E5%BA%97%20%E5%8F%B0%E5%8C%97%E5%B8%82%E5%A4%A7%E5%AE%89%E5%8D%80%E5%A4%A7%E5%AE%89%E8%B7%AF%E4%B8%80%E6%AE%B5116%E5%B7%B717%E8%99%9F",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "大安店位於大安路巷弄內，是小小樹食的台北蔬食餐廳據點之一，主打精緻蔬食料理、佛陀碗、主食與甜點等選擇。店內適合家庭聚餐，具備兒童椅、兒童餐具，座位空間相對寬敞，環境對孩子聲音較包容。",
    "大安路巷弄內的精緻蔬食餐廳，適合家庭聚餐；具備兒童椅、兒童餐具，空間相對寬敞且不怕吵。",
    "高",
  ],
  [
    "manual-little-tree-food-dunnan",
    "小小樹食 敦南店",
    "台北市大安區敦化南路二段39-1號",
    "大安區",
    "PRICE_LEVEL_MODERATE",
    "蔬食料理",
    25.03189,
    121.54863,
    "https://www.google.com/maps/search/?api=1&query=%E5%B0%8F%E5%B0%8F%E6%A8%B9%E9%A3%9F%20%E6%95%A6%E5%8D%97%E5%BA%97%20%E5%8F%B0%E5%8C%97%E5%B8%82%E5%A4%A7%E5%AE%89%E5%8D%80%E6%95%A6%E5%8C%96%E5%8D%97%E8%B7%AF%E4%BA%8C%E6%AE%B539-1%E8%99%9F",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "敦南店位於敦化南路二段，延續小小樹食以蔬食料理、沙拉、佛陀碗、主食與甜點為主的餐飲風格。店內具備兒童椅、兒童餐具，空間寬敞，氣氛適合家庭用餐，對孩子聲音較包容。",
    "敦化南路上的蔬食餐廳，具備兒童椅、兒童餐具，空間寬敞且不怕吵，適合親子家庭聚餐。",
    "高",
  ],
  [
    "manual-little-tree-food-noke",
    "小小樹食 忠泰店 NOKE",
    "台北市中山區樂群三路200號4樓",
    "中山區",
    "PRICE_LEVEL_MODERATE",
    "蔬食料理",
    25.08265,
    121.55752,
    "https://www.google.com/maps/search/?api=1&query=%E5%B0%8F%E5%B0%8F%E6%A8%B9%E9%A3%9F%20%E5%BF%A0%E6%B3%B0%E5%BA%97%20NOKE%20%E5%8F%B0%E5%8C%97%E5%B8%82%E4%B8%AD%E5%B1%B1%E5%8D%80%E6%A8%82%E7%BE%A4%E4%B8%89%E8%B7%AF200%E8%99%9F4%E6%A8%93",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "忠泰店位於 NOKE 忠泰樂生活 4 樓，商場環境新穎，適合安排逛街與用餐行程。餐點以精緻蔬食料理為主，店內具備兒童椅、兒童餐具，座位空間寬敞，商場型用餐氛圍對孩子聲音較包容。",
    "位於 NOKE 忠泰樂生活的商場型蔬食餐廳，具備兒童椅、兒童餐具，空間寬敞且不怕吵。",
    "高",
  ],
  [
    "manual-little-tree-food-diamond-towers",
    "小小樹食 Diamond Towers 店",
    "台北市大安區忠孝東路三段268號4樓",
    "大安區",
    "PRICE_LEVEL_MODERATE",
    "蔬食料理",
    25.04155,
    121.54372,
    "https://www.google.com/maps/search/?api=1&query=%E5%B0%8F%E5%B0%8F%E6%A8%B9%E9%A3%9F%20Diamond%20Towers%20%E5%8F%B0%E5%8C%97%E5%B8%82%E5%A4%A7%E5%AE%89%E5%8D%80%E5%BF%A0%E5%AD%9D%E6%9D%B1%E8%B7%AF%E4%B8%89%E6%AE%B5268%E8%99%9F4%E6%A8%93",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "Diamond Towers 店位於忠孝東路三段的 Diamond Towers 一館 4 樓，交通便利，適合親子家庭安排東區用餐。餐點延續小小樹食的精緻蔬食風格，具備兒童椅、兒童餐具，空間寬敞，對孩子聲音較包容。",
    "位於 Diamond Towers 的精緻蔬食餐廳，交通便利；具備兒童椅、兒童餐具，空間寬敞且不怕吵。",
    "高",
  ],
  [
    "manual-little-tree-food-0km",
    "小小樹食 0km 山物所",
    "台北市大安區金山南路二段203巷34號",
    "大安區",
    "PRICE_LEVEL_MODERATE",
    "蔬食料理",
    25.02613,
    121.52695,
    "https://www.google.com/maps/search/?api=1&query=%E5%B0%8F%E5%B0%8F%E6%A8%B9%E9%A3%9F%200km%20%E5%B1%B1%E7%89%A9%E6%89%80%20%E5%8F%B0%E5%8C%97%E5%B8%82%E5%A4%A7%E5%AE%89%E5%8D%80%E9%87%91%E5%B1%B1%E5%8D%97%E8%B7%AF%E4%BA%8C%E6%AE%B5203%E5%B7%B734%E8%99%9F",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "0km 山物所位於金山南路二段巷弄，營業時段偏日間，也有週末晚餐時段。店名與山物所場域相呼應，餐點以蔬食、早午餐與輕食感料理為主，具備兒童椅、兒童餐具，空間寬敞，環境對孩子聲音較包容。",
    "金山南路巷弄內的山物所蔬食據點，偏日間用餐；具備兒童椅、兒童餐具，空間寬敞且不怕吵。",
    "高",
  ],
  [
    "manual-little-tree-food-breeze-nanshan",
    "小小樹食 微風南山店",
    "台北市信義區松智路17號6樓",
    "信義區",
    "PRICE_LEVEL_MODERATE",
    "蔬食料理",
    25.034,
    121.56649,
    "https://www.google.com/maps/search/?api=1&query=%E5%B0%8F%E5%B0%8F%E6%A8%B9%E9%A3%9F%20%E5%BE%AE%E9%A2%A8%E5%8D%97%E5%B1%B1%E5%BA%97%20%E5%8F%B0%E5%8C%97%E5%B8%82%E4%BF%A1%E7%BE%A9%E5%8D%80%E6%9D%BE%E6%99%BA%E8%B7%AF17%E8%99%9F6%E6%A8%93",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "微風南山店位於信義區松智路 17 號 6 樓，鄰近台北 101 與信義商圈，適合親子家庭搭配商場行程用餐。店內提供精緻蔬食料理，具備兒童椅、兒童餐具，空間寬敞，商場用餐氛圍對孩子聲音較包容。",
    "位於微風南山 6 樓的信義商圈蔬食餐廳，具備兒童椅、兒童餐具，空間寬敞且不怕吵。",
    "高",
  ],
);

manualRecords.push([
  "manual-mwd-dazhi-zhifu",
  "麥味登 大直植福店",
  "台北市中山區北安路608巷5弄7號",
  "中山區",
  "PRICE_LEVEL_INEXPENSIVE",
  "早午餐",
  25.082042,
  121.549705,
  "https://www.google.com/maps/search/?api=1&query=%E9%BA%A5%E5%91%B3%E7%99%BB%20%E5%A4%A7%E7%9B%B4%E6%A4%8D%E7%A6%8F%E5%BA%97",
  {
    high_chair_available: "yes",
    kids_menu: "no",
    spacious_seating: "unknown",
    kid_noise_tolerant: "yes",
    has_play_area: "unknown",
    has_private_room: "unknown",
    has_tableware: "yes",
    has_diaper_table: "unknown",
  },
  "提供兒童椅與兒童餐具，店內更貼心備有拼圖供小朋友玩耍，是家長帶孩子用餐的優質早午餐選擇。",
  "提供兒童椅、兒童餐具，並備有拼圖供小孩玩耍的親子友善早午餐店。",
  "高",
]);

const brandRulesPath = path.join(baseDir, "brand_rules.json");
let brandRules = {};
if (fs.existsSync(brandRulesPath)) {
  try {
    brandRules = JSON.parse(fs.readFileSync(brandRulesPath, "utf8"));
  } catch (err) {
    console.error("Error loading brand_rules.json:", err.message);
  }
}

function isInShoppingMall(name, address) {
  const mallKeywords = [
    "百貨", "商場", "廣場", "購物中心", "誠品", "SOGO", "微風", 
    "新光三越", "遠東", "FE21", "統一時代", "京站", "美麗華", 
    "BELLAVITA", "ATT 4 FUN", "三創", "CITYLINK", "LALAPORT", 
    "大葉高島屋", "明曜", "NOKE", "環球購物", "GLOBAL MALL",
    "大樓", "地下街"
  ];
  const nameUpper = String(name || "").toUpperCase();
  const addressUpper = String(address || "").toUpperCase();
  return mallKeywords.some(kw => nameUpper.includes(kw) || addressUpper.includes(kw));
}

function cleanBrandName(name) {
  if (!name) return "";
  let cleaned = name.replace(/([\(（\[【])(.*?)([\)）\]】])/g, '');
  const branchPatterns = [
    /\s*\(.*?店\)$/i, /\s*（.*?店）$/i, /\s*\[.*?店\]$/i, /\s*【.*?店】$/i,
    /\s+臺?北\w*店$/i, /\s*\w+店$/i, /\s*\w+分店$/i, /\s*-\s*\w+店$/i, /\s*-\w+店$/i,
    /\s+旗旗店$/i, /\s+門市$/i, /\s*\w+門市$/i, /\s*\w+館$/i, /\s+臺?北\w*館$/i
  ];
  for (const pattern of branchPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(/[\/／\|｜~～].*$/, '');
  return cleaned.trim();
}

function isPositiveAttributeValue(value) {
  return value === "yes" || value === "likely";
}

function sanitizeSourceMarkerSummary(summary) {
  if (!summary) return "";

  const cleanupSentence = (sentence) => String(sentence || "")
    .replace(/^根據公開地點資訊(?:的資訊)?標示[，,]?/, "")
    .replace(/^根據公開地點資訊(?:的資訊)?[，,]?/, "")
    .replace(/^店內(?:在)?公開地點資訊標示(?:中)?(?:顯示|為)?[^，。！？!?]*適合兒童(?:的友善空間)?[，,但]*/, "")
    .replace(/^本餐廳被公開地點資訊標示為適合兒童[，,但]*/, "")
    .replace(/^該餐廳經公開地點資訊標示為適合兒童[，,但]*/, "")
    .replace(/^雖然公開地點資訊標示適合兒童[，,但]*/, "")
    .replace(/^雖然 公開地點資訊標示該餐廳適合兒童[，,但]*/, "")
    .replace(/^雖然 Google Maps 標記該店適合兒童[，,但]*/, "")
    .replace(/^店內雖然被標記為適合兒童[，,但]*/, "")
    .replace(/^該店被標記為適合兒童[，,但]*/, "")
    .replace(/^該餐廳被(?:歸類|標記)為適合兒童[，,但]*/, "")
    .replace(/^這家餐廳適合兒童用餐[，,但]*/, "")
    .replace(/^這家餐廳適合兒童[，,但]*/, "")
    .replace(/^此餐廳適合兒童[，,但]*/, "")
    .replace(/^適合兒童用餐[，,但]*/, "")
    .replace(/^適合兒童[，,但]*/, "")
    .replace(/^(?:但|且|並|，|,)+/, "")
    .trim();

  const sourceMarkerPattern = /公開地點資訊|被標記|被歸類|標示.*適合兒童|標記.*適合兒童|Google|Maps|官方/;
  return String(summary)
    .replace(/\s+/g, " ")
    .match(/[^。！？!?]+[。！？!?]?/g)
    ?.map((sentence) => cleanupSentence(sentence))
    .filter((sentence) => sentence && !sourceMarkerPattern.test(sentence))
    .join("") || "";
}
function sanitizeNoiseConflictSummary(summary, attributes = {}) {
  if (!summary || !isPositiveAttributeValue(attributes.kid_noise_tolerant)) return summary || "";

  const quietConflictPattern = /環境[^。！？!?]*(?:安靜|靜謐|靜靜聊天)|(?:安靜|靜謐|靜靜聊天|較安靜|偏安靜)[^。！？!?]*(?:帶小孩|孩童|孩子|幼童|好動|吵鬧|留意|不適合)|帶(?:好動)?小孩用餐時可能需要多加留意|帶小孩用餐時可能需要多加留意|不適合較吵鬧的孩童|可能不適合較吵鬧/;
  return String(summary)
    .replace(/\s+/g, " ")
    .match(/[^。！？!?]+[。！？!?]?/g)
    ?.map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !quietConflictPattern.test(sentence))
    .join("") || "";
}

function sanitizeUnavailableFamilyFacilitySummary(summary, attributes = {}) {
  if (!summary) return "";

  const unavailablePatterns = [];
  if (!isPositiveAttributeValue(attributes.high_chair_available)) {
    unavailablePatterns.push(/兒童椅|兒童座椅|寶寶椅|高腳椅/);
  }
  if (!isPositiveAttributeValue(attributes.has_tableware)) {
    unavailablePatterns.push(/兒童餐具|專用餐具|專用碗盤|碗盤餐具|兒童碗|兒童餐盤/);
  }
  if (unavailablePatterns.length === 0) return summary;

  return String(summary)
    .replace(/\s+/g, " ")
    .match(/[^。！？!?]+[。！？!?]?/g)
    ?.map((sentence) => sentence.trim())
    .filter((sentence) => !unavailablePatterns.some((pattern) => pattern.test(sentence)))
    .join("") || "";
}
function joinChineseList(items) {
  const unique = [];
  const seen = new Set();
  items.forEach((item) => {
    if (!item || seen.has(item)) return;
    seen.add(item);
    unique.push(item);
  });
  return unique.join('、');
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

function getPositiveFamilyFacilityLabels(attributes = {}) {
  const items = [];
  const add = (key, label) => {
    if (isPositiveAttributeValue(attributes[key])) {
      items.push(label + (attributes[key] === 'likely' ? '（推估）' : ''));
    }
  };
  add('high_chair_available', '提供兒童椅');
  add('has_tableware', '備有兒童餐具');
  add('kids_menu', '提供兒童餐');
  add('has_diaper_table', '設有尿布台');
  add('has_play_area', '設有遊樂區');
  add('spacious_seating', '座位較寬敞');
  add('kid_noise_tolerant', '環境對孩子聲音較包容');
  const roomLabel = getPrivateRoomSummaryLabel(attributes.has_private_room);
  if (roomLabel) items.push(roomLabel);
  return items;
}

function getFallbackFamilySummary(restaurant = {}, attributes = {}) {
  const facilities = getPositiveFamilyFacilityLabels(attributes);
  if (facilities.length === 0) return '';
  return `這間${getRestaurantTypeSummaryLabel(restaurant)}${joinChineseList(facilities)}。`;
}

function removeEmptySummaryCopy(summary) {
  return /^(目前尚無摘要資訊|目前親子友善資訊較有限|尚無摘要資訊|無摘要)[。.!！?？]*$/.test(String(summary || '').trim()) ? '' : summary;
}

function getCleanFamilySummary(summary, restaurant = {}, attributes = {}) {
  const cleaned = sanitizeNoiseConflictSummary(
    sanitizeUnavailableFamilyFacilitySummary(
      sanitizeSourceMarkerSummary(neutralizeSummarySourceCopy(removeEmptySummaryCopy(summary || ''), attributes.has_private_room)),
      attributes
    ),
    attributes
  );
  return (cleaned || getFallbackFamilySummary(restaurant, attributes)).replace(/需留意環境偏安靜。?/g, '');
}
function isChainBrand(name) {
  const brand = cleanBrandName(name);
  if (!brand) return false;
  const brandLower = brand.toLowerCase();
  return Object.keys(brandRules).some(k => k.toLowerCase() === brandLower);
}

function isExpensiveOrHotel(name, priceLevel) {
  if (priceLevel === "PRICE_LEVEL_EXPENSIVE" || priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE") {
    return true;
  }
  const highEndKeywords = ["飯店", "酒店", "會館", "賓館", "VILLA"];
  const nameUpper = String(name || "").toUpperCase();
  return highEndKeywords.some(kw => nameUpper.includes(kw));
}

function readJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content.replace(/^\uFEFF/, ""));
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err.message);
    return {};
  }
}

function normalizeResult(result) {
  const value = String(result || "").trim().toLowerCase();
  if (value === "yes") return "yes";
  if (value === "no") return "no";
  if (value === "likely") return "likely";
  if (value === "room") return "room";
  if (value === "venue") return "venue";
  if (value === "likely_room") return "likely_room";
  if (value === "likely_venue") return "likely_venue";
  return "unknown";
}

function getExistingRestaurantData() {
  if (!fs.existsSync(outputPath)) {
    throw new Error(
      "ai_review/index.js is required as the restaurant catalog. " +
        "Restore it before rebuilding."
    );
  }

  const code = fs.readFileSync(outputPath, "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${code}\nthis.restaurantData = restaurantData;`, context);
  if (!Array.isArray(context.restaurantData)) {
    throw new Error("Unable to load restaurantData from ai_review/index.js.");
  }
  return context.restaurantData.map((restaurant) => ({ ...restaurant }));
}

function hasGoogleEvidence(...evidenceValues) {
  return evidenceValues.some((evidence) =>
    String(evidence || "").trim().toLowerCase().startsWith("google")
  );
}

function keepExistingWhenUnknown(nextValue, existingValue) {
  const normExisting = normalizeResult(existingValue);
  if (nextValue === "unknown") {
    if (normExisting === "likely" || normExisting === "likely_room" || normExisting === "likely_venue") {
      return "unknown";
    }
    return normExisting;
  }
  return nextValue;
}

function keepExistingUnlessOverrideUnknown(nextValue, existingValue, sourceObj) {
  if (nextValue === "unknown" && sourceObj?.override_existing) {
    return "unknown";
  }
  return keepExistingWhenUnknown(nextValue, existingValue);
}

function neutralizeSummarySourceCopy(summary, privateRoomVal) {
  if (!summary) return "";
  let s = String(summary);
  if (s.includes("可包廂")) {
    let replacement = "有包廂或可包場";
    if (privateRoomVal === "room" || privateRoomVal === "likely_room") {
      replacement = "有包廂";
    } else if (privateRoomVal === "venue" || privateRoomVal === "likely_venue") {
      replacement = "可包場";
    }
    s = s.replace(/可包廂/g, replacement);
  }
  return s
    .replace(/Google Maps\s*官方標記/g, "公開地點資訊標示")
    .replace(/Google Maps\s*官方標記/g, "公開地點資訊標示")
    .replace(/Google Maps\s*標記/g, "公開地點資訊標示")
    .replace(/Google\s*Maps/g, "公開地點資訊")
    .replace(/Google\s*官方/g, "公開地點資訊")
    .replace(/Google/g, "公開地點資訊")
    .replace(/官方明確標示/g, "店家資訊顯示")
    .replace(/官方明確表示/g, "店家資訊顯示")
    .replace(/官方明確/g, "目前資料明確")
    .replace(/官方標記/g, "公開地點資訊標示")
    .replace(/官方標示/g, "公開地點資訊標示")
    .replace(/官方資訊/g, "公開地點資訊")
    .replace(/官方/g, "店家資訊")
    .replace(/根據評論分析/g, "根據目前整理資料")
    .replace(/根據評論/g, "根據目前整理資料")
    .replace(/AI根據公開評論整理/g, "根據目前整理資料產生，僅供參考")
    .replace(/AI 根據公開評論整理/g, "根據目前整理資料產生，僅供參考")
    .replace(/公開評論整理/g, "目前整理資料")
    .replace(/公開評論/g, "目前整理資料")
    .replace(/顧客評論/g, "顧客回饋")
    .replace(/評論資訊/g, "顧客回饋")
    .replace(/評論多集中/g, "目前整理資料多集中")
    .replace(/評論反映/g, "目前整理資料顯示")
    .replace(/有評論指出/g, "目前整理資料指出")
    .replace(/評論指出/g, "目前整理資料指出")
    .replace(/有評論提到/g, "目前整理資料提到")
    .replace(/有評論提及/g, "目前整理資料提及")
    .replace(/評論提到/g, "目前整理資料提到")
    .replace(/評論提及/g, "目前整理資料提及")
    .replace(/評論中目前未提及/g, "目前整理資料中未提及")
    .replace(/目前評論中較少提及/g, "目前整理資料較少提及")
    .replace(/目前評論中未提及/g, "目前整理資料中未提及")
    .replace(/目前評論中/g, "目前整理資料中")
    .replace(/評論中也未提及/g, "目前整理資料中也未提及")
    .replace(/評論中並未提及/g, "目前整理資料中未提及")
    .replace(/評論中尚未提及/g, "目前整理資料中尚未提及")
    .replace(/評論中未有明確提及/g, "目前整理資料尚未明確提及")
    .replace(/評論中未明確提及/g, "目前整理資料尚未明確提及")
    .replace(/評論中沒有提及/g, "目前整理資料中未提及")
    .replace(/評論中也提到/g, "目前整理資料也提到")
    .replace(/評論中提及/g, "目前整理資料提及")
    .replace(/評論中未提及/g, "目前整理資料中未提及")
    .replace(/評論中/g, "目前整理資料中")
    .replace(/評論未提及/g, "目前整理資料未提及")
    .replace(/評論顯示/g, "目前整理資料顯示")
    .replace(/有顧客評論提到/g, "目前整理資料提到")
    .replace(/顧客評論提到/g, "目前整理資料提到")
    .replace(/評論/g, "目前整理資料");
}

function getPrivateRoomValue(aiReview) {
  const roomObj = aiReview.has_private_room;
  if (!roomObj) return "unknown";

  const result = normalizeResult(roomObj.result);
  if (result !== "yes" && result !== "likely") {
    return result;
  }

  const evidence = String(roomObj.evidence || "").trim().toLowerCase();
  if (evidence) {
    const hasRoom = evidence.includes("包廂") || evidence.includes("隔間") || evidence.includes("獨立空間");
    const hasVenue = evidence.includes("包場") || evidence.includes("租借") || evidence.includes("辦活動") || evidence.includes("活動空間");

    if (hasRoom && !hasVenue) {
      return result === "likely" ? "likely_room" : "room";
    }
    if (hasVenue && !hasRoom) {
      return result === "likely" ? "likely_venue" : "venue";
    }
  }
  return result;
}

function getMajorCuisine(cuisine) {
  if (!cuisine) return "複合式料理";
  
  const c = cuisine.trim();

  // 1. 台式/中式料理
  if (
    /台式|中式|台灣|台菜|粵菜|港式|川菜|四川|湘菜|上海|江浙|點心|熱炒|合菜|便當|涼麵|眷村|水餃|鍋貼|粥|麵線|小籠包|燒臘|自助餐|火鍋|中式湯品|鍋燒麵|海鮮|家常菜|家常料理/.test(c) ||
    c === "中式料理" || c === "台式料理" || c === "港式料理" || c === "台灣小吃" || c === "台式小吃" || c === "台灣料理"
  ) {
    return "台式/中式料理";
  }

  // 2. 日式料理
  if (
    /日式|居酒屋|壽司|拉麵|燒肉|丼飯|定食|烏龍麵|和食|割烹|懷石|天婦羅|鐵板燒|咖哩/.test(c) ||
    c === "日式料理" || c === "壽司" || c === "拉麵" || c === "燒肉"
  ) {
    return "日式料理";
  }

  // 3. 韓式料理
  if (/韓式|韓國|韓食|韓餐/.test(c) || c === "韓式料理") {
    return "韓式料理";
  }

  // 4. 義式料理
  if (/義大利|義式|披薩|比薩|pizza/i.test(c) || c === "義大利料理" || c === "披薩") {
    return "義式料理";
  }

  // 5. 西式料理
  if (
    /美式|法式|法國|德式|西班牙|瑞典|古巴|希臘|歐陸|歐式|西式|地中海|牛排|漢堡|熱狗|墨西哥|英式|俄式/.test(c) ||
    c === "美式料理" || c === "法式料理" || c === "牛排館"
  ) {
    return "西式料理";
  }

  // 6. 星馬料理
  if (/星馬|馬來西亞|新加坡|泰式|泰國|越南|星馬|柬埔寨|東南亞|印尼|菲律賓/.test(c) || c === "泰式料理" || c === "越南料理") {
    return "星馬料理";
  }

  // 7. 罕見異國料理
  if (/印度|尼泊爾|西藏|秘魯|祕魯|土耳其|黎巴嫩|中東|巴西|罕見異國|異國/.test(c)) {
    return "罕見異國料理";
  }

  // 8. 茶館與咖啡廳
  if (
    /咖啡|cafe|café|coffee|茶館|茶藝|茶專賣|烘焙|甜點|蛋糕|麵包|鬆餅|舒芙蕾|冰淇淋|糕點|下午茶|冰品|飲品|飲料/.test(c) ||
    c === "咖啡廳" || c === "烘焙/甜點" || c === "冰品" || c === "飲品店"
  ) {
    return "茶館與咖啡廳";
  }

  // 9. 餐酒館
  if (/餐酒館|小酒館|酒吧|酒館|bistro|bar|pub/i.test(c) || c === "小酒館/餐酒館" || c === "酒吧/餐酒館") {
    return "餐酒館";
  }

  // 10. 複合式料理
  return "複合式料理";
}

function getCuisine(placeId, baseRestaurant) {
  return (typeof cuisinesMapping !== 'undefined' ? cuisinesMapping[placeId] : null) || baseRestaurant.cuisine || inferCuisineFromName(baseRestaurant.name) || null;
}

function buildRecord(placeId, baseRestaurant, aiReview) {
  const attributes = getAiAttributes(
    aiReview,
    baseRestaurant.attributes || {},
    baseRestaurant.name || "",
    baseRestaurant.address || baseRestaurant.formatted_address || "",
    baseRestaurant.price_level ?? null
  );

  const cuisine = getCuisine(placeId, baseRestaurant);

  return [
    placeId,
    baseRestaurant.name || "",
    baseRestaurant.address || baseRestaurant.formatted_address || "",
    baseRestaurant.district || "",
    baseRestaurant.price_level ?? null,
    cuisine,
    baseRestaurant.latitude ?? null,
    baseRestaurant.longitude ?? null,
    baseRestaurant.url || baseRestaurant.google_maps_url || "",
    attributes,
    getCleanFamilySummary(aiReview.generated_summary || baseRestaurant.ai_summary || "", { ...baseRestaurant, cuisine }, attributes),
    getCleanFamilySummary(aiReview.card_summary || baseRestaurant.card_summary || "", { ...baseRestaurant, cuisine }, attributes),
    aiReview.parent_friendly_level ||
      baseRestaurant.parent_friendly_level ||
      "資訊不足",
    getMajorCuisine(cuisine),
  ];
}

function getAiAttributes(aiReview, existingAttributes = {}, name = "", address = "", priceLevel = null) {
  let highChair = normalizeResult(
    aiReview[" child_seat available"]?.result ||
      aiReview["child_seat available"]?.result ||
      aiReview["High chair available"]?.result
  );
  let tableware = normalizeResult(aiReview.has_tableware?.result);

  const inMall = isInShoppingMall(name, address);
  const isChain = isChainBrand(name);
  const isExpensive = isExpensiveOrHotel(name, priceLevel);

  if (
    highChair === "yes" &&
    hasGoogleEvidence(
      aiReview[" child_seat available"]?.evidence,
      aiReview["child_seat available"]?.evidence,
      aiReview["High chair available"]?.evidence
    )
  ) {
    if (inMall || isChain) {
      highChair = "yes";
    } else if (isExpensive) {
      highChair = "likely";
    } else {
      highChair = "unknown";
    }
  }

  if (tableware === "yes" && hasGoogleEvidence(aiReview.has_tableware?.evidence)) {
    if (inMall || isChain) {
      tableware = "yes";
    } else if (isExpensive) {
      tableware = "likely";
    } else {
      tableware = "unknown";
    }
  }

  return {
    ...existingAttributes,
    high_chair_available: keepExistingUnlessOverrideUnknown(
      highChair,
      existingAttributes.high_chair_available,
      aiReview[" child_seat available"] ||
        aiReview["child_seat available"] ||
        aiReview["High chair available"]
    ),
    kids_menu: keepExistingUnlessOverrideUnknown(
      normalizeResult(aiReview["Kids menu available"]?.result),
      existingAttributes.kids_menu,
      aiReview["Kids menu available"]
    ),
    spacious_seating: keepExistingUnlessOverrideUnknown(
      normalizeResult(aiReview["Spacious seating"]?.result),
      existingAttributes.spacious_seating,
      aiReview["Spacious seating"]
    ),
    kid_noise_tolerant: keepExistingUnlessOverrideUnknown(
      normalizeResult(aiReview.kid_noise_tolerant?.result),
      existingAttributes.kid_noise_tolerant,
      aiReview.kid_noise_tolerant
    ),
    has_play_area: keepExistingUnlessOverrideUnknown(
      normalizeResult(aiReview.has_play_area?.result),
      existingAttributes.has_play_area,
      aiReview.has_play_area
    ),
    has_private_room: keepExistingUnlessOverrideUnknown(
      getPrivateRoomValue(aiReview),
      existingAttributes.has_private_room,
      aiReview.has_private_room
    ),
    has_tableware: keepExistingUnlessOverrideUnknown(
      tableware,
      existingAttributes.has_tableware,
      aiReview.has_tableware
    ),
    has_diaper_table: keepExistingUnlessOverrideUnknown(
      normalizeResult(aiReview.has_diaper_table?.result),
      existingAttributes.has_diaper_table,
      aiReview.has_diaper_table
    ),
  };
}

function inferCuisineFromName(name) {
  const text = String(name || "").toLowerCase();
  if (!text.trim()) return null;

  const rules = [
    { cuisine: "火鍋", pattern: /火鍋|鍋物|涮涮|麻辣鍋|石頭鍋|小火鍋|hot\s*pot/i },
    { cuisine: "披薩", pattern: /披薩|比薩|pizza|pizzeria/i },
    { cuisine: "義大利料理", pattern: /義大利|義式|義麵|義大利麵|pasta|risotto|燉飯/i },
    { cuisine: "韓式料理", pattern: /韓式|韓食|韓國|韓餐|韓屋|韓室|韓式烤肉|korean|kimchi|泡菜/i },
    { cuisine: "日式料理", pattern: /日式|日本料理|日本食堂|居酒屋|丼|丼飯|烏龍麵|定食|咖哩飯|壽喜燒|和食|割烹/i },
    { cuisine: "壽司", pattern: /壽司|鮨|sushi/i },
    { cuisine: "拉麵", pattern: /拉麵|らーめん|ramen/i },
    { cuisine: "泰式料理", pattern: /泰式|泰國|thai/i },
    { cuisine: "港式料理", pattern: /港式|茶餐廳|燒臘|粵菜|廣東|香港/i },
    { cuisine: "越南料理", pattern: /越南|河粉|pho\b|bánh|banh/i },
    { cuisine: "法式料理", pattern: /法式|法國|小法國|french|bistro/i },
    { cuisine: "美式料理", pattern: /美式|漢堡|burger|bbq|炸雞|hotdog|熱狗/i },
    { cuisine: "牛排館", pattern: /牛排|steak/i },
    { cuisine: "蔬食料理", pattern: /蔬食|素食|植饌|vegan|vegetarian/i },
    { cuisine: "烘焙/甜點", pattern: /甜點|蛋糕|烘焙|麵包|鬆餅|舒芙蕾|冰淇淋|糕點|bakery|dessert|pancake/i },
    { cuisine: "早午餐", pattern: /早午餐|早餐|brunch/i },
    { cuisine: "咖啡廳", pattern: /咖啡|珈琲|cafe|café|coffee/i },
    { cuisine: "中式料理", pattern: /台菜|臺菜|川菜|四川|湘菜|上海|北平|北京|眷村|小館|麵館|水餃|鍋貼|牛肉麵|熱炒|合菜|粥|麵線|餃子|小籠包|中式/i },
    { cuisine: "小酒館/餐酒館", pattern: /餐酒館|小酒館|酒館|bistro|bar|pub/i },
  ];

  const matched = rules.filter((rule) => rule.pattern.test(text));
  if (matched.length === 0) return null;

  const exactPriority = ["壽司", "拉麵"];
  const exact = matched.find((rule) => exactPriority.includes(rule.cuisine));
  return exact ? exact.cuisine : matched[0].cuisine;
}

function getCuisine_old(baseRestaurant) {
  return baseRestaurant.cuisine || inferCuisineFromName(baseRestaurant.name) || null;
}

function buildRecord_old(placeId, baseRestaurant, aiReview) {
  const attributes = getAiAttributes(
    aiReview,
    baseRestaurant.attributes || {},
    baseRestaurant.name || "",
    baseRestaurant.address || baseRestaurant.formatted_address || "",
    baseRestaurant.price_level ?? null
  );

  return [
    placeId,
    baseRestaurant.name || "",
    baseRestaurant.address || baseRestaurant.formatted_address || "",
    baseRestaurant.district || "",
    baseRestaurant.price_level ?? null,
    getCuisine_old(baseRestaurant),
    baseRestaurant.latitude ?? null,
    baseRestaurant.longitude ?? null,
    baseRestaurant.url || baseRestaurant.google_maps_url || "",
    attributes,
    getCleanFamilySummary(aiReview.generated_summary || baseRestaurant.ai_summary || "", { ...baseRestaurant, cuisine }, attributes),
    getCleanFamilySummary(aiReview.card_summary || baseRestaurant.card_summary || "", { ...baseRestaurant, cuisine }, attributes),
    aiReview.parent_friendly_level ||
      baseRestaurant.parent_friendly_level ||
      "資訊不足",
  ];
}

function writeIndex(records) {
  const content = `const columns = ${JSON.stringify(columns)};\n\nconst rows = ${JSON.stringify(records)};\n\nconst restaurantData = [];\nfor (let i = 0; i < rows.length; i++) {\n  Object.defineProperty(restaurantData, i, {\n    get() {\n      const row = rows[i];\n      const obj = {};\n      columns.forEach((col, k) => {\n        obj[col] = row[k];\n      });\n      obj.formatted_address = obj.address;\n      obj.google_maps_url = obj.url;\n      Object.defineProperty(restaurantData, i, {\n        value: obj,\n        writable: true,\n        configurable: true,\n        enumerable: true\n      });\n      return obj;\n    },\n    configurable: true,\n    enumerable: true\n  });\n}\n`;
  fs.writeFileSync(outputPath, content, "utf8");
}

function main() {
  const existingRestaurants = getExistingRestaurantData();
  const catalogByPlaceId = new Map(
    existingRestaurants.map((restaurant) => [restaurant.place_id, restaurant])
  );

  const aiReviewFiles = fs
    .readdirSync(aiReviewDir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const skipped = [];
  const records = [];

  for (const file of aiReviewFiles) {
    const placeId = path.basename(file, ".json");
    if (temporarilyHiddenPlaceIds.has(placeId)) {
      continue;
    }

    const baseRestaurant = catalogByPlaceId.get(placeId);
    if (!baseRestaurant) {
      skipped.push(placeId);
      continue;
    }
    const aiReview = readJson(path.join(aiReviewDir, file));
    records.push(buildRecord(placeId, baseRestaurant, aiReview));
  }

  const existingRecordIds = new Set(records.map((record) => record[0]));
  for (const record of manualRecords) {
    if (!temporarilyHiddenPlaceIds.has(record[0]) && !existingRecordIds.has(record[0])) {
      if (record.length < columns.length) {
        const cuisine = record[5];
        record.push(getMajorCuisine(cuisine));
      }
      records.push(record);
    }
  }

  writeIndex(records);

  console.log(`Built ${outputPath} with ${records.length} restaurants.`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} records missing from ai_review/index.js.`);
  }
}

main();


