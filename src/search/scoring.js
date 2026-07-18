import { isPositiveAttributeValue } from "../restaurants/attributes.js";

const familyAttributeKeys = [
    "has_tableware",
    "high_chair_available",
    "has_diaper_table",
    "kids_menu",
    "kid_noise_tolerant",
    "spacious_seating",
    "has_play_area",
    "has_private_room",
];

export function getParentFriendlyBaseScore(restaurant) {
    const level = restaurant.parent_friendly_level || "Insufficient Info";
    const levelScoreMap = {
        "高": 300,
        "High": 300,
        "中": 200,
        "Medium": 200,
        "需留意": 50,
        "Needs Attention": 50,
        "資訊不足": 0,
        "Insufficient Info": 0,
    };
    const attributes = restaurant.attributes || {};
    const knownPositiveCount = Object.values(attributes).filter(isPositiveAttributeValue).length;
    return (levelScoreMap[level] ?? 0) + knownPositiveCount;
}

export function isFullAttributeFilterMatch(restaurant, selectedFilters) {
    if (!selectedFilters || selectedFilters.size === 0) return true;
    const attributes = restaurant.attributes || {};
    return Array.from(selectedFilters).every((filter) => isPositiveAttributeValue(attributes[filter]));
}

export function getDynamicStatus(restaurant, selectedFilters) {
    const attributes = restaurant.attributes || {};
    let matchCount = 0;

    if (selectedFilters && selectedFilters.size > 0) {
        selectedFilters.forEach((filter) => {
            if (isPositiveAttributeValue(attributes[filter])) matchCount++;
        });

        const hasNo = Array.from(selectedFilters).some((filter) => attributes[filter] === "no");
        if (hasNo) {
            return { level: "Needs Attention", label: "不符合條件", class: "attention", matchCount };
        }
    }

    const allUnknown = familyAttributeKeys.every(
        (key) => !attributes[key] || attributes[key] === "unknown",
    );
    if (allUnknown) {
        return { level: "Insufficient Info", label: "資訊不足", class: "info", matchCount };
    }

    if (selectedFilters && selectedFilters.size > 0) {
        if (matchCount === selectedFilters.size) {
            return { level: "High", label: "很適合你", class: "high", matchCount };
        }
        if (matchCount >= 1) {
            return { level: "Medium", label: "可以考慮", class: "medium", matchCount };
        }

        const hasOtherPositive = familyAttributeKeys.some(
            (key) => !selectedFilters.has(key) && isPositiveAttributeValue(attributes[key]),
        );
        if (hasOtherPositive) {
            return { level: "Low Match", label: "其他友善選擇", class: "low-match", matchCount };
        }

        return { level: "Insufficient Info", label: "資訊不足", class: "info", matchCount };
    }

    const hasTableware = isPositiveAttributeValue(attributes.has_tableware);
    const hasHighChair = isPositiveAttributeValue(attributes.high_chair_available);
    const hasKidsMenu = isPositiveAttributeValue(attributes.kids_menu);
    const hasPlayArea = isPositiveAttributeValue(attributes.has_play_area);
    const isRecommended = (hasTableware && hasHighChair) || hasKidsMenu || hasPlayArea;
    const totalPositive = familyAttributeKeys.filter(
        (key) => isPositiveAttributeValue(attributes[key]),
    ).length;

    if (isRecommended) {
        return { level: "High", label: "值得推薦", class: "high", matchCount: 0 };
    }
    if (totalPositive >= 1) {
        return { level: "Medium", label: "可以考慮", class: "medium", matchCount: 0 };
    }
    return { level: "Insufficient Info", label: "資訊不足", class: "info", matchCount: 0 };
}
