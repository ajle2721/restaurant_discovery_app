import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const baseDir = process.cwd();
const aiReviewDir = path.join(baseDir, "ai_review");
const outputPath = path.join(aiReviewDir, "index.js");

const contactLinksPath = path.join(aiReviewDir, "contact_links.json");
let contactLinks = {};
if (fs.existsSync(contactLinksPath)) {
  try {
    contactLinks = JSON.parse(fs.readFileSync(contactLinksPath, "utf8").replace(/^\uFEFF/, ""));
  } catch (err) {
    console.error("Error loading contact_links.json:", err.message);
  }
}

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
  "ChIJpzAkec2rQjQRLYceVmNNtq4", // 默爾 pasta pizza 信義威秀店, closed
]);

temporarilyHiddenPlaceIds.add("ChIJXUuOM7mrQjQRUTsJAPEerr0"); // Micky House Brunch, closed
temporarilyHiddenPlaceIds.add("ChIJjXjbqvqpQjQRe_vZGgCX438"); // 復唧集時尚咖啡廳, closed

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
  "phone",
  "website_url",
  "reservation_url",
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
  "NICE to MEET U newborn & café 寶寶友善咖啡廳（預約制）是為親子家庭特別設計的咖啡廳，提供兒童椅、兒童餐具、各年齡層寶寶副食品、消毒鍋、嬰兒床、哺乳室、有質感的遊樂區，以及設有尿布台的親子廁所，特別適合帶寶寶前往。",
  "寶寶友善預約制咖啡廳，備有兒童椅、兒童餐具、寶寶副食品、消毒鍋、嬰兒床、哺乳室、遊樂區與尿布台。",
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

manualRecords.push(
  [
    "manual-herdor-xuzhou-ntu",
    "禾多餐酒館 台大徐州店",
    "100臺北市中正區徐州路42號",
    "中正區",
    "PRICE_LEVEL_MODERATE",
    "餐酒館",
    25.0409,
    121.5229,
    "https://www.google.com/maps/search/?api=1&query=%E7%A6%BE%E5%A4%9A%E9%A4%90%E9%85%92%E9%A4%A8%20%E5%8F%B0%E5%A4%A7%E5%BE%90%E5%B7%9E%E5%BA%97%20100%E8%87%BA%E5%8C%97%E5%B8%82%E4%B8%AD%E6%AD%A3%E5%8D%80%E5%BE%90%E5%B7%9E%E8%B7%AF42%E8%99%9F",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "禾多餐酒館台大徐州店提供兒童椅與兒童餐具，環境對孩子聲音較包容，適合親子家庭用餐。",
    "提供兒童椅與兒童餐具，環境對孩子聲音較包容。",
    "高",
    ["異國/其他"],
    "",
    "",
    "",
  ],
  [
    "manual-herdor-taipei-arena",
    "禾多餐酒館 小巨蛋店",
    "105臺北市松山區復勢里光復北路120巷7號1樓",
    "松山區",
    "PRICE_LEVEL_MODERATE",
    "餐酒館",
    25.0504,
    121.5572,
    "https://www.google.com/maps/search/?api=1&query=%E7%A6%BE%E5%A4%9A%E9%A4%90%E9%85%92%E9%A4%A8%20%E5%B0%8F%E5%B7%A8%E8%9B%8B%E5%BA%97%20105%E8%87%BA%E5%8C%97%E5%B8%82%E6%9D%BE%E5%B1%B1%E5%8D%80%E5%BE%A9%E5%8B%A2%E9%87%8C%E5%85%89%E5%BE%A9%E5%8C%97%E8%B7%AF120%E5%B7%B77%E8%99%9F1%E6%A8%93",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "禾多餐酒館小巨蛋店提供兒童椅與兒童餐具，環境對孩子聲音較包容，適合親子家庭用餐。",
    "提供兒童椅與兒童餐具，環境對孩子聲音較包容。",
    "高",
    ["異國/其他"],
    "",
    "",
    "",
  ],
);
const brandRulesPath = path.join(baseDir, "brand_rules.json");
let brandRules = {};
let brandCounts = {};
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

  const negativeFacilityPattern = /(?:未提供|沒有|無提供|不提供|需留意未提供|需自備|自行準備)/;
  return String(summary)
    .replace(/\s+/g, " ")
    .match(/[^。！？!?]+[。！？!?]?/g)
    ?.map((sentence) => sentence.trim())
    .filter((sentence) => negativeFacilityPattern.test(sentence) || !unavailablePatterns.some((pattern) => pattern.test(sentence)))
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

manualRecords.push(
  [
    "ChIJl92ABjKrQjQRUGV4VQcIRaQ",
    "嵩 sung 台北大安",
    "106臺灣臺北市大安區延吉街131巷35號",
    "大安區",
    null,
    "義大利料理",
    25.0427,
    121.5541,
    "https://www.google.com/maps/search/?api=1&query=%E5%B5%A9%20sung%20%E5%8F%B0%E5%8C%97%E5%A4%A7%E5%AE%89&query_place_id=ChIJl92ABjKrQjQRUGV4VQcIRaQ",
    {
      high_chair_available: "yes",
      kids_menu: "no",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "yes",
    },
    "這間餐廳有兒童座椅、兒童餐具與尿布台，整體用餐氛圍對孩子聲音較包容。",
    "有兒童座椅、兒童餐具與尿布台，適合親子一起前往。",
    "高",
    "義式料理",
    "02 8772 0358",
    "https://www.zunhongtw.com/",
    "",
  ],
  [
    "ChIJazuHbz6pQjQRGGRLxz2VfIQ",
    "稻舍食館 迪化店",
    "103臺灣臺北市大同區迪化街一段329號",
    "大同區",
    null,
    "台式料理",
    25.0624,
    121.5096,
    "https://www.google.com/maps/search/?api=1&query=%E7%A8%BB%E8%88%8D%E9%A3%9F%E9%A4%A8%20%E8%BF%AA%E5%8C%96%E5%BA%97&query_place_id=ChIJazuHbz6pQjQRGGRLxz2VfIQ",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "room",
      has_tableware: "yes",
      has_diaper_table: "no",
    },
    "店內提供兒童椅、兒童餐與兒童餐具，並設有包廂，適合一般家庭聚餐。",
    "有兒童椅、兒童餐與兒童餐具，也有包廂。",
    "高",
    "台式/中式料理",
    "02 2550 6607",
    "https://www.rice1923.com/",
    "",
  ],
  [
    "ChIJS6tN5nCrQjQRViIItrTnwug",
    "稻舍食館 統一時代店",
    "110臺灣臺北市信義區忠孝東路五段8號 B2",
    "信義區",
    null,
    "台式料理",
    25.0409,
    121.5650,
    "https://www.google.com/maps/search/?api=1&query=%E7%A8%BB%E8%88%8D%E9%A3%9F%E9%A4%A8%20%E7%B5%B1%E4%B8%80%E6%99%82%E4%BB%A3%E5%BA%97&query_place_id=ChIJS6tN5nCrQjQRViIItrTnwug",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "no",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "yes",
    },
    "店內提供兒童椅、兒童餐與兒童餐具，商場環境也較容易找到親子便利設施。",
    "有兒童椅、兒童餐與兒童餐具。",
    "高",
    "台式/中式料理",
    "02 2722 4210",
    "https://www.rice1923.com/",
    "",
  ],
  [
    "ChIJsZoO7FOrQjQR8x55hLnwBDU",
    "稻舍食館 微風信義店",
    "110臺灣臺北市信義區忠孝東路五段68號4樓",
    "信義區",
    null,
    "台式料理",
    25.0407,
    121.5671,
    "https://www.google.com/maps/search/?api=1&query=%E7%A8%BB%E8%88%8D%E9%A3%9F%E9%A4%A8%20%E5%BE%AE%E9%A2%A8%E4%BF%A1%E7%BE%A9%E5%BA%97&query_place_id=ChIJsZoO7FOrQjQR8x55hLnwBDU",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "yes",
    },
    "店內提供兒童椅、兒童餐與兒童餐具，座位空間較寬敞，商場環境也有親子便利設施。",
    "有兒童椅、兒童餐與兒童餐具，座位較寬敞。",
    "高",
    "台式/中式料理",
    "02 2723 8001",
    "https://www.rice1923.com/",
    "",
  ],
);
manualRecords.push(
  [
    "manual-dintaifung-taipei-xinyi",
    "鼎泰豐 信義店",
    "台北市信義路二段194號",
    "大安區",
    null,
    "中式料理",
    25.0331,
    121.5302,
    "https://www.dintaifung.com.tw/store.php?cid=1",
    {
      high_chair_available: "unknown",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "unknown",
      has_diaper_table: "unknown",
    },
    "鼎泰豐服務細緻、對親子需求友善，整體環境不怕小孩聲音。提醒：官方門市資訊標示信義店目前僅供外帶，且未設無障礙空間。",
    "僅供外帶；服務細緻，對親子需求友善。",
    "中",
    "台式/中式料理",
    "02-2321-8928",
    "https://www.dintaifung.com.tw/",
    "",
  ],
  [
    "manual-dintaifung-taipei-fuxing",
    "鼎泰豐 復興店",
    "台北市忠孝東路三段300號B2 (SOGO復興館)",
    "大安區",
    null,
    "中式料理",
    25.0418,
    121.5434,
    "https://www.dintaifung.com.tw/store.php?cid=1",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "鼎泰豐提供兒童椅與兒童餐具，也會協助準備熱水，方便家長清洗嬰兒奶瓶、餐具或食物剪刀。環境對孩子聲音較包容。",
    "有兒童椅、兒童餐具，也可協助準備熱水清洗奶瓶或餐具。",
    "高",
    "台式/中式料理",
    "02-8772-0528",
    "https://www.dintaifung.com.tw/",
    "",
  ],
  [
    "manual-dintaifung-taipei-tianmu",
    "鼎泰豐 天母店",
    "台北市中山北路六段77號B1 (SOGO天母店)",
    "士林區",
    null,
    "中式料理",
    25.1051,
    121.5244,
    "https://www.dintaifung.com.tw/store.php?cid=1",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "鼎泰豐提供兒童椅與兒童餐具，也會協助準備熱水，方便家長清洗嬰兒奶瓶、餐具或食物剪刀。環境對孩子聲音較包容。",
    "有兒童椅、兒童餐具，也可協助準備熱水清洗奶瓶或餐具。",
    "高",
    "台式/中式料理",
    "02-2833-8900",
    "https://www.dintaifung.com.tw/",
    "",
  ],
  [
    "manual-dintaifung-taipei-101",
    "鼎泰豐 101店",
    "台北市市府路45號B1 (台北101購物中心)",
    "信義區",
    null,
    "中式料理",
    25.0339,
    121.5645,
    "https://www.dintaifung.com.tw/store.php?cid=1",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "鼎泰豐提供兒童椅與兒童餐具，也會協助準備熱水，方便家長清洗嬰兒奶瓶、餐具或食物剪刀。環境對孩子聲音較包容。",
    "有兒童椅、兒童餐具，也可協助準備熱水清洗奶瓶或餐具。",
    "高",
    "台式/中式料理",
    "02-8101-7799",
    "https://www.dintaifung.com.tw/",
    "",
  ],
  [
    "manual-dintaifung-taipei-nanxi",
    "鼎泰豐 南西店",
    "台北市南京西路12號B2 (新光三越南西店1館)",
    "中山區",
    null,
    "中式料理",
    25.0523,
    121.5210,
    "https://www.dintaifung.com.tw/store.php?cid=1",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "鼎泰豐提供兒童椅與兒童餐具，也會協助準備熱水，方便家長清洗嬰兒奶瓶、餐具或食物剪刀。環境對孩子聲音較包容。",
    "有兒童椅、兒童餐具，也可協助準備熱水清洗奶瓶或餐具。",
    "高",
    "台式/中式料理",
    "02-2511-1555",
    "https://www.dintaifung.com.tw/",
    "",
  ],
  [
    "manual-dintaifung-taipei-a4",
    "鼎泰豐 A4店",
    "台北市松高路19號B2 (新光三越信義新天地A4館)",
    "信義區",
    null,
    "中式料理",
    25.0390,
    121.5665,
    "https://www.dintaifung.com.tw/store.php?cid=1",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "鼎泰豐提供兒童椅與兒童餐具，也會協助準備熱水，方便家長清洗嬰兒奶瓶、餐具或食物剪刀。環境對孩子聲音較包容。",
    "有兒童椅、兒童餐具，也可協助準備熱水清洗奶瓶或餐具。",
    "高",
    "台式/中式料理",
    "02-2345-2528",
    "https://www.dintaifung.com.tw/",
    "",
  ],
  [
    "manual-dintaifung-taipei-a13",
    "鼎泰豐 A13店",
    "台北市松仁路58號1樓 (遠百信義A13)",
    "信義區",
    null,
    "中式料理",
    25.0363,
    121.5685,
    "https://www.dintaifung.com.tw/store.php?cid=1",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "鼎泰豐提供兒童椅與兒童餐具，也會協助準備熱水，方便家長清洗嬰兒奶瓶、餐具或食物剪刀。環境對孩子聲音較包容。",
    "有兒童椅、兒童餐具，也可協助準備熱水清洗奶瓶或餐具。",
    "高",
    "台式/中式料理",
    "02-8780-5200",
    "https://www.dintaifung.com.tw/",
    "",
  ],
  [
    "manual-dintaifung-taipei-xinsheng",
    "鼎泰豐 新生店",
    "台北市信義路二段277號",
    "大安區",
    null,
    "中式料理",
    25.0337,
    121.5345,
    "https://www.dintaifung.com.tw/store.php?cid=1",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "鼎泰豐提供兒童椅與兒童餐具，也會協助準備熱水，方便家長清洗嬰兒奶瓶、餐具或食物剪刀。環境對孩子聲音較包容。",
    "有兒童椅、兒童餐具，也可協助準備熱水清洗奶瓶或餐具。",
    "高",
    "台式/中式料理",
    "02-2395-2395",
    "https://www.dintaifung.com.tw/",
    "",
  ],
);
manualRecords.push(
  [
    "manual-haidilao-taipei-q-square",
    "海底撈 京站店",
    "台北市大同區承德路一段1號4樓 (京站廣場)",
    "大同區",
    null,
    "火鍋",
    25.0493,
    121.5165,
    "https://www.abic.com.tw/place/view/id/10856",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "yes",
      has_private_room: "room",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "海底撈京站店提供兒童椅、兒童餐具，座位空間寬敞且對孩子聲音較包容。入座後通常會招待無調味的寶寶專屬蒸蛋，若有需求，也可請服務員協助特製適合小朋友的原型食物。此分店設有兒童遊戲室與陪玩人員，另外還有嬰兒床，適合帶嬰幼兒與小孩一起用餐。",
    "有兒童椅、兒童餐具、寶寶蒸蛋、遊戲室與陪玩人員，另有嬰兒床。",
    "高",
    "台式/中式料理",
    "02-2559-0125",
    "https://www.haidilao.com/tw/",
    "",
  ],
  [
    "manual-haidilao-taipei-qingcheng",
    "海底撈 慶城店",
    "台北市松山區慶城街1號3樓",
    "松山區",
    null,
    "火鍋",
    25.0524,
    121.5446,
    "https://bunnyann.tw/lamxb/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "yes",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "海底撈慶城店提供兒童椅、兒童餐具，座位空間寬敞且對孩子聲音較包容。入座後通常會招待無調味的寶寶專屬蒸蛋，若有需求，也可請服務員協助特製適合小朋友的原型食物。此分店另有親子遊戲區，適合帶小朋友一起用餐。",
    "有兒童椅、兒童餐具、寶寶蒸蛋與親子遊戲區，空間寬敞不怕吵。",
    "高",
    "台式/中式料理",
    "",
    "https://www.haidilao.com/tw/",
    "",
  ],
  [
    "manual-haidilao-taipei-ximen",
    "海底撈 西門店",
    "台北市萬華區西寧南路36號",
    "萬華區",
    null,
    "火鍋",
    25.0454,
    121.5064,
    "https://www.google.com/maps/search/?api=1&query=%E6%B5%B7%E5%BA%95%E6%92%88%20%E8%A5%BF%E9%96%80%E5%BA%97%20%E5%8F%B0%E5%8C%97",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "yes",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "海底撈西門店提供兒童椅、兒童餐具，座位空間寬敞且對孩子聲音較包容。入座後通常會招待無調味的寶寶專屬蒸蛋，若有需求，也可請服務員協助特製適合小朋友的原型食物。此分店另有兒童遊戲室與陪玩人員，適合親子家庭用餐。",
    "有兒童椅、兒童餐具、寶寶蒸蛋、兒童遊戲室與陪玩人員。",
    "高",
    "台式/中式料理",
    "",
    "https://www.haidilao.com/tw/",
    "",
  ],
  [
    "manual-haidilao-taipei-breeze-nanshan",
    "海底撈 信義微風南山店",
    "台北市信義區松智路17號B2 (微風南山)",
    "信義區",
    null,
    "火鍋",
    25.0340,
    121.5672,
    "https://travel.udn.com/travel/story/7193/7540050",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "yes",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "海底撈信義微風南山店提供兒童椅、兒童餐具，座位空間寬敞且對孩子聲音較包容。入座後通常會招待無調味的寶寶專屬蒸蛋，若有需求，也可請服務員協助特製適合小朋友的原型食物。此分店設有兒童遊戲室與陪玩人員，家長可透過透明玻璃窗留意孩子狀況。",
    "有兒童椅、兒童餐具、寶寶蒸蛋、兒童遊戲室與陪玩人員。",
    "高",
    "台式/中式料理",
    "",
    "https://www.haidilao.com/tw/",
    "",
  ],
);
manualRecords.push(
  [
    "manual-tokiya-taipei-fuxing-north",
    "陶板屋 台北復興北店",
    "台北市松山區復興北路375號",
    "松山區",
    null,
    "和風洋食",
    25.0606,
    121.5445,
    "https://www.tokiya.com.tw/store.php",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "陶板屋提供兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容，也貼心提供畫紙與蠟筆給小孩畫畫。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫紙與蠟筆。",
    "高",
    "台式/中式料理",
    "02-2718-1268",
    "https://www.tokiya.com.tw/",
    "",
  ],
  [
    "manual-chamonix-taipei-zhongshan-north",
    "夏慕尼 台北中山北店",
    "臺北市中山區中山北路二段44號B1",
    "中山區",
    null,
    "鐵板燒",
    25.0551,
    121.5224,
    "https://www.chamonix.com.tw/store.php",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "夏慕尼提供兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。12歲以下兒童免費，入座即招待帕瑪森起司麵包、玉米濃湯、蒸蛋及櫻花蝦炒飯，且都可免費續加。主廚會提供兒童專屬調味與合適熟度，也會主動將兒童椅安排在遠離高溫鐵板的安全區域。",
    "12歲以下兒童免費，有兒童椅、兒童餐具與多款可續加兒童餐點，座位會安排遠離高溫鐵板。",
    "高",
    "西式料理",
    "02-2571-9608",
    "https://www.chamonix.com.tw/",
    "",
  ],
  [
    "manual-chamonix-taipei-dazhi-jingye",
    "夏慕尼 台北大直敬業店",
    "台北市敬業二路199號2樓",
    "中山區",
    null,
    "鐵板燒",
    25.0825,
    121.5565,
    "https://www.chamonix.com.tw/store.php",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "夏慕尼提供兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。12歲以下兒童免費，入座即招待帕瑪森起司麵包、玉米濃湯、蒸蛋及櫻花蝦炒飯，且都可免費續加。主廚會提供兒童專屬調味與合適熟度，也會主動將兒童椅安排在遠離高溫鐵板的安全區域。",
    "12歲以下兒童免費，有兒童椅、兒童餐具與多款可續加兒童餐點，座位會安排遠離高溫鐵板。",
    "高",
    "西式料理",
    "02-2793-2363",
    "https://www.chamonix.com.tw/",
    "",
  ],
  [
    "manual-chamonix-taipei-nanchang",
    "夏慕尼 台北南昌店",
    "臺北市中正區南昌路二段112號2樓",
    "中正區",
    null,
    "鐵板燒",
    25.0262,
    121.522,
    "https://www.chamonix.com.tw/store.php",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "夏慕尼提供兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。12歲以下兒童免費，入座即招待帕瑪森起司麵包、玉米濃湯、蒸蛋及櫻花蝦炒飯，且都可免費續加。主廚會提供兒童專屬調味與合適熟度，也會主動將兒童椅安排在遠離高溫鐵板的安全區域。",
    "12歲以下兒童免費，有兒童椅、兒童餐具與多款可續加兒童餐點，座位會安排遠離高溫鐵板。",
    "高",
    "西式料理",
    "02-2368-0613",
    "https://www.chamonix.com.tw/",
    "",
  ],
  [
    "manual-chamonix-taipei-zhongxiao-east",
    "夏慕尼 台北忠孝東店",
    "臺北市大安區忠孝東路四段333號2樓",
    "大安區",
    null,
    "鐵板燒",
    25.0415,
    121.5571,
    "https://www.chamonix.com.tw/store.php",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "夏慕尼提供兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。12歲以下兒童免費，入座即招待帕瑪森起司麵包、玉米濃湯、蒸蛋及櫻花蝦炒飯，且都可免費續加。主廚會提供兒童專屬調味與合適熟度，也會主動將兒童椅安排在遠離高溫鐵板的安全區域。",
    "12歲以下兒童免費，有兒童椅、兒童餐具與多款可續加兒童餐點，座位會安排遠離高溫鐵板。",
    "高",
    "西式料理",
    "02-2776-6877",
    "https://www.chamonix.com.tw/",
    "",
  ],
  [
    "manual-tasty-taipei-chongqing-south",
    "西堤 台北重慶南店",
    "台北市中正區重慶南路一段129號2樓",
    "中正區",
    null,
    "牛排館",
    25.0423,
    121.5133,
    "https://www.tasty.com.tw/shop/list.php",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "西堤提供兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容，適合家庭聚餐。",
    "12歲以下兒童免費，有兒童椅、兒童餐具與多款可續加兒童餐點，座位會安排遠離高溫鐵板。",
    "高",
    "西式料理",
    "02-2370-8292",
    "https://www.tasty.com.tw/",
    "",
  ],
  [
    "manual-tasty-taipei-guangfu-south",
    "西堤 台北光復南店",
    "台北市大安區光復南路100號B1",
    "大安區",
    null,
    "牛排館",
    25.044,
    121.5574,
    "https://www.tasty.com.tw/shop/list.php",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "西堤提供兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容，適合家庭聚餐。",
    "12歲以下兒童免費，有兒童椅、兒童餐具與多款可續加兒童餐點，座位會安排遠離高溫鐵板。",
    "高",
    "西式料理",
    "02-2778-5159",
    "https://www.tasty.com.tw/",
    "",
  ],
  [
    "manual-tasty-taipei-nanjing-east",
    "西堤 台北南京東店",
    "台北市中山區南京東路二段11號2樓",
    "中山區",
    null,
    "牛排館",
    25.0523,
    121.5289,
    "https://www.tasty.com.tw/shop/list.php",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "西堤提供兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容，適合家庭聚餐。",
    "12歲以下兒童免費，有兒童椅、兒童餐具與多款可續加兒童餐點，座位會安排遠離高溫鐵板。",
    "高",
    "西式料理",
    "02-2560-1296",
    "https://www.tasty.com.tw/",
    "",
  ],
  [
    "manual-tasty-taipei-roosevelt",
    "西堤 台北羅斯福店",
    "台北市大安區羅斯福路二段79號2樓",
    "大安區",
    null,
    "牛排館",
    25.0263,
    121.5233,
    "https://www.tasty.com.tw/shop/list.php",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "西堤提供兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容，適合家庭聚餐。",
    "12歲以下兒童免費，有兒童椅、兒童餐具與多款可續加兒童餐點，座位會安排遠離高溫鐵板。",
    "高",
    "西式料理",
    "02-2369-9148",
    "https://www.tasty.com.tw/",
    "",
  ]
);
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

function getPrivateRoomSummaryLabel(value) {
  if (value === 'room') return '有包廂';
  if (value === 'venue') return '可包場';
  if (value === 'likely_room') return '可能有包廂';
  if (value === 'likely_venue') return '可包場（推估）';
  if (value === 'yes') return '包廂或包場資訊';
  if (value === 'likely') return '包廂或包場資訊（推估）';
  return '';
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
  const hasRule = Object.keys(brandRules).some(k => k.toLowerCase() === brandLower);
  const count = brandCounts[brandLower] || 0;
  return hasRule && count >= 2;
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
function collectAiReviewText(value, parts = []) {
  if (value == null) return parts;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    parts.push(String(value));
    return parts;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAiReviewText(item, parts));
    return parts;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectAiReviewText(item, parts));
  }
  return parts;
}

function hasQuietAtmosphereEvidence(aiReview = {}) {
  const text = collectAiReviewText({
    kid_noise_tolerant: aiReview.kid_noise_tolerant,
    generated_signals: aiReview.generated_signals,
    generated_summary: aiReview.generated_summary,
    card_summary: aiReview.card_summary,
    reason: aiReview.reason,
  }).join(" ");

  return /環境[^。！？!?]*(安靜|靜謐|清幽|寧靜|低語|輕聲)|氣氛[^。！？!?]*(安靜|靜謐|清幽|寧靜|低語|輕聲)|店內[^。！？!?]*(安靜|靜謐|清幽|寧靜|低語|輕聲)|用餐[^。！？!?]*(安靜|靜謐|清幽|寧靜|低語|輕聲)|較安靜|偏安靜|非常安靜|安靜用餐|保持安靜|不適合吵鬧|不適合較吵|吵鬧[^。！？!?]*(不適合|留意|避免)|quiet|tranquil|serene|peaceful/i.test(text);
}

function getKidNoiseToleranceValue(aiReview = {}) {
  return hasQuietAtmosphereEvidence(aiReview) ? "no" : "yes";
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

function getMajorCuisines(cuisine, name = "") {
  const c = String(cuisine || "").trim();
  const n = String(name || "").trim();
  const text = c + " " + n;
  const groups = [];
  const add = (group) => {
    if (!groups.includes(group)) groups.push(group);
  };

  if (/火鍋|鍋物|涮涮|麻辣鍋|石頭鍋|小火鍋|hot\s*pot/i.test(text) || c === "火鍋") {
    add("火鍋");
  }

  if (/早午餐|早餐|brunch|吐司|三明治|漢堡早餐|蛋餅|輕食/i.test(text) || c === "早午餐") {
    add("早午餐");
  }

  if (/親子餐廳|親子主題|兒童餐廳|kids|money\s*jump/i.test(text)) {
    add("親子餐廳");
  }

  if (/素食|蔬食|全素|蛋奶素|vegan|vegetarian/i.test(text) || c === "蔬食料理") {
    add("素食/蔬食");
  }

  if (
    /台式|中式|台灣|台菜|粵菜|港式|川菜|四川|湘菜|上海|江浙|點心|熱炒|合菜|便當|涼麵|眷村|水餃|鍋貼|粥|麵線|小籠包|燒臘|自助餐|中式湯品|鍋燒麵|海鮮|家常菜|家常料理/.test(text) ||
    ["中式料理", "台式料理", "港式料理", "台灣小吃", "台式小吃", "台灣料理"].includes(c)
  ) {
    add("台式/中式料理");
  }

  if (
    /日式|日本|居酒屋|壽司|拉麵|燒肉|丼飯|定食|烏龍麵|和食|割烹|懷石|天婦羅|鐵板燒|咖哩|韓式|韓國|韓食|韓餐/.test(text) ||
    ["日式料理", "韓式料理", "壽司", "拉麵", "燒肉"].includes(c)
  ) {
    add("日韓料理");
  }

  if (/義大利|義式|披薩|比薩|pizza/i.test(text) || c === "義大利料理" || c === "披薩") {
    add("義式料理");
  }

  if (
    /美式|法式|法國|德式|西班牙|瑞典|歐陸|歐式|西式|牛排|漢堡|熱狗|英式|俄式/.test(text) ||
    ["美式料理", "法式料理", "牛排館"].includes(c)
  ) {
    add("西式料理");
  }

  if (
    /咖啡|珈琲|cafe|café|coffee|茶館|茶藝|茶專賣|烘焙|甜點|蛋糕|麵包|鬆餅|舒芙蕾|冰淇淋|糕點|下午茶|冰品|飲品|飲料/.test(text) ||
    ["咖啡廳", "烘焙/甜點", "冰品", "飲品店"].includes(c)
  ) {
    add("咖啡甜點");
  }

  if (
    /星馬|馬來西亞|新加坡|泰式|泰國|越南|柬埔寨|東南亞|印尼|菲律賓|印度|尼泊爾|西藏|秘魯|祕魯|土耳其|黎巴嫩|中東|巴西|墨西哥|古巴|地中海|異國|餐酒館|小酒館|酒吧|酒館|bistro|bar|pub/i.test(text)
  ) {
    add("異國/其他");
  }

  if (groups.length === 0) add("異國/其他");
  return groups;
}

function getMajorCuisine(cuisine, name = "") {
  return getMajorCuisines(cuisine, name)[0] || "異國/其他";
}


const familyFriendlyChainPatterns = [
  /石二鍋/i,
  /荖子鍋/i,
  /涮乃葉/i,
  /橘色(涮涮屋)?/i,
  /築間幸福鍋物/i,
  /牛棒碗安|GOBO/i,
  /聚\s*(北海道|日式)?鍋物/i,
  /BELLINI\s*Pasta/i,
  /薩利亞|薩莉亞|Saizeriya/i,
  /薄多義|Bite2Eat/i,
  /托斯卡尼尼/i,
  /BUNA\s*CAFE/i,
  /赤虎/i,
  /OH\s*MY\s*原燒|原燒/i,
  /涓豆腐/i,
  /北村豆腐家/i,
  /開飯川食堂/i,
  /春水堂/i,
  /JOYFULL|珍有福/i,
  /漢來上海湯包/i,
  /享鴨/i,
];

function isFamilyFriendlyChain(name = "") {
  const text = String(name || "");
  return familyFriendlyChainPatterns.some((pattern) => pattern.test(text));
}

function applyFamilyFriendlyChainAttributes(attributes, name = "") {
  if (!isFamilyFriendlyChain(name)) return attributes;
  return {
    ...attributes,
    high_chair_available: "yes",
    has_tableware: "yes",
    kid_noise_tolerant: "yes",
  };
}

function appendFamilyFriendlyChainSummary(summary, name = "") {
  if (!isFamilyFriendlyChain(name)) return summary || "";
  const base = String(summary || "").trim();
  const addition = "此連鎖品牌具備兒童椅與兒童餐具，環境對孩子聲音較包容，適合親子家庭用餐。";
  if (base.includes("兒童椅") && base.includes("兒童餐具") && base.includes("孩子聲音")) return base;
  return base ? `${base}${base.endsWith("。") ? "" : "。"}${addition}` : addition;
}
function getContactInfo(placeId, baseRestaurant = {}) {
  const contact = contactLinks[placeId] || {};
  return {
    phone: contact.phone || baseRestaurant.phone || baseRestaurant.national_phone_number || baseRestaurant.international_phone_number || "",
    website_url: contact.website_url || baseRestaurant.website_url || baseRestaurant.website || baseRestaurant.websiteUri || "",
    reservation_url: contact.reservation_url || baseRestaurant.reservation_url || "",
  };
}

function getCuisine(placeId, baseRestaurant) {
  if (/Mini Club/i.test(baseRestaurant.name || "")) return "親子餐廳 / 咖啡廳";
  return (typeof cuisinesMapping !== 'undefined' ? cuisinesMapping[placeId] : null) || baseRestaurant.cuisine || inferCuisineFromName(baseRestaurant.name) || null;
}

function getPriceLevel(baseRestaurant) {
  const name = baseRestaurant.name || "";
  if (/Mini Club/i.test(name)) return "PRICE_LEVEL_MODERATE";
  if (/海底撈/.test(name)) return "PRICE_LEVEL_MODERATE";
  return baseRestaurant.price_level ?? null;
}

function getRestaurantMapUrl(baseRestaurant) {
  const name = baseRestaurant.name || "";
  if (/YAYOI|彌生/.test(name)) {
    const query = encodeURIComponent(`${name} ${baseRestaurant.address || baseRestaurant.formatted_address || "台北"}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  return baseRestaurant.url || baseRestaurant.google_maps_url || "";
}

function buildRecord(placeId, baseRestaurant, aiReview) {
  let attributes = getAiAttributes(
    aiReview,
    baseRestaurant.attributes || {},
    baseRestaurant.name || "",
    baseRestaurant.address || baseRestaurant.formatted_address || "",
    getPriceLevel(baseRestaurant)
  );

  attributes = applyFamilyFriendlyChainAttributes(attributes, baseRestaurant.name || "");

  const cuisine = getCuisine(placeId, baseRestaurant);
  const contactInfo = getContactInfo(placeId, baseRestaurant);

  return [
    placeId,
    baseRestaurant.name || "",
    baseRestaurant.address || baseRestaurant.formatted_address || "",
    baseRestaurant.district || "",
    getPriceLevel(baseRestaurant),
    cuisine,
    baseRestaurant.latitude ?? null,
    baseRestaurant.longitude ?? null,
    getRestaurantMapUrl(baseRestaurant),
    attributes,
    getCleanFamilySummary(appendFamilyFriendlyChainSummary(aiReview.generated_summary || baseRestaurant.ai_summary || "", baseRestaurant.name || ""), { ...baseRestaurant, cuisine }, attributes),
    getCleanFamilySummary(appendFamilyFriendlyChainSummary(aiReview.card_summary || baseRestaurant.card_summary || "", baseRestaurant.name || ""), { ...baseRestaurant, cuisine }, attributes),
    isFamilyFriendlyChain(baseRestaurant.name || "") ? "高" : (
      aiReview.parent_friendly_level ||
      baseRestaurant.parent_friendly_level ||
      "資訊不足"
    ),
    getMajorCuisines(cuisine, baseRestaurant.name || ""),
    contactInfo.phone,
    contactInfo.website_url,
    contactInfo.reservation_url,
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

  let isHighChairGoogleDemoted = false;
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
      isHighChairGoogleDemoted = true;
    }
  }

  let isTablewareGoogleDemoted = false;
  if (tableware === "yes" && hasGoogleEvidence(aiReview.has_tableware?.evidence)) {
    if (inMall || isChain) {
      tableware = "yes";
    } else if (isExpensive) {
      tableware = "likely";
    } else {
      tableware = "unknown";
      isTablewareGoogleDemoted = true;
    }
  }

  return {
    ...existingAttributes,
    high_chair_available: isHighChairGoogleDemoted ? "unknown" : keepExistingUnlessOverrideUnknown(
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
    kid_noise_tolerant: getKidNoiseToleranceValue(aiReview),
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
    has_tableware: isTablewareGoogleDemoted ? "unknown" : keepExistingUnlessOverrideUnknown(
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
    getPriceLevel(baseRestaurant)
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
    getRestaurantMapUrl(baseRestaurant),
    attributes,
    getCleanFamilySummary(aiReview.generated_summary || baseRestaurant.ai_summary || "", baseRestaurant, attributes),
    getCleanFamilySummary(aiReview.card_summary || baseRestaurant.card_summary || "", baseRestaurant, attributes),
    aiReview.parent_friendly_level ||
      baseRestaurant.parent_friendly_level ||
      "資訊不足",
  ];
}
function writeIndex(records) {
  const normalizedRecords = records.map((record) => {
    const row = Array.from(record);
    while (row.length < columns.length) row.push("");
    return row.slice(0, columns.length);
  });
  const content = `const columns = ${JSON.stringify(columns)};\n\nconst rows = ${JSON.stringify(normalizedRecords)};\n\nconst restaurantData = [];\nfor (let i = 0; i < rows.length; i++) {\n  Object.defineProperty(restaurantData, i, {\n    get() {\n      const row = rows[i];\n      const obj = {};\n      columns.forEach((col, k) => {\n        obj[col] = row[k];\n      });\n      obj.formatted_address = obj.address;\n      obj.google_maps_url = obj.url;\n      Object.defineProperty(restaurantData, i, {\n        value: obj,\n        writable: true,\n        configurable: true,\n        enumerable: true\n      });\n      return obj;\n    },\n    configurable: true,\n    enumerable: true\n  });\n}\n`;
  fs.writeFileSync(outputPath, content, "utf8");
}

function main() {
  const existingRestaurants = getExistingRestaurantData();
  brandCounts = {};
  for (const r of existingRestaurants) {
    const brand = cleanBrandName(r.name);
    if (brand) {
      const brandLower = brand.toLowerCase();
      brandCounts[brandLower] = (brandCounts[brandLower] || 0) + 1;
    }
  }
  const catalogByPlaceId = new Map(
    existingRestaurants.map((restaurant) => [restaurant.place_id, restaurant])
  );

  const aiReviewFiles = fs
    .readdirSync(aiReviewDir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  
manualRecords.push(
  [
    "manual-second-floor-taipei-dunnan",
    "Second Floor 貳樓敦南店",
    "台北市大安區敦化南路二段63巷14號",
    "大安區",
    "PRICE_LEVEL_MODERATE",
    "早午餐",
    25.0312,
    121.5486,
    "https://www.secondfloorcafe.com/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "貳樓敦南店提供兒童椅、兒童餐具與兒童餐點，空間與氣氛適合親子家庭用餐，環境對孩子聲音較包容。店內也會提供畫畫用品給小孩使用。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫畫用品。",
    "高",
    "西式料理",
    "",
    "https://www.secondfloorcafe.com/",
    "",
  ],
  [
    "manual-second-floor-taipei-gongguan",
    "Second Floor 貳樓公館店",
    "台北市中正區羅斯福路三段316巷9弄5號",
    "中正區",
    "PRICE_LEVEL_MODERATE",
    "早午餐",
    25.0154,
    121.5324,
    "https://www.secondfloorcafe.com/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "貳樓公館店提供兒童椅、兒童餐具與兒童餐點，空間與氣氛適合親子家庭用餐，環境對孩子聲音較包容。店內也會提供畫畫用品給小孩使用。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫畫用品。",
    "高",
    "西式料理",
    "",
    "https://www.secondfloorcafe.com/",
    "",
  ],
  [
    "manual-royal-host-taipei-neihu",
    "樂雅樂餐廳 內湖店",
    "台北市內湖區民權東路六段491號1樓",
    "內湖區",
    "PRICE_LEVEL_MODERATE",
    "家庭餐廳",
    25.0703,
    121.6048,
    "https://www.google.com/maps/search/?api=1&query=%E6%A8%82%E9%9B%85%E6%A8%82%20%E5%85%A7%E6%B9%96%E5%BA%97%20%E5%8F%B0%E5%8C%97",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "樂雅樂內湖店是家庭餐廳型態，提供兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。店內也會提供畫畫用品給小孩使用。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫畫用品。",
    "高",
    "西式料理",
    "",
    "",
    "",
  ],
  [
    "manual-fridays-taipei-miramar",
    "TGI FRIDAYS 星期五美式餐廳 美麗華餐廳",
    "台北市中山區敬業三路22號2樓",
    "中山區",
    "PRICE_LEVEL_MODERATE",
    "美式料理",
    25.0828,
    121.5573,
    "https://tgifridays.com.tw/locations",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "星期五美式餐廳提供兒童椅、兒童餐具與兒童餐點，美式家庭餐廳氣氛對孩子聲音較包容。店內也會提供畫畫用品給小孩使用。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫畫用品。",
    "高",
    "西式料理",
    "02-2175-3358",
    "https://tgifridays.com.tw/",
    "",
  ],
  [
    "manual-fridays-taipei-ximen",
    "TGI FRIDAYS 星期五美式餐廳 西門餐廳",
    "台北市武昌街二段72號2樓",
    "萬華區",
    "PRICE_LEVEL_MODERATE",
    "美式料理",
    25.0448,
    121.5055,
    "https://tgifridays.com.tw/locations",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "星期五美式餐廳提供兒童椅、兒童餐具與兒童餐點，美式家庭餐廳氣氛對孩子聲音較包容。店內也會提供畫畫用品給小孩使用。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫畫用品。",
    "高",
    "西式料理",
    "02-2388-0679",
    "https://tgifridays.com.tw/",
    "",
  ],
  [
    "manual-fridays-taipei-linsen",
    "TGI FRIDAYS 星期五美式餐廳 林森餐廳",
    "台北市中山區林森北路247號1、2樓",
    "中山區",
    "PRICE_LEVEL_MODERATE",
    "美式料理",
    25.0542,
    121.5251,
    "https://tgifridays.com.tw/locations",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "星期五美式餐廳提供兒童椅、兒童餐具與兒童餐點，美式家庭餐廳氣氛對孩子聲音較包容。店內也會提供畫畫用品給小孩使用。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫畫用品。",
    "高",
    "西式料理",
    "02-2511-8579",
    "https://tgifridays.com.tw/",
    "",
  ],
  [
    "manual-fridays-taipei-songgao",
    "TGI FRIDAYS 星期五美式餐廳 松高餐廳",
    "台北市信義區松高路16號3樓",
    "信義區",
    "PRICE_LEVEL_MODERATE",
    "美式料理",
    25.0397,
    121.5666,
    "https://tgifridays.com.tw/locations",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "星期五美式餐廳提供兒童椅、兒童餐具與兒童餐點，美式家庭餐廳氣氛對孩子聲音較包容。店內也會提供畫畫用品給小孩使用。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫畫用品。",
    "高",
    "西式料理",
    "02-2722-7126",
    "https://tgifridays.com.tw/",
    "",
  ],
  [
    "manual-texas-roadhouse-taipei-minsheng",
    "Texas Roadhouse 德州鮮切牛排 民生店",
    "台北市民生東路三段156號1樓",
    "松山區",
    "PRICE_LEVEL_MODERATE",
    "牛排館",
    25.0574,
    121.5487,
    "https://texasroadhouse.com.tw/locations",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "Texas Roadhouse 提供兒童椅、兒童餐具與兒童餐點，美式牛排餐廳氣氛對孩子聲音較包容。店內也會提供畫畫用品給小孩使用。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫畫用品。",
    "高",
    "西式料理",
    "02-2718-3011",
    "https://texasroadhouse.com.tw/",
    "",
  ],
  [
    "manual-texas-roadhouse-taipei-fuxing",
    "Texas Roadhouse 德州鮮切牛排 復興店",
    "台北市大安區復興南路一段219-2號1樓",
    "大安區",
    "PRICE_LEVEL_MODERATE",
    "牛排館",
    25.0398,
    121.5438,
    "https://texasroadhouse.com.tw/locations",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "Texas Roadhouse 提供兒童椅、兒童餐具與兒童餐點，美式牛排餐廳氣氛對孩子聲音較包容。店內也會提供畫畫用品給小孩使用。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫畫用品。",
    "高",
    "西式料理",
    "02-2721-6899",
    "https://texasroadhouse.com.tw/",
    "",
  ],
  [
    "manual-texas-roadhouse-taipei-songgao",
    "Texas Roadhouse 德州鮮切牛排 微風松高店",
    "台北市信義區松高路16號3樓",
    "信義區",
    "PRICE_LEVEL_MODERATE",
    "牛排館",
    25.0397,
    121.5666,
    "https://texasroadhouse.com.tw/locations",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "Texas Roadhouse 提供兒童椅、兒童餐具與兒童餐點，美式牛排餐廳氣氛對孩子聲音較包容。店內也會提供畫畫用品給小孩使用。",
    "有兒童椅、兒童餐具、兒童餐點，也提供畫畫用品。",
    "高",
    "西式料理",
    "02-2725-1030",
    "https://texasroadhouse.com.tw/",
    "",
  ],
  [
    "manual-hooters-taipei-qingcheng",
    "HOOTERS美式餐廳 慶城店",
    "台北市松山區慶城街18號",
    "松山區",
    "PRICE_LEVEL_MODERATE",
    "美式料理",
    25.0527,
    121.5451,
    "https://www.hooters.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "yes",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "unknown",
      has_diaper_table: "unknown",
    },
    "HOOTERS美式餐廳 慶城店提供兒童椅，環境較熱鬧、對孩子聲音較包容，適合親子家庭用餐。",
    "提供兒童椅，環境較熱鬧且不怕吵。",
    "高",
    "西式料理",
    "02-2716-5168",
    "https://www.hooters.com.tw/",
    "",
  ],
);

manualRecords.push(
  [
    "manual-anzu-taipei-caesar",
    "銀座杏子日式豬排 台北凱撒店",
    "台北市中正區忠孝西路一段38號",
    "中正區",
    "PRICE_LEVEL_MODERATE",
    "日式料理",
    25.0463,
    121.5163,
    "https://ikingza.com/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "銀座杏子日式豬排是日式豬排家庭餐廳，提供兒童餐點，並適合親子家庭用餐。店內也會提供畫畫用品給小孩使用。",
    "有兒童餐點，也提供畫畫用品。",
    "高",
    "日韓料理",
    "02-2311-2389",
    "https://ikingza.com/",
    "",
  ],
  [
    "manual-anzu-taipei-q-square",
    "銀座杏子日式豬排 台北京站店",
    "台北市大同區承德路一段1號4樓",
    "大同區",
    "PRICE_LEVEL_MODERATE",
    "日式料理",
    25.0493,
    121.5166,
    "https://ikingza.com/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "銀座杏子日式豬排是日式豬排家庭餐廳，提供兒童餐點，並適合親子家庭用餐。店內也會提供畫畫用品給小孩使用。",
    "有兒童餐點，也提供畫畫用品。",
    "高",
    "日韓料理",
    "02-2558-6878",
    "https://ikingza.com/",
    "",
  ],
);

manualRecords.push(
  [
    "manual-yayoi-taipei-nanjing-songjiang",
    "YAYOI彌生軒 南京松江店",
    "台北市中山區南京東路二段97號1樓",
    "中山區",
    null,
    "日式料理",
    25.0524,
    121.5328,
    "https://www.yayoi.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅、兒童餐具與兒童餐點，日式定食餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。",
    "有兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。",
    "高",
    "日韓料理",
    "",
    "https://www.yayoi.com.tw/",
    "",
  ],
  [
    "manual-yayoi-taipei-tianmu",
    "YAYOI彌生軒 天母店",
    "台北市士林區忠誠路二段70巷2號1樓",
    "士林區",
    null,
    "日式料理",
    25.1125,
    121.5317,
    "https://www.yayoi.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅、兒童餐具與兒童餐點，日式定食餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。",
    "有兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。",
    "高",
    "日韓料理",
    "",
    "https://www.yayoi.com.tw/",
    "",
  ],
  [
    "manual-yayoi-taipei-dunnan-heping",
    "YAYOI彌生軒 敦南和平店",
    "台北市大安區敦化南路二段269、271號1樓",
    "大安區",
    null,
    "日式料理",
    25.0242,
    121.5487,
    "https://www.yayoi.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅、兒童餐具與兒童餐點，日式定食餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。",
    "有兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。",
    "高",
    "日韓料理",
    "",
    "https://www.yayoi.com.tw/",
    "",
  ],
  [
    "manual-yayoi-taipei-nangang-station",
    "YAYOI彌生軒 南港車站店",
    "台北市南港區忠孝東路七段371號B1",
    "南港區",
    null,
    "日式料理",
    25.0521,
    121.606,
    "https://www.yayoi.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅、兒童餐具與兒童餐點，日式定食餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。",
    "有兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。",
    "高",
    "日韓料理",
    "",
    "https://www.yayoi.com.tw/",
    "",
  ],
  [
    "manual-yayoi-taipei-neihu-ruiguang",
    "YAYOI彌生軒 內湖瑞光店",
    "台北市內湖區瑞光路407號1樓",
    "內湖區",
    null,
    "日式料理",
    25.0784,
    121.5714,
    "https://www.yayoi.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅、兒童餐具與兒童餐點，日式定食餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。",
    "有兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。",
    "高",
    "日韓料理",
    "",
    "https://www.yayoi.com.tw/",
    "",
  ],
  [
    "manual-yayoi-taipei-shipai-zhenxing",
    "YAYOI彌生軒 石牌振興店",
    "台北市北投區振興街35號1-2樓",
    "北投區",
    null,
    "日式料理",
    25.1188,
    121.5223,
    "https://www.yayoi.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅、兒童餐具與兒童餐點，日式定食餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。",
    "有兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。",
    "高",
    "日韓料理",
    "",
    "https://www.yayoi.com.tw/",
    "",
  ],
  [
    "manual-yayoi-taipei-zhonglun-rtmart",
    "YAYOI彌生軒 中崙大潤發店",
    "台北市中山區八德路二段306號B1",
    "中山區",
    null,
    "日式料理",
    25.0473,
    121.5429,
    "https://www.yayoi.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅、兒童餐具與兒童餐點，日式定食餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。",
    "有兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。",
    "高",
    "日韓料理",
    "",
    "https://www.yayoi.com.tw/",
    "",
  ],
  [
    "manual-yayoi-taipei-main-station",
    "YAYOI彌生軒 台北車站店",
    "台北市中正區北平西路3號2樓微風台北車站6號櫃",
    "中正區",
    null,
    "日式料理",
    25.0477,
    121.517,
    "https://www.yayoi.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "yes",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅、兒童餐具與兒童餐點，日式定食餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。",
    "有兒童椅、兒童餐具與兒童餐點，環境對孩子聲音較包容。",
    "高",
    "日韓料理",
    "",
    "https://www.yayoi.com.tw/",
    "",
  ],
  [
    "manual-kura-taipei-guanqian",
    "藏壽司 台北館前店",
    "台北市中正區館前路12號5樓",
    "中正區",
    null,
    "日式料理",
    25.0455,
    121.5148,
    "https://www.kurasushi.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅與兒童餐具，迴轉壽司餐廳氣氛輕鬆熱鬧，對孩子聲音較包容。藏壽司的打卡與扭蛋遊戲設計適合親子用餐；專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境輕鬆不怕吵；有扭蛋遊戲設計。",
    "高",
    "日韓料理",
    "",
    "https://www.kurasushi.tw/",
    "",
  ],
  [
    "manual-kura-taipei-songjiang-nanjing",
    "藏壽司 松江南京店",
    "台北市中山區南京東路二段101號B1",
    "中山區",
    null,
    "日式料理",
    25.0523,
    121.5335,
    "https://www.kurasushi.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅與兒童餐具，迴轉壽司餐廳氣氛輕鬆熱鬧，對孩子聲音較包容。藏壽司的打卡與扭蛋遊戲設計適合親子用餐；專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境輕鬆不怕吵；有扭蛋遊戲設計。",
    "高",
    "日韓料理",
    "",
    "https://www.kurasushi.tw/",
    "",
  ],
  [
    "manual-kura-taipei-breeze-songgao",
    "藏壽司 微風松高店",
    "台北市信義區松高路16號B1",
    "信義區",
    null,
    "日式料理",
    25.0397,
    121.5666,
    "https://www.kurasushi.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅與兒童餐具，迴轉壽司餐廳氣氛輕鬆熱鬧，對孩子聲音較包容。藏壽司的打卡與扭蛋遊戲設計適合親子用餐；專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境輕鬆不怕吵；有扭蛋遊戲設計。",
    "高",
    "日韓料理",
    "",
    "https://www.kurasushi.tw/",
    "",
  ],
  [
    "manual-kura-taipei-xinyi-att",
    "藏壽司 信義ATT店",
    "台北市信義區松壽路12號4樓",
    "信義區",
    null,
    "日式料理",
    25.0354,
    121.5666,
    "https://www.kurasushi.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅與兒童餐具，迴轉壽司餐廳氣氛輕鬆熱鬧，對孩子聲音較包容。藏壽司的打卡與扭蛋遊戲設計適合親子用餐；專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境輕鬆不怕吵；有扭蛋遊戲設計。",
    "高",
    "日韓料理",
    "",
    "https://www.kurasushi.tw/",
    "",
  ],
  [
    "manual-kura-taipei-zhongshan-nanxi",
    "藏壽司 中山南西店",
    "台北市大同區南京西路57號2樓",
    "大同區",
    null,
    "日式料理",
    25.0524,
    121.5199,
    "https://www.kurasushi.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅與兒童餐具，迴轉壽司餐廳氣氛輕鬆熱鬧，對孩子聲音較包容。藏壽司的打卡與扭蛋遊戲設計適合親子用餐；專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境輕鬆不怕吵；有扭蛋遊戲設計。",
    "高",
    "日韓料理",
    "",
    "https://www.kurasushi.tw/",
    "",
  ],
  [
    "manual-kura-taipei-nangang-citylink",
    "藏壽司 南港CITYLINK店",
    "台北市南港區忠孝東路七段369號3樓",
    "南港區",
    null,
    "日式料理",
    25.0522,
    121.6065,
    "https://www.kurasushi.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "提供兒童椅與兒童餐具，迴轉壽司餐廳氣氛輕鬆熱鬧，對孩子聲音較包容。藏壽司的打卡與扭蛋遊戲設計適合親子用餐；專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境輕鬆不怕吵；有扭蛋遊戲設計。",
    "高",
    "日韓料理",
    "",
    "https://www.kurasushi.tw/",
    "",
  ],
);

manualRecords.push(
  [
    "manual-coco-ichibanya-taipei-shishang",
    "CoCo壱番屋 台北-聚時光科教館店",
    "台北市士林區士商路189號B1",
    "士林區",
    null,
    "日式咖哩",
    25.0959,
    121.5164,
    "https://www.ichibanya.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "CoCo壱番屋提供兒童椅與兒童餐具，日式咖哩餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境對孩子聲音較包容；兒童餐點尚未明確確認。",
    "高",
    "日韓料理",
    "02-28365589",
    "https://www.ichibanya.com.tw/",
    "",
  ],
  [
    "manual-coco-ichibanya-taipei-xinyi-a8",
    "CoCo壱番屋 台北-信義A8 Kitchen店",
    "台北市信義區松高路12號B2樓",
    "信義區",
    null,
    "日式咖哩",
    25.0384,
    121.5671,
    "https://www.ichibanya.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "CoCo壱番屋提供兒童椅與兒童餐具，日式咖哩餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境對孩子聲音較包容；兒童餐點尚未明確確認。",
    "高",
    "日韓料理",
    "02-2729-3500",
    "https://www.ichibanya.com.tw/",
    "",
  ],
  [
    "manual-coco-ichibanya-taipei-syntrend",
    "CoCo壱番屋 台北-三創店",
    "台北市中正區市民大道三段2號B2",
    "中正區",
    null,
    "日式咖哩",
    25.0453,
    121.5318,
    "https://www.ichibanya.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "CoCo壱番屋提供兒童椅與兒童餐具，日式咖哩餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境對孩子聲音較包容；兒童餐點尚未明確確認。",
    "高",
    "日韓料理",
    "02-2321-6271",
    "https://www.ichibanya.com.tw/",
    "",
  ],
  [
    "manual-coco-ichibanya-taipei-nanjing-fuxing",
    "CoCo壱番屋 台北-南京復興店",
    "台北市松山區南京東路三段259號2樓",
    "松山區",
    null,
    "日式咖哩",
    25.0521,
    121.5447,
    "https://www.ichibanya.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "CoCo壱番屋提供兒童椅與兒童餐具，日式咖哩餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境對孩子聲音較包容；兒童餐點尚未明確確認。",
    "高",
    "日韓料理",
    "02-2546-2236",
    "https://www.ichibanya.com.tw/",
    "",
  ],
  [
    "manual-coco-ichibanya-taipei-gongguan",
    "CoCo壱番屋 台北-公館台大店",
    "台北市大安區羅斯福路四段1號",
    "大安區",
    null,
    "日式咖哩",
    25.0148,
    121.5342,
    "https://www.ichibanya.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "CoCo壱番屋提供兒童椅與兒童餐具，日式咖哩餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境對孩子聲音較包容；兒童餐點尚未明確確認。",
    "高",
    "日韓料理",
    "02-8369-2980",
    "https://www.ichibanya.com.tw/",
    "",
  ],
  [
    "manual-coco-ichibanya-taipei-ximen-hanzhong",
    "CoCo壱番屋 台北-西門漢中店",
    "台北市萬華區漢中街49號2樓",
    "萬華區",
    null,
    "日式咖哩",
    25.0443,
    121.5072,
    "https://www.ichibanya.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "CoCo壱番屋提供兒童椅與兒童餐具，日式咖哩餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境對孩子聲音較包容；兒童餐點尚未明確確認。",
    "高",
    "日韓料理",
    "02-2381-8820",
    "https://www.ichibanya.com.tw/",
    "",
  ],
  [
    "manual-coco-ichibanya-taipei-songshan",
    "CoCo壱番屋 台北-松山店",
    "台北市信義區松山路11號1樓",
    "信義區",
    null,
    "日式咖哩",
    25.0492,
    121.5781,
    "https://www.ichibanya.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "CoCo壱番屋提供兒童椅與兒童餐具，日式咖哩餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境對孩子聲音較包容；兒童餐點尚未明確確認。",
    "高",
    "日韓料理",
    "02-2742-1131",
    "https://www.ichibanya.com.tw/",
    "",
  ],
  [
    "manual-coco-ichibanya-taipei-tianmu-takashimaya",
    "CoCo壱番屋 台北-天母高島屋KITCHEN店",
    "台北市士林區忠誠路二段55號B1",
    "士林區",
    null,
    "日式咖哩",
    25.1118,
    121.5313,
    "https://www.ichibanya.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "CoCo壱番屋提供兒童椅與兒童餐具，日式咖哩餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境對孩子聲音較包容；兒童餐點尚未明確確認。",
    "高",
    "日韓料理",
    "02-2834-7662",
    "https://www.ichibanya.com.tw/",
    "",
  ],
  [
    "manual-coco-ichibanya-taipei-nanjing-jianguo",
    "CoCo壱番屋 台北-南京建國店",
    "台北市中山區南京東路二段208號",
    "中山區",
    null,
    "日式咖哩",
    25.0517,
    121.5365,
    "https://www.ichibanya.com.tw/",
    {
      high_chair_available: "yes",
      kids_menu: "unknown",
      spacious_seating: "unknown",
      kid_noise_tolerant: "yes",
      has_play_area: "unknown",
      has_private_room: "unknown",
      has_tableware: "yes",
      has_diaper_table: "unknown",
    },
    "CoCo壱番屋提供兒童椅與兒童餐具，日式咖哩餐廳氣氛對孩子聲音較包容，適合親子家庭用餐。專屬兒童餐點目前未明確確認。",
    "有兒童椅與兒童餐具，環境對孩子聲音較包容；兒童餐點尚未明確確認。",
    "高",
    "日韓料理",
    "02-2501-5696",
    "https://www.ichibanya.com.tw/",
    "",
  ],
);


const extraManualRecordsPath = path.join(aiReviewDir, "manual_chain_branches.json");
if (fs.existsSync(extraManualRecordsPath)) {
  try {
    const extraManualRecords = JSON.parse(fs.readFileSync(extraManualRecordsPath, "utf8").replace(/^\uFEFF/, ""));
    if (Array.isArray(extraManualRecords)) {
      manualRecords.push(...extraManualRecords);
    }
  } catch (err) {
    console.error("Error loading manual_chain_branches.json:", err.message);
  }
}
const manualCatalogByPlaceId = new Map(
    manualRecords.map((record) => [
      record[0],
      Object.fromEntries(columns.map((column, index) => [column, record[index]])),
    ])
  );
  const skipped = [];
  const records = [];

  for (const file of aiReviewFiles) {
    const placeId = path.basename(file, ".json");
    if (temporarilyHiddenPlaceIds.has(placeId)) {
      continue;
    }

    const baseRestaurant = catalogByPlaceId.get(placeId) || manualCatalogByPlaceId.get(placeId);
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
      const manualBaseRestaurant = Object.fromEntries(columns.map((column, index) => [column, record[index]]));
      const cuisine = getCuisine(record[0], manualBaseRestaurant);
      while (record.length < columns.length) record.push("");
      record[4] = getPriceLevel(manualBaseRestaurant);
      record[5] = cuisine;
      record[8] = getRestaurantMapUrl(manualBaseRestaurant);
      record[13] = getMajorCuisines(cuisine, record[1] || "");
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











