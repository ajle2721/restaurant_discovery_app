import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const baseDir = process.cwd();
const aiReviewDir = path.join(baseDir, "ai_review");
const outputPath = path.join(aiReviewDir, "index.js");

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
];

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
  return nextValue === "unknown" ? normalizeResult(existingValue) : nextValue;
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

function getAiAttributes(aiReview, existingAttributes = {}) {
  let highChair = normalizeResult(
    aiReview[" child_seat available"]?.result ||
      aiReview["child_seat available"]?.result ||
      aiReview["High chair available"]?.result
  );
  let tableware = normalizeResult(aiReview.has_tableware?.result);

  if (
    highChair === "yes" &&
    hasGoogleEvidence(
      aiReview[" child_seat available"]?.evidence,
      aiReview["child_seat available"]?.evidence,
      aiReview["High chair available"]?.evidence
    )
  ) {
    highChair = "likely";
  }

  if (tableware === "yes" && hasGoogleEvidence(aiReview.has_tableware?.evidence)) {
    tableware = "likely";
  }

  return {
    ...existingAttributes,
    high_chair_available: keepExistingWhenUnknown(
      highChair,
      existingAttributes.high_chair_available
    ),
    kids_menu: keepExistingWhenUnknown(
      normalizeResult(aiReview["Kids menu available"]?.result),
      existingAttributes.kids_menu
    ),
    spacious_seating: keepExistingWhenUnknown(
      normalizeResult(aiReview["Spacious seating"]?.result),
      existingAttributes.spacious_seating
    ),
    kid_noise_tolerant: keepExistingWhenUnknown(
      normalizeResult(aiReview.kid_noise_tolerant?.result),
      existingAttributes.kid_noise_tolerant
    ),
    has_play_area: keepExistingWhenUnknown(
      normalizeResult(aiReview.has_play_area?.result),
      existingAttributes.has_play_area
    ),
    has_private_room: keepExistingWhenUnknown(
      getPrivateRoomValue(aiReview),
      existingAttributes.has_private_room
    ),
    has_tableware: keepExistingWhenUnknown(
      tableware,
      existingAttributes.has_tableware
    ),
    has_diaper_table: keepExistingWhenUnknown(
      normalizeResult(aiReview.has_diaper_table?.result),
      existingAttributes.has_diaper_table
    ),
  };
}

function buildRecord(placeId, baseRestaurant, aiReview) {
  const attributes = getAiAttributes(aiReview, baseRestaurant.attributes || {});

  return [
    placeId,
    baseRestaurant.name || "",
    baseRestaurant.address || baseRestaurant.formatted_address || "",
    baseRestaurant.district || "",
    baseRestaurant.price_level ?? null,
    baseRestaurant.cuisine ?? null,
    baseRestaurant.latitude ?? null,
    baseRestaurant.longitude ?? null,
    baseRestaurant.url || baseRestaurant.google_maps_url || "",
    attributes,
    neutralizeSummarySourceCopy(aiReview.generated_summary || baseRestaurant.ai_summary || "", attributes.has_private_room),
    neutralizeSummarySourceCopy(aiReview.card_summary || baseRestaurant.card_summary || "", attributes.has_private_room),
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
    const baseRestaurant = catalogByPlaceId.get(placeId);
    if (!baseRestaurant) {
      skipped.push(placeId);
      continue;
    }
    const aiReview = readJson(path.join(aiReviewDir, file));
    records.push(buildRecord(placeId, baseRestaurant, aiReview));
  }

  writeIndex(records);

  console.log(`Built ${outputPath} with ${records.length} restaurants.`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} records missing from ai_review/index.js.`);
  }
}

main();
