import test from "node:test";
import assert from "node:assert/strict";
import {
    getBrandName,
    getDisplayPriceLevels,
    getDisplayPriceSymbol,
    getPriceLevels,
    inferPriceLevel,
    matchesPriceFilter,
} from "../src/search/price-filter.js";

test("brand names are normalized before price propagation", () => {
    assert.equal(getBrandName("The Cloud-9 Cafe"), "Cloud");
    assert.equal(getBrandName("An Example Restaurant"), "Example");
});

test("price inference preserves overrides, explicit data, and keyword fallback", () => {
    assert.equal(inferPriceLevel({ name: "麥當勞 台北店" }), "PRICE_LEVEL_INEXPENSIVE");
    assert.equal(
        inferPriceLevel({ name: "Codex Test Venue", price_level: "PRICE_LEVEL_EXPENSIVE" }),
        "PRICE_LEVEL_EXPENSIVE",
    );
    assert.equal(inferPriceLevel({ name: "測試無菜單私廚" }), "PRICE_LEVEL_EXPENSIVE");
    assert.equal(inferPriceLevel({ name: "測試義大利麵" }), "PRICE_LEVEL_MODERATE");
});

test("filter levels include intentional adjacent price bands", () => {
    const dualPriceRestaurant = {
        name: "雙月食品社 測試店",
        price_level: "PRICE_LEVEL_MODERATE",
    };
    assert.deepEqual(getPriceLevels(dualPriceRestaurant), [
        "PRICE_LEVEL_INEXPENSIVE",
        "PRICE_LEVEL_MODERATE",
    ]);

    const premiumRestaurant = {
        name: "Codex Premium Venue",
        price_level: "PRICE_LEVEL_VERY_EXPENSIVE",
    };
    assert.deepEqual(getPriceLevels(premiumRestaurant), [
        "PRICE_LEVEL_EXPENSIVE",
        "PRICE_LEVEL_VERY_EXPENSIVE",
    ]);
    assert.deepEqual(getDisplayPriceLevels(premiumRestaurant), ["PRICE_LEVEL_VERY_EXPENSIVE"]);
    assert.equal(getDisplayPriceSymbol(premiumRestaurant), "$$$$");
});

test("price filters match any accepted price band", () => {
    const restaurant = {
        name: "雙月食品社 測試店",
        price_level: "PRICE_LEVEL_MODERATE",
    };
    assert.equal(matchesPriceFilter(restaurant, new Set()), true);
    assert.equal(matchesPriceFilter(restaurant, new Set(["PRICE_LEVEL_INEXPENSIVE"])), true);
    assert.equal(matchesPriceFilter(restaurant, new Set(["PRICE_LEVEL_EXPENSIVE"])), false);
});
