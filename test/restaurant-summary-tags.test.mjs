import test from "node:test";
import assert from "node:assert/strict";
import { getPFSummaryTags } from "../src/restaurants/summary-tags.js";

test("summary tags describe selected matches and estimated values", () => {
    const restaurant = {
        attributes: { has_tableware: "yes", high_chair_available: "likely" },
    };
    const filters = new Set(["has_tableware", "high_chair_available"]);
    assert.equal(
        getPFSummaryTags(restaurant, filters, "High", true),
        "符合你勾選的 2/2 項：兒童餐具、兒童椅(估)",
    );
});

test("summary tags prioritize explicit misses and missing information", () => {
    assert.equal(
        getPFSummaryTags(
            { attributes: { has_tableware: "no" } },
            new Set(["has_tableware"]),
            "Needs Attention",
        ),
        "留意：無提供兒童餐具",
    );
    assert.equal(
        getPFSummaryTags(
            { attributes: {} },
            new Set(["has_tableware", "kids_menu"]),
            "Insufficient Info",
        ),
        "目前整理資料未提及兒童餐具與兒童餐",
    );
});

test("summary tags expose other amenities for low-match restaurants", () => {
    assert.equal(
        getPFSummaryTags(
            { attributes: { has_tableware: "unknown", has_play_area: "likely" } },
            new Set(["has_tableware"]),
            "Low Match",
        ),
        "具備其他特色：有遊樂區(估)",
    );
});
