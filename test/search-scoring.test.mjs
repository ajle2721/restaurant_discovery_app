import test from "node:test";
import assert from "node:assert/strict";
import {
    getDynamicStatus,
    getParentFriendlyBaseScore,
    isFullAttributeFilterMatch,
} from "../src/search/scoring.js";

test("base score combines the catalog level and known positive attributes", () => {
    const restaurant = {
        parent_friendly_level: "High",
        attributes: {
            has_tableware: "yes",
            high_chair_available: "likely",
            kids_menu: "no",
        },
    };
    assert.equal(getParentFriendlyBaseScore(restaurant), 302);
});

test("selected family filters distinguish full, partial, and rejected matches", () => {
    const selectedFilters = new Set(["has_tableware", "high_chair_available"]);

    assert.deepEqual(
        getDynamicStatus({ attributes: { has_tableware: "yes", high_chair_available: "likely" } }, selectedFilters),
        { level: "High", label: "很適合你", class: "high", matchCount: 2 },
    );
    assert.deepEqual(
        getDynamicStatus({ attributes: { has_tableware: "yes", high_chair_available: "unknown" } }, selectedFilters),
        { level: "Medium", label: "可以考慮", class: "medium", matchCount: 1 },
    );
    assert.deepEqual(
        getDynamicStatus({ attributes: { has_tableware: "yes", high_chair_available: "no" } }, selectedFilters),
        { level: "Needs Attention", label: "不符合條件", class: "attention", matchCount: 1 },
    );
});

test("unselected amenities remain visible as other family-friendly choices", () => {
    const status = getDynamicStatus(
        { attributes: { has_tableware: "unknown", has_play_area: "yes" } },
        new Set(["has_tableware"]),
    );
    assert.deepEqual(status, {
        level: "Low Match",
        label: "其他友善選擇",
        class: "low-match",
        matchCount: 0,
    });
});

test("default recommendations and missing data retain their original levels", () => {
    assert.equal(
        getDynamicStatus({ attributes: { kids_menu: "yes" } }, new Set()).level,
        "High",
    );
    assert.equal(
        getDynamicStatus({ attributes: { spacious_seating: "yes" } }, new Set()).level,
        "Medium",
    );
    assert.equal(getDynamicStatus({ attributes: {} }, new Set()).level, "Insufficient Info");
});

test("full attribute matching accepts estimated positive values", () => {
    const restaurant = {
        attributes: { has_tableware: "likely", high_chair_available: "yes" },
    };
    assert.equal(
        isFullAttributeFilterMatch(
            restaurant,
            new Set(["has_tableware", "high_chair_available"]),
        ),
        true,
    );
    assert.equal(
        isFullAttributeFilterMatch(restaurant, new Set(["has_diaper_table"])),
        false,
    );
});
