import fs from "node:fs";
import vm from "node:vm";

export function loadRestaurantCatalog(catalogPath) {
    if (!fs.existsSync(catalogPath)) {
        throw new Error(`${catalogPath} is required as the restaurant catalog.`);
    }

    const code = fs.readFileSync(catalogPath, "utf8");
    const context = {};
    vm.createContext(context);
    vm.runInContext(`${code}\nthis.restaurantData = restaurantData;`, context);
    if (!Array.isArray(context.restaurantData)) {
        throw new Error(`Unable to load restaurantData from ${catalogPath}.`);
    }
    return context.restaurantData.map((restaurant) => ({ ...restaurant }));
}
