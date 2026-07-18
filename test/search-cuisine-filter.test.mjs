import test from "node:test";
import assert from "node:assert/strict";
import {
    getCuisineFilterSummary,
    getCuisineGroupValues,
    getSearchableText,
    matchesCuisineFilter,
} from "../src/search/cuisine-filter.js";

test("cuisine matching accepts catalog groups and legacy cuisine values", () => {
    const restaurant = {
        cuisine_group: ["日式料理", "複合式料理"],
        cuisine: "拉麵",
    };
    assert.deepEqual(getCuisineGroupValues(restaurant), ["日式料理", "複合式料理", "拉麵"]);
    assert.equal(matchesCuisineFilter(restaurant, new Set(["日式料理"])), true);
    assert.equal(matchesCuisineFilter(restaurant, new Set(["韓式料理"])), false);
    assert.equal(matchesCuisineFilter(restaurant, new Set()), true);
});

test("cuisine labels produce compact filter summaries", () => {
    const selected = new Set(["台式/中式料理", "日式料理", "餐酒館"]);
    assert.equal(getCuisineFilterSummary(selected), "台式/中式、日式 +1");
    assert.equal(getCuisineFilterSummary(new Set()), "");
    assert.equal(getSearchableText(["日式料理", "拉麵"]), "日式料理 拉麵");
});
