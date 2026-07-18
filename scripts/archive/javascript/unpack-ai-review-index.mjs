import fs from "node:fs";
import path from "node:path";

const baseDir = process.cwd();
const aiReviewDir = path.join(baseDir, "ai_review");
const indexJsPath = path.join(aiReviewDir, "index.js");

function mapValue(val) {
  const str = String(val || "").trim().toLowerCase();
  if (str === "yes") return "Yes";
  if (str === "no") return "No";
  return "Unknown";
}

function main() {
  console.log("Unpacking index.js back to individual JSON files (Node.js version)...");

  if (!fs.existsSync(indexJsPath)) {
    console.error(`Error: ${indexJsPath} does not exist.`);
    process.exit(1);
  }

  const content = fs.readFileSync(indexJsPath, "utf8");
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");

  if (start === -1 || end === -1) {
    console.error("Error: Could not locate JSON array inside index.js.");
    process.exit(1);
  }

  const jsonStr = content.substring(start, end + 1);
  let records;
  try {
    records = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`Error parsing JSON from index.js: ${err.message}`);
    process.exit(1);
  }

  console.log(`Parsed ${records.length} records from index.js.`);

  let updatedCount = 0;
  let createdCount = 0;

  for (const record of records) {
    const placeId = record.place_id;
    if (!placeId) continue;

    const jsonPath = path.join(aiReviewDir, `${placeId}.json`);
    let aiReviewData = {};

    if (fs.existsSync(jsonPath)) {
      try {
        const fileContent = fs.readFileSync(jsonPath, "utf8");
        // Strip BOM if present
        aiReviewData = JSON.parse(fileContent.replace(/^\uFEFF/, ""));
        updatedCount++;
      } catch (err) {
        console.warn(`Error reading existing file ${jsonPath}: ${err.message}. Overwriting.`);
        aiReviewData = {};
        createdCount++;
      }
    } else {
      aiReviewData = {};
      createdCount++;
    }

    // 1. Map attributes
    const attrs = record.attributes || {};
    
    // High chair mapping: check for keys in the existing JSON data
    let highChairKey = "child_seat available";
    for (const k of [" child_seat available", "child_seat available", "High chair available"]) {
      if (k in aiReviewData) {
        highChairKey = k;
        break;
      }
    }

    const attrMapping = {
      high_chair_available: highChairKey,
      kids_menu: "Kids menu available",
      spacious_seating: "Spacious seating",
      kid_noise_tolerant: "kid_noise_tolerant",
      has_play_area: "has_play_area",
      has_private_room: "has_private_room",
      has_tableware: "has_tableware",
      has_diaper_table: "has_diaper_table",
    };

    for (const [indexKey, jsonKey] of Object.entries(attrMapping)) {
      if (indexKey in attrs) {
        const newVal = mapValue(attrs[indexKey]);
        if (jsonKey in aiReviewData && typeof aiReviewData[jsonKey] === "object" && aiReviewData[jsonKey] !== null) {
          aiReviewData[jsonKey].result = newVal;
          if ((newVal === "Yes" || newVal === "No") && (aiReviewData[jsonKey].confidence || 0) <= 0.4) {
            aiReviewData[jsonKey].confidence = 1.0;
          }
        } else {
          aiReviewData[jsonKey] = {
            result: newVal,
            evidence: null,
            confidence: newVal !== "Unknown" ? 1.0 : 0.4,
          };
        }
      }
    }

    // 2. Map other top-level fields
    aiReviewData.generated_summary = record.ai_summary || "";
    aiReviewData.card_summary = record.card_summary || "";
    aiReviewData.generated_signals = record.signals || [];
    aiReviewData.parent_friendly_score = record.parent_friendly_score ?? 0;
    aiReviewData.parent_friendly_level = record.parent_friendly_level || "資訊不足";
    aiReviewData.reason = record.reason || "綜合評估";

    // Write back to file using UTF-8 and 4-space indentation
    fs.writeFileSync(jsonPath, JSON.stringify(aiReviewData, null, 4), "utf8");
  }

  console.log(`Done! Updated ${updatedCount} files, created ${createdCount} files in ${aiReviewDir}.`);
}

main();
