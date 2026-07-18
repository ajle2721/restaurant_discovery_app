import { trackEvent } from "../analytics/events.js";
import { restaurantData } from "../data/restaurant-index.js";
import {
    attributeIcons,
    attributeLabels,
    levelLabels,
} from "../restaurants/attributes.js";
import { state } from "../state/app-state.js";
import {
    getCuisineFilterLabel,
    getSearchableText,
    hasCuisineFilters,
    matchesCuisineFilter,
} from "./cuisine-filter.js";
import { calculateDistance } from "./distance.js";
import { matchesPriceFilter } from "./price-filter.js";
import {
    getDynamicStatus,
    isFullAttributeFilterMatch,
} from "./scoring.js";

const priceLabels = {
    PRICE_LEVEL_INEXPENSIVE: '💰 平價',
    PRICE_LEVEL_MODERATE: '💵 中價',
    PRICE_LEVEL_EXPENSIVE: '💎 高價',
};

const cuisineEmojis = {
    '台式/中式料理': '🥟',
    '日式料理': '🍣',
    '韓式料理': '🍲',
    '義式料理': '🍕',
    '西式料理': '🥩',
    '星馬料理': '🍛',
    '罕見異國料理': '🌮',
    '茶館與咖啡廳': '☕',
    '餐酒館': '🍷',
    '複合式料理': '🥗',
};

const resultPriority = {
    High: 5,
    Medium: 4,
    'Low Match': 3,
    'Insufficient Info': 2,
    'Needs Attention': 1,
};

export function createResultsController({
    renderCard,
    renderMap,
    selectLocation,
    showToast,
    updateShowResultsButton,
}) {
    function renderActiveFilters() {
        const activeFiltersBar = document.getElementById('active-filters-bar');
        if (!activeFiltersBar) return;

        activeFiltersBar.innerHTML = '';
        const hasAttributes = state.filters && state.filters.size > 0;
        const hasCuisine = hasCuisineFilters(state.cuisineFilter);
        const hasPrice = state.priceFilter && state.priceFilter.size > 0;

        if (!hasAttributes && !hasCuisine && !hasPrice) {
            activeFiltersBar.classList.add('hidden');
            return;
        }

        activeFiltersBar.classList.remove('hidden');

        if (hasPrice) {
            state.priceFilter.forEach(price => {
                const indicator = document.createElement('span');
                indicator.className = 'filter-indicator-mini filter-price-indicator';
                indicator.textContent = priceLabels[price] || price;
                activeFiltersBar.appendChild(indicator);
            });
        }

        if (hasCuisine) {
            state.cuisineFilter.forEach(cuisine => {
                const indicator = document.createElement('span');
                indicator.className = 'filter-indicator-mini filter-cuisine-indicator';
                const emoji = cuisineEmojis[cuisine] || '🍽️';
                indicator.textContent = `${emoji} ${getCuisineFilterLabel(cuisine)}`;
                activeFiltersBar.appendChild(indicator);
            });
        }

        if (hasAttributes) {
            state.filters.forEach(filter => {
                const icon = attributeIcons[filter] || '✨';
                const label = attributeLabels[filter] || filter;
                const indicator = document.createElement('span');
                indicator.className = 'filter-indicator-mini';
                indicator.textContent = `${icon} ${label}`;
                activeFiltersBar.appendChild(indicator);
            });
        }
    }

    function filterByLocation(center) {
        restaurantData.forEach(restaurant => {
            restaurant.distance = calculateDistance(
                center.lat,
                center.lng,
                restaurant.latitude,
                restaurant.longitude,
            );
        });

        if (center.type === '多行政區') {
            return restaurantData.filter(restaurant => (
                restaurant.district && center.districts.includes(restaurant.district)
            ));
        }

        if (center.type === '行政區') {
            return restaurantData.filter(restaurant => restaurant.district === center.name);
        }

        if (center.type === '多地點') {
            return restaurantData.filter(restaurant => {
                let matched = false;
                let minDistance = Infinity;

                center.locations.forEach(location => {
                    if (location.type === '行政區') {
                        if (restaurant.district === location.name) {
                            matched = true;
                            const distance = calculateDistance(
                                location.lat,
                                location.lng,
                                restaurant.latitude,
                                restaurant.longitude,
                            );
                            minDistance = Math.min(minDistance, distance);
                        }
                        return;
                    }

                    const distance = calculateDistance(
                        location.lat,
                        location.lng,
                        restaurant.latitude,
                        restaurant.longitude,
                    );
                    let maxRadius = location.type === '全市' ? 99999 : 1.5;
                    if (state.expandedRadius) {
                        maxRadius = location.type === '全市' ? 99999 : 3;
                    }

                    if (distance <= maxRadius) {
                        matched = true;
                        minDistance = Math.min(minDistance, distance);
                    }
                });

                if (matched) restaurant.distance = minDistance;
                return matched;
            });
        }

        if (center.type === '捷運站周邊') {
            const mrtStations = state.locationData.filter(location => (
                location.type === '捷運站' || location.name.endsWith('站')
            ));
            return restaurantData.filter(restaurant => {
                const minDistance = mrtStations.reduce((nearest, mrt) => {
                    const distance = calculateDistance(
                        mrt.lat,
                        mrt.lng,
                        restaurant.latitude,
                        restaurant.longitude,
                    );
                    return Math.min(nearest, distance);
                }, Infinity);
                restaurant.distance = minDistance;
                return minDistance <= 0.8;
            });
        }

        if (center.keyword) {
            const query = center.keyword.toLowerCase();
            return restaurantData.filter(restaurant => (
                (restaurant.name && restaurant.name.toLowerCase().includes(query))
                || (restaurant.address && restaurant.address.toLowerCase().includes(query))
                || (restaurant.cuisine && restaurant.cuisine.toLowerCase().includes(query))
                || getSearchableText(restaurant.cuisine_group).toLowerCase().includes(query)
                || (restaurant.district && restaurant.district.toLowerCase().includes(query))
            ));
        }

        let maxRadius = center.type === '全市' || center.name === '整個台北市' ? 99999 : 1.5;
        if (state.expandedRadius) {
            maxRadius = center.type === '全市' || center.name === '整個台北市' ? 99999 : 3;
        }
        return restaurantData.filter(restaurant => restaurant.distance <= maxRadius);
    }

    function sortResults(restaurants) {
        restaurants.forEach(restaurant => {
            const status = getDynamicStatus(restaurant, state.filters);
            restaurant.dynamicLevel = status.level;
            restaurant.dynamicStatus = status;
        });

        return restaurants.sort((first, second) => {
            const priorityDifference = (resultPriority[second.dynamicLevel] || 0)
                - (resultPriority[first.dynamicLevel] || 0);
            if (priorityDifference !== 0) return priorityDifference;

            const matchDifference = (second.dynamicStatus.matchCount || 0)
                - (first.dynamicStatus.matchCount || 0);
            if (matchDifference !== 0) return matchDifference;

            return (first.distance || 0) - (second.distance || 0);
        });
    }

    function appendLoadMoreButton(container, label, eventName, currentLimit, totalCount, onLoad) {
        if (totalCount <= currentLimit) return;

        const loadMoreButton = document.createElement('button');
        loadMoreButton.className = 'btn-load-more';
        loadMoreButton.textContent = label;
        loadMoreButton.addEventListener('click', () => {
            trackEvent(eventName, {
                current_limit: currentLimit,
                total_count: totalCount,
            });
            onLoad();
            renderResults();
        });
        container.appendChild(loadMoreButton);
    }

    function renderFallbackHint(sorted, center, fallbackHint) {
        fallbackHint.innerHTML = '';
        fallbackHint.classList.add('hidden');

        const activeFiltersCount = state.filters ? state.filters.size : 0;
        if (activeFiltersCount === 0) return;

        const fullyMatchingCount = sorted.filter(restaurant => restaurant.dynamicLevel === 'High').length;
        if (fullyMatchingCount > 3) return;

        const message = fullyMatchingCount === 0
            ? '找不到完全符合篩選條件的餐廳。'
            : `此區域附近完全符合條件的選擇較少（僅 ${fullyMatchingCount} 間）。`;
        const mediumCount = sorted.filter(restaurant => restaurant.dynamicLevel === 'Medium').length;
        const hasOthers = sorted.some(restaurant => (
            restaurant.dynamicLevel === 'Low Match'
            || restaurant.dynamicLevel === 'Insufficient Info'
        ));

        let recommendation = '您可以考慮減少篩選條件以獲得更多推薦。';
        if (mediumCount > 0 && hasOthers) {
            recommendation = '您可以考慮減少篩選條件，或參考下方「可以考慮」與「其他友善選擇」的餐廳。';
        } else if (mediumCount > 0) {
            recommendation = '您可以考慮減少篩選條件，或參考下方「可以考慮（符合部分條件）」的餐廳。';
        } else if (hasOthers) {
            recommendation = '您可以考慮減少篩選條件，或參考下方「其他友善選擇」的餐廳。';
        }

        const isWholeCity = center.type === '全市'
            || center.name === '整個台北市'
            || center.type === '多行政區'
            || center.type === '行政區';
        let expandHtml = '';
        if (!isWholeCity) {
            expandHtml = state.expandedRadius
                ? '（已擴大搜尋範圍）'
                : '或者，您可以嘗試 <a href="#" id="btn-expand-search" style="color: #2563eb; text-decoration: underline; cursor: pointer; font-weight: 700; margin-left: 2px;">擴大搜尋範圍</a>。';
        }

        fallbackHint.innerHTML = `${message}${recommendation}${expandHtml}`;
        fallbackHint.classList.remove('hidden');

        document.getElementById('btn-expand-search')?.addEventListener('click', event => {
            event.preventDefault();
            state.expandedRadius = true;
            state.recommendedLimit = 30;
            state.othersLimit = 30;
            renderResults();
        });
    }

    function handleNoResults(center) {
        const noResultsState = document.getElementById('no-results');
        noResultsState.classList.remove('hidden');
        document.getElementById('no-results-title').textContent = `找不到「${center.name}」附近的親子友善餐廳`;

        const suggestions = state.locationData
            .filter(location => location.name !== center.name)
            .sort((first, second) => (
                calculateDistance(center.lat, center.lng, first.lat, first.lng)
                - calculateDistance(center.lat, center.lng, second.lat, second.lng)
            ))
            .slice(0, 3);

        const suggestionContainer = document.getElementById('no-results-suggestions');
        suggestionContainer.innerHTML = '';
        suggestions.forEach(location => {
            const button = document.createElement('button');
            button.className = 'suggestion-chip';
            button.textContent = location.name;
            button.addEventListener('click', () => selectLocation(location));
            suggestionContainer.appendChild(button);
        });

        renderMap([]);
    }

    function getResultMatchCount() {
        if (!state.searchLocation) return 0;

        const hasActiveFilters = (state.filters && state.filters.size > 0)
            || hasCuisineFilters(state.cuisineFilter)
            || (state.priceFilter && state.priceFilter.size > 0);
        if (!hasActiveFilters) return 0;

        const filtered = filterByLocation(state.searchLocation)
            .filter(restaurant => matchesCuisineFilter(restaurant, state.cuisineFilter))
            .filter(restaurant => matchesPriceFilter(restaurant, state.priceFilter));

        if (!state.filters || state.filters.size === 0) return filtered.length;
        return filtered.filter(restaurant => (
            isFullAttributeFilterMatch(restaurant, state.filters)
        )).length;
    }

    async function renderResults() {
        try {
            const recommendedList = document.getElementById('recommended-list');
            const othersList = document.getElementById('others-list');
            const toggleOthersButton = document.getElementById('toggle-others');
            const fallbackHint = document.getElementById('fallback-hint');
            const noResultsState = document.getElementById('no-results');

            recommendedList.innerHTML = '';
            othersList.innerHTML = '';
            fallbackHint.classList.add('hidden');
            noResultsState.classList.add('hidden');
            renderActiveFilters();

            levelLabels['Needs Attention'] = '不符合條件';
            levelLabels.High = state.filters && state.filters.size > 0 ? '很適合你' : '值得推薦';
            levelLabels.Medium = '可以考慮';
            levelLabels['Insufficient Info'] = '資訊不足';

            const center = state.searchLocation;
            if (!center) {
                updateShowResultsButton(0);
                return;
            }

            if (!restaurantData) {
                console.error('restaurantData is missing');
                return;
            }

            let filtered = filterByLocation(center)
                .filter(restaurant => matchesCuisineFilter(restaurant, state.cuisineFilter))
                .filter(restaurant => matchesPriceFilter(restaurant, state.priceFilter));

            if (filtered.length === 0) {
                updateShowResultsButton(0);
                handleNoResults(center);
                return;
            }

            document.getElementById('search-results-view').classList.remove('hidden');
            document.getElementById('home-view').classList.add('search-active');

            const sorted = sortResults(filtered);
            const exactMatches = sorted.filter(restaurant => (
                restaurant.dynamicLevel === 'High' || restaurant.dynamicLevel === 'Medium'
            ));

            let recommended;
            let others;
            if (exactMatches.length > 0) {
                recommended = exactMatches;
                others = sorted.filter(restaurant => (
                    restaurant.dynamicLevel === 'Low Match'
                    || restaurant.dynamicLevel === 'Insufficient Info'
                    || restaurant.dynamicLevel === 'Needs Attention'
                ));
            } else {
                recommended = sorted.filter(restaurant => restaurant.dynamicLevel === 'Low Match');
                others = sorted.filter(restaurant => (
                    restaurant.dynamicLevel === 'Insufficient Info'
                    || restaurant.dynamicLevel === 'Needs Attention'
                ));
            }

            state.currentResults = sorted;
            const fullMatchCount = state.filters && state.filters.size > 0
                ? sorted.filter(restaurant => isFullAttributeFilterMatch(restaurant, state.filters)).length
                : filtered.length;
            updateShowResultsButton(fullMatchCount);

            recommended
                .slice(0, state.recommendedLimit)
                .forEach(restaurant => renderCard(restaurant, recommendedList));
            appendLoadMoreButton(
                recommendedList,
                '載入更多推薦',
                'click_load_more_recommended',
                state.recommendedLimit,
                recommended.length,
                () => { state.recommendedLimit += 30; },
            );

            if (state.showOthers) {
                others
                    .slice(0, state.othersLimit)
                    .forEach(restaurant => renderCard(restaurant, othersList));
                appendLoadMoreButton(
                    othersList,
                    '載入更多選項',
                    'click_load_more_others',
                    state.othersLimit,
                    others.length,
                    () => { state.othersLimit += 30; },
                );
            }

            renderFallbackHint(sorted, center, fallbackHint);

            othersList.classList.toggle('hidden', !state.showOthers);
            toggleOthersButton.classList.toggle('active', state.showOthers);
            toggleOthersButton.querySelector('span').textContent = state.showOthers
                ? '收合額外選項'
                : '查看更多 (含資訊不足或不符合條件)';
            document.getElementById('others-section').classList.toggle('hidden', others.length === 0);

            renderMap(state.showOthers ? sorted : recommended);

            const clearAllFiltersButton = document.getElementById('clear-all-filters');
            if (clearAllFiltersButton) {
                clearAllFiltersButton.classList.toggle(
                    'hidden',
                    state.filters.size === 0 && state.priceFilter.size === 0,
                );
            }

            const hideMarkersToggle = document.getElementById('hide-others-markers');
            if (hideMarkersToggle) {
                hideMarkersToggle.checked = state.hideLowQualityMarkers;
            }
        } catch (error) {
            console.error('Error rendering results:', error);
            showToast('載入結果時發生錯誤');
        }
    }

    return {
        getResultMatchCount,
        renderResults,
    };
}
