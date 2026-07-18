import path from "node:path";

export const projectRoot = path.resolve(import.meta.dirname, "..", "..");
export const dataDir = path.join(projectRoot, "data");
export const aiReviewDir = path.join(dataDir, "ai_review");
export const curatedDir = path.join(dataDir, "curated");
export const generatedDir = path.join(dataDir, "generated");
export const restaurantCatalogPath = path.join(generatedDir, "restaurant-catalog.js");
export const restaurantIndexPath = path.join(projectRoot, "src", "data", "restaurant-index.js");
