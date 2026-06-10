import fs from "node:fs";
import path from "node:path";

const baseDir = "c:\\Users\\aou\\Desktop\\Alice\\Study\\side project\\restaurant map";
const aiReviewDir = path.join(baseDir, "ai_review");
const responseDir = path.join(baseDir, "response");

// 1. Read files in ai_review
const aiFiles = fs.readdirSync(aiReviewDir).filter(f => f.endsWith(".json"));
const skippedIds = [];

for (const file of aiFiles) {
    const placeId = path.basename(file, ".json");
    const responsePath = path.join(responseDir, `${placeId}.json`);
    if (!fs.existsSync(responsePath)) {
        skippedIds.push(placeId);
    }
}

console.log(`Total skipped place IDs (missing response JSON): ${skippedIds.length}`);

// 2. Build a mapping of place_id -> name
const idToName = new Map();

// Parse root index.js using regex
const indexPath = path.join(baseDir, "index.js");
if (fs.existsSync(indexPath)) {
    try {
        const indexContent = fs.readFileSync(indexPath, "utf8");
        // Regex to match "place_id": "..." and "name": "..." in close proximity
        const recordRegex = /"place_id":\s*"([^"]+)"[\s\S]*?"name":\s*"([^"]+)"/g;
        let match;
        while ((match = recordRegex.exec(indexContent)) !== null) {
            const pid = match[1].trim();
            const name = match[2].trim();
            idToName.set(pid, name);
        }
        console.log(`Parsed ${idToName.size} place_id -> name mappings from index.js`);
    } catch (err) {
        console.error("Error reading/parsing index.js:", err.message);
    }
}

// Simple CSV parser helper
function parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// Parse aggregated_restaurants.csv
const aggregatedPath = path.join(baseDir, "aggregated_restaurants.csv");
if (fs.existsSync(aggregatedPath)) {
    try {
        const content = fs.readFileSync(aggregatedPath, "utf8").replace(/^\uFEFF/, "");
        const lines = content.split(/\r?\n/);
        if (lines.length > 0) {
            const header = parseCsvLine(lines[0]);
            const nameIdx = header.indexOf("餐廳名稱");
            const urlIdx = header.indexOf("Google Map網址");
            
            if (nameIdx !== -1 && urlIdx !== -1) {
                let count = 0;
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const row = parseCsvLine(lines[i]);
                    const name = row[nameIdx];
                    const url = row[urlIdx];
                    if (name && url) {
                        const match = url.match(/query_place_id=([^&\s"]+)/);
                        if (match) {
                            const pid = match[1].trim();
                            idToName.set(pid, name.trim());
                            count++;
                        }
                    }
                }
                console.log(`Parsed ${count} place_id -> name mappings from aggregated_restaurants.csv`);
            }
        }
    } catch (err) {
        console.error("Error parsing aggregated_restaurants.csv:", err.message);
    }
}

// Parse restaurants_refined_v8.csv
const refinedPath = path.join(baseDir, "restaurants_refined_v8.csv");
if (fs.existsSync(refinedPath)) {
    try {
        const content = fs.readFileSync(refinedPath, "utf8").replace(/^\uFEFF/, "");
        const lines = content.split(/\r?\n/);
        if (lines.length > 0) {
            const header = parseCsvLine(lines[0]);
            const idIdx = header.indexOf("place_id");
            const nameIdx = header.indexOf("name");
            
            if (idIdx !== -1 && nameIdx !== -1) {
                let count = 0;
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const row = parseCsvLine(lines[i]);
                    const pid = row[idIdx];
                    const name = row[nameIdx];
                    if (pid && name) {
                        idToName.set(pid.trim(), name.trim());
                        count++;
                    }
                }
                console.log(`Parsed ${count} place_id -> name mappings from restaurants_refined_v8.csv`);
            }
        }
    } catch (err) {
        console.error("Error parsing restaurants_refined_v8.csv:", err.message);
    }
}

// 3. Compile results for skipped place IDs
const results = [];
for (const pid of skippedIds) {
    const name = idToName.get(pid) || "Unknown Name (未能從現有資料比對出店名)";
    results.push({ placeId: pid, name: name });
}

// Sort by name
results.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

console.log("\n--- List of Restaurants Missing Response Data ---");
results.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name} (${item.placeId})`);
});

// Write to scratch folder
const outPath = path.join(baseDir, "scratch", "skipped_restaurants_list.txt");
const fileContent = "List of Restaurants with missing response data:\n" +
    results.map((item, index) => `${index + 1}. ${item.name} (Place ID: ${item.placeId})`).join("\n");
fs.writeFileSync(outPath, fileContent, "utf8");
console.log(`\nWritten details to ${outPath}`);
