export const priceSymbols = {
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

export const priceLevelOrder = [
    "PRICE_LEVEL_INEXPENSIVE",
    "PRICE_LEVEL_MODERATE",
    "PRICE_LEVEL_EXPENSIVE",
    "PRICE_LEVEL_VERY_EXPENSIVE",
];

export function normalizePriceLevels(priceLevel) {
    const rawLevels = Array.isArray(priceLevel) ? priceLevel : (priceLevel ? [priceLevel] : []);
    const validLevels = rawLevels.filter((level) => priceLevelOrder.includes(level));
    return [...new Set(validLevels)].sort(
        (left, right) => priceLevelOrder.indexOf(left) - priceLevelOrder.indexOf(right),
    );
}

export function getPriceSymbolForLevels(levels) {
    if (!levels || levels.length === 0) return "";
    if (levels.length === 1) return priceSymbols[levels[0]] || "";
    return levels.map((level) => priceSymbols[level]).filter(Boolean).join(" ~ ");
}
