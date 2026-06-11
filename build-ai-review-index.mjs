import fs from "node:fs";
import path from "node:path";

const baseDir = process.cwd();
const aiReviewDir = path.join(baseDir, "ai_review");
const responseDir = path.join(baseDir, "response");
const outputPath = path.join(aiReviewDir, "index.js");

const taipeiDistricts = [
  "中正區",
  "大同區",
  "中山區",
  "松山區",
  "大安區",
  "萬華區",
  "信義區",
  "士林區",
  "北投區",
  "內湖區",
  "南港區",
  "文山區",
];

function readJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    // Strip UTF-8 BOM if present
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
  return "unknown";
}

function buildGoogleMapsUrl(name, placeId) {
  const query = encodeURIComponent(name || "");
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`;
}

function extractDistrict(address) {
  return taipeiDistricts.find((district) => address.includes(district)) || "";
}

function getAiAttributes(aiReview, response) {
  let high_chair = normalizeResult(
    aiReview[" child_seat available"]?.result ||
      aiReview["child_seat available"]?.result ||
      aiReview["High chair available"]?.result
  );
  let tableware = normalizeResult(aiReview.has_tableware?.result);
  let kids_menu_attr = normalizeResult(aiReview["Kids menu available"]?.result);
  let diaper_table = normalizeResult(aiReview.has_diaper_table?.result);

  // If yes result is purely from Google Maps attributes override in evaluate_reviews_llm.py, demote to "likely"
  const isGoogleEvidence = (evidence) => {
    if (!evidence) return false;
    return String(evidence).trim().toLowerCase().startsWith("google");
  };

  const isGoogleOnlyHighChair = high_chair === "yes" && 
    (isGoogleEvidence(aiReview[" child_seat available"]?.evidence) ||
     isGoogleEvidence(aiReview["child_seat available"]?.evidence) ||
     isGoogleEvidence(aiReview["High chair available"]?.evidence));

  const isGoogleOnlyTableware = tableware === "yes" && 
    isGoogleEvidence(aiReview.has_tableware?.evidence);

  if (isGoogleOnlyHighChair) high_chair = "likely";
  if (isGoogleOnlyTableware) tableware = "likely";

  if (response?.goodForChildren === true) {
    if (high_chair !== "yes") high_chair = "likely";
    if (tableware !== "yes") tableware = "likely";
  }

  if (response?.menuForChildren === true) {
    kids_menu_attr = "yes";
  }

  const addr = (response?.formattedAddress || "").toLowerCase();
  const name = (response?.displayName?.text || "").toLowerCase();
  const mallKeywords = [
    "新光三越", "sogo", "遠東百貨", "遠百", "微風", "breeze", 
    "統一時代", "京站", "qsquare", "美麗華", "誠品", "att 4 fun", 
    "環球", "global mall", "大葉高島屋", "大葉髙島屋", "bellavita", 
    "兒童新樂園", "101", "citylink", "明曜百貨", "忠泰樂生活", 
    "台北車站", "南港車站", "松山車站", "科教館", "天文館", "動物園"
  ];
  
  const inMallOrPark = mallKeywords.some(kw => addr.includes(kw) || name.includes(kw));
  if (inMallOrPark) {
    diaper_table = "yes";
  }

  return {
    high_chair_available: high_chair,
    kids_menu: kids_menu_attr,
    spacious_seating: normalizeResult(aiReview["Spacious seating"]?.result),
    kid_noise_tolerant: normalizeResult(aiReview.kid_noise_tolerant?.result),
    has_play_area: normalizeResult(aiReview.has_play_area?.result),
    has_private_room: normalizeResult(aiReview.has_private_room?.result),
    has_tableware: tableware,
    has_diaper_table: diaper_table,
  };
}

function cleanRestaurantName(name) {
  if (!name) return "";
  let cleaned = name;
  const regex = /([\(|（|\[|【])(.*?)([\)|）|\]|】])/g;
  cleaned = cleaned.replace(regex, (match, open, content, close) => {
    const trimmed = content.trim();
    const isBranch = /店$|館$|房$|室$|LalaPort$/i.test(trimmed);
    const hasStuffing = /點餐|最後|供餐|推薦|美食|宵夜|捷運|訂位|不限時|外送|不提供|店休|僅收|只收|現金|／|\/|\||｜/g.test(trimmed);
    if ((isBranch || !hasStuffing) && trimmed.length <= 12) {
      return match;
    } else {
      return "";
    }
  });
  cleaned = cleaned.replace(/[\(|（|\[|【][^\)|）|\]|】]*$/g, '');
  cleaned = cleaned.replace(/[\/|／|\||｜].*$/g, '');
  return cleaned.trim();
}

function buildRecord(placeId) {
  const response = readJson(path.join(responseDir, `${placeId}.json`));
  const aiReview = readJson(path.join(aiReviewDir, `${placeId}.json`));

  const rawName = response.displayName?.text || "";
  const name = cleanRestaurantName(rawName);
  const formattedAddress = response.formattedAddress || "";
  const googleMapsUrl = buildGoogleMapsUrl(name, placeId);
  const priceLevel = response.priceLevel || null;
  
  // Extract cuisine from types
  const cuisineMap = {
    'italian_restaurant': '義大利料理',
    'japanese_restaurant': '日式料理',
    'korean_restaurant': '韓式料理',
    'chinese_restaurant': '中式料理',
    'thai_restaurant': '泰式料理',
    'french_restaurant': '法式料理',
    'american_restaurant': '美式料理',
    'mexican_restaurant': '墨西哥料理',
    'vietnamese_restaurant': '越南料理',
    'vegetarian_restaurant': '蔬食料理',
    'steak_house': '牛排館',
    'sushi_restaurant': '壽司',
    'pizza_restaurant': '披薩',
    'ramen_restaurant': '拉麵',
    'cafe': '咖啡廳',
    'bakery': '烘焙/甜點',
    'bar': '酒吧/餐酒館',
    'bistro': '小酒館/餐酒館',
    'brunch_restaurant': '早午餐'
  };

  let cuisine = null;
  if (Array.isArray(response.types)) {
    // Find the first matching cuisine type
    const matchedType = response.types.find(t => cuisineMap[t]);
    if (matchedType) {
      const cuisineLabel = cuisineMap[matchedType];
      // Rule: If name already contains the cuisine label, don't repeat it
      if (!name.includes(cuisineLabel) && !name.toLowerCase().includes(matchedType.split('_')[0])) {
        cuisine = cuisineLabel;
      }
    }
  }

  return [
    placeId,
    name,
    formattedAddress,
    extractDistrict(formattedAddress),
    String(response.rating ?? ""),
    response.userRatingCount ?? 0,
    priceLevel,
    cuisine,
    response.location?.latitude ?? null,
    response.location?.longitude ?? null,
    googleMapsUrl,
    getAiAttributes(aiReview, response),
    aiReview.generated_summary || "",
    aiReview.card_summary || "",
    aiReview.parent_friendly_level || "資訊不足",
  ];
}

function main() {
  const aiReviewFiles = fs
    .readdirSync(aiReviewDir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const skipped = [];
  const records = [];

  for (const file of aiReviewFiles) {
    const placeId = path.basename(file, ".json");
    const responsePath = path.join(responseDir, `${placeId}.json`);
    if (!fs.existsSync(responsePath)) {
      skipped.push(placeId);
      continue;
    }
    records.push(buildRecord(placeId));
  }

  const columns = [
    "place_id",
    "name",
    "address",
    "district",
    "rating",
    "user_ratings_total",
    "price_level",
    "cuisine",
    "latitude",
    "longitude",
    "url",
    "attributes",
    "ai_summary",
    "card_summary",
    "parent_friendly_level"
  ];

  const content = `const columns = ${JSON.stringify(columns)};\n\nconst rows = ${JSON.stringify(records)};\n\nconst restaurantData = [];\nfor (let i = 0; i < rows.length; i++) {\n  Object.defineProperty(restaurantData, i, {\n    get() {\n      const row = rows[i];\n      const obj = {};\n      columns.forEach((col, k) => {\n        obj[col] = row[k];\n      });\n      obj.formatted_address = obj.address;\n      obj.google_maps_url = obj.url;\n      Object.defineProperty(restaurantData, i, {\n        value: obj,\n        writable: true,\n        configurable: true,\n        enumerable: true\n      });\n      return obj;\n    },\n    configurable: true,\n    enumerable: true\n  });\n}\n`;
  fs.writeFileSync(outputPath, content, "utf8");

  console.log(`Built ${outputPath} with ${records.length} restaurants.`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} records with missing response JSON.`);
  }
}

main();
