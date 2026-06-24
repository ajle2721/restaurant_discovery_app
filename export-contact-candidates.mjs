import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const baseDir = process.cwd();
const indexPath = path.join(baseDir, "ai_review", "index.js");
const contactPath = path.join(baseDir, "ai_review", "contact_links.json");
const outputPath = path.join(baseDir, "contact_candidates.csv");

function readContactLinks() {
  if (!fs.existsSync(contactPath)) return {};
  return JSON.parse(fs.readFileSync(contactPath, "utf8").replace(/^\uFEFF/, ""));
}

function loadRestaurants() {
  const code = fs.readFileSync(indexPath, "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(code + "\nthis.restaurantData = restaurantData;", context);
  return context.restaurantData.map((restaurant) => ({ ...restaurant }));
}

function hasPositiveFamilyCondition(attrs = {}) {
  return [
    attrs.high_chair_available,
    attrs.has_tableware,
    attrs.has_diaper_table,
    attrs.kids_menu,
    attrs.kid_noise_tolerant,
    attrs.spacious_seating,
    attrs.has_play_area,
  ].some((value) => value === "yes" || value === "likely") ||
    ["room", "venue", "likely_room", "likely_venue", "yes", "likely"].includes(attrs.has_private_room);
}

function hasAnyContact(restaurant, contact = {}) {
  return Boolean(
    contact.phone || contact.website_url || contact.reservation_url ||
    restaurant.phone || restaurant.website_url || restaurant.reservation_url
  );
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? "\"" + text.replace(/"/g, "\"\"") + "\"" : text;
}

const contacts = readContactLinks();
const restaurants = loadRestaurants();
const candidates = restaurants
  .filter((restaurant) => hasPositiveFamilyCondition(restaurant.attributes || {}))
  .filter((restaurant) => !hasAnyContact(restaurant, contacts[restaurant.place_id] || {}))
  .sort((a, b) => {
    const rank = { "高": 0, "中": 1, "可考慮": 1, "資訊不足": 2, "需留意": 3 };
    return (rank[a.parent_friendly_level] ?? 9) - (rank[b.parent_friendly_level] ?? 9) || String(a.name).localeCompare(String(b.name), "zh-Hant");
  });

const header = ["place_id", "name", "address", "cuisine", "parent_friendly_level", "google_maps_url", "phone", "website_url", "reservation_url"];
const lines = [header.join(",")];
for (const restaurant of candidates) {
  lines.push([
    restaurant.place_id,
    restaurant.name,
    restaurant.address || restaurant.formatted_address || "",
    restaurant.cuisine || "",
    restaurant.parent_friendly_level || "",
    restaurant.google_maps_url || restaurant.url || "",
    "",
    "",
    "",
  ].map(csvEscape).join(","));
}

fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf8");
console.log(`Wrote ${candidates.length} contact candidates to ${outputPath}`);
