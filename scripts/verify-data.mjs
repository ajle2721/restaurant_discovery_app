import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
    aiReviewDir,
    curatedDir,
    restaurantCatalogPath,
    restaurantIndexPath,
} from "./lib/paths.mjs";
import { loadRestaurantCatalog } from "./lib/catalog.mjs";

const REQUIRED_CURATED_FILES = [
    "brand_rules.json",
    "contact_links.json",
    "cuisines_mapping.json",
    "manual_chain_branches.json",
];
const REQUIRED_RESTAURANT_FIELDS = ["place_id", "name", "address", "attributes"];

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function verifySourceRecords() {
    const files = fs.readdirSync(aiReviewDir).filter((file) => file.endsWith(".json")).sort();
    assert(files.length > 0, "No restaurant analysis JSON files were found.");

    for (const file of files) {
        const value = readJson(path.join(aiReviewDir, file));
        assert(value && typeof value === "object" && !Array.isArray(value), `${file} must contain an object.`);
    }
    return files.length;
}

function verifyCuratedData() {
    for (const file of REQUIRED_CURATED_FILES) {
        const filePath = path.join(curatedDir, file);
        assert(fs.existsSync(filePath), `Missing curated data file: ${file}`);
        const value = readJson(filePath);
        assert(value && typeof value === "object", `${file} must contain an object or array.`);
    }
}

async function verifyBrowserIndex() {
    assert(fs.existsSync(restaurantIndexPath), "Generated browser index is missing.");
    const moduleUrl = `${pathToFileURL(restaurantIndexPath).href}?verify=${Date.now()}`;
    const { restaurantData } = await import(moduleUrl);
    assert(Array.isArray(restaurantData), "Generated restaurantData must be an array.");

    const ids = new Set();
    for (const restaurant of restaurantData) {
        for (const field of REQUIRED_RESTAURANT_FIELDS) {
            assert(restaurant[field] !== undefined && restaurant[field] !== null, `Missing ${field} in ${restaurant.place_id || "unknown record"}.`);
        }
        assert(!ids.has(restaurant.place_id), `Duplicate place_id: ${restaurant.place_id}`);
        ids.add(restaurant.place_id);
    }
    return restaurantData.length;
}

const sourceCount = verifySourceRecords();
verifyCuratedData();
const catalogCount = loadRestaurantCatalog(restaurantCatalogPath).length;
const browserCount = await verifyBrowserIndex();

assert(browserCount >= sourceCount, "Generated browser index unexpectedly has fewer records than source analyses.");
console.log(`Data verified: ${sourceCount} analyses, ${catalogCount} catalog records, ${browserCount} browser records.`);
