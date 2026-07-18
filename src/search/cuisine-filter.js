export function hasCuisineFilters(cuisineFilter) {
    return Boolean(cuisineFilter && cuisineFilter.size > 0);
}

export function getCuisineGroupValues(restaurant) {
    const values = [];
    if (Array.isArray(restaurant.cuisine_group)) {
        values.push(...restaurant.cuisine_group);
    } else if (restaurant.cuisine_group) {
        values.push(restaurant.cuisine_group);
    }
    if (restaurant.cuisine) values.push(restaurant.cuisine);
    return values.filter(Boolean);
}

export function getSearchableText(value) {
    if (Array.isArray(value)) return value.filter(Boolean).join(" ");
    return value ? String(value) : "";
}

export function matchesCuisineFilter(restaurant, cuisineFilter) {
    if (!hasCuisineFilters(cuisineFilter)) return true;
    return getCuisineGroupValues(restaurant).some((cuisine) => cuisineFilter.has(cuisine));
}

export function getCuisineFilterLabel(cuisine) {
    const labels = {
        "台式/中式料理": "台式/中式",
        "日式料理": "日式",
        "韓式料理": "韓式",
        "義式料理": "義式",
        "西式料理": "歐美/西式",
        "星馬料理": "星馬/泰越",
        "罕見異國料理": "異國料理",
        "茶館與咖啡廳": "咖啡/甜點",
        "餐酒館": "餐酒館",
        "複合式料理": "複合式",
    };
    return labels[cuisine] || (cuisine ? cuisine.replace(/料理$/, "") : "");
}

export function getCuisineFilterSummary(cuisineFilter) {
    if (!hasCuisineFilters(cuisineFilter)) return "";
    const labels = Array.from(cuisineFilter).map(getCuisineFilterLabel);
    if (labels.length <= 2) return labels.join("、");
    return `${labels.slice(0, 2).join("、")} +${labels.length - 2}`;
}
