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
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function getAiAttributes(aiReview) {
  return {
    high_chair_available: normalizeResult(
      aiReview[" child_seat available"]?.result ||
        aiReview["child_seat available"]?.result ||
        aiReview["High chair available"]?.result,
    ),
    kids_menu: normalizeResult(aiReview["Kids menu available"]?.result),
    spacious_seating: normalizeResult(aiReview["Spacious seating"]?.result),
    kid_noise_tolerant: normalizeResult(aiReview.kid_noise_tolerant?.result),
  };
}

function buildRecord(placeId) {
  const response = readJson(path.join(responseDir, `${placeId}.json`));
  const aiReview = readJson(path.join(aiReviewDir, `${placeId}.json`));

  const name = response.displayName?.text || "";
  const formattedAddress = response.formattedAddress || "";
  const googleMapsUrl = buildGoogleMapsUrl(name, placeId);
  const signals = Array.isArray(aiReview.generated_signals)
    ? aiReview.generated_signals
    : aiReview.generated_signals
      ? [aiReview.generated_signals]
      : [];

  return {
    place_id: placeId,
    name,
    address: formattedAddress,
    formatted_address: formattedAddress,
    district: extractDistrict(formattedAddress),
    rating: String(response.rating ?? ""),
    user_ratings_total: response.userRatingCount ?? 0,
    latitude: response.location?.latitude ?? null,
    longitude: response.location?.longitude ?? null,
    url: googleMapsUrl,
    google_maps_url: googleMapsUrl,
    attributes: getAiAttributes(aiReview),
    ai_summary: aiReview.generated_summary || "",
    signals,
    parent_friendly_score: aiReview.parent_friendly_score ?? 0,
    parent_friendly_level: aiReview.parent_friendly_level || "資訊不足",
    reason: aiReview.reason || "綜合評估",
    reviews: Array.isArray(response.reviews) ? response.reviews : [],
  };
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

  const content = `const restaurantData = ${JSON.stringify(records, null, 2)};\n`;
  fs.writeFileSync(outputPath, content, "utf8");

  console.log(`Built ${outputPath} with ${records.length} restaurants.`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} records with missing response JSON.`);
  }
}

main();
