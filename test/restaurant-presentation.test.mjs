import test from "node:test";
import assert from "node:assert/strict";
import { normalizePriceLevels, getPriceSymbolForLevels } from "../src/restaurants/pricing.js";
import {
    fixSimplifiedAddress,
    formatAddressForCard,
    getCardDistrict,
    getDisplaySummary,
} from "../src/restaurants/presentation.js";

test("price levels are de-duplicated and sorted", () => {
    const levels = normalizePriceLevels([
        "PRICE_LEVEL_EXPENSIVE",
        "PRICE_LEVEL_INEXPENSIVE",
        "PRICE_LEVEL_EXPENSIVE",
    ]);
    assert.deepEqual(levels, ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_EXPENSIVE"]);
    assert.equal(getPriceSymbolForLevels(levels), "$ ~ $$$");
});

test("restaurant addresses are normalized for display", () => {
    const address = "台北市大安区复兴南路一段1号";
    assert.equal(fixSimplifiedAddress(address), "臺北市大安區復興南路一段1號");
    assert.equal(getCardDistrict(address), "大安區");
    assert.equal(formatAddressForCard(address, "大安區"), "大安區復興南路一段1號");
});

test("summary fallback describes known family facilities", () => {
    const restaurant = {
        cuisine: "咖啡廳",
        attributes: { high_chair_available: "yes", has_tableware: "yes" },
    };
    const summary = getDisplaySummary(restaurant, "");
    assert.match(summary, /兒童椅/);
    assert.match(summary, /兒童餐具/);
});
