import os

with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

replacement = r'''            } else {
                safeScrollIntoView(searchResultsView);
            }
        }
    }
    updateQuickLinksUI();
}

function calculatePersonalizedScore(res) {
    if (!state.filters || state.filters.size === 0) {
        return {
            score: res.rating * 10, // Default sorting
            level: res.parent_friendly_level || 'Insufficient Info'
        };
    }

    let score = 0;
    let matchCount = 0;
    let missCount = 0;
    let otherMatchCount = 0;
    let unknownCount = 0;
    const attrs = res.attributes || {};
    const allKeys = ['has_tableware', 'high_chair_available', 'has_diaper_table', 'kids_menu', 'kid_noise_tolerant', 'spacious_seating', 'has_play_area', 'has_private_room'];

    allKeys.forEach(key => {
        const val = attrs[key];
        const isSelected = state.filters.has(key);

        if (val === 'yes') {
            if (isSelected) {
                score += 100;
                matchCount++;
            } else {
                score += 1;
                otherMatchCount++;
            }
        } else if (val === 'no') {
            if (isSelected) {
                score -= 1000; // Dealbreaker
                missCount++;
            } else {
                score -= 1;
            }
        } else {
            unknownCount++;
        }
    });

    // Determine level based on requested hierarchy
    let level = 'Insufficient Info';
    if (missCount > 0) {
        level = 'Needs Attention'; // "不符合條件"
    } else if (matchCount === state.filters.size && state.filters.size > 0) {
        level = 'High'; // "很適合你"
    } else if (matchCount > 0 || (otherMatchCount > 0 && missCount === 0)) {
        level = 'Medium'; // "可以考慮"
    } else if (unknownCount === allKeys.length) {
        level = 'Insufficient Info';
    }

    return { score, level };
}

async function renderResults() {
    try {
        const wrapper = document.querySelector('.results-content-wrapper');
        const mapContainer = document.getElementById('map-container');
        if (wrapper) wrapper.classList.add('results-refreshing');
        if (mapContainer) mapContainer.classList.add('results-refreshing');
        
        // Wait briefly for the browser to paint the fade-out effect
        await new Promise(resolve => setTimeout(resolve, 100));

        const recommendedList = document.getElementById('recommended-list');
        const othersList = document.getElementById('others-list');
        const toggleOthersBtn = document.getElementById('toggle-others');
        const fallbackHint = document.getElementById('fallback-hint');
        const noResultsState = document.getElementById('no-results');

        recommendedList.innerHTML = '';
        othersList.innerHTML = '';
        fallbackHint.classList.add('hidden');
        noResultsState.classList.add('hidden');

        // Update dynamic active filter indicators in sticky search-status-bar
        const activeFiltersBar = document.getElementById('active-filters-bar');
        if (activeFiltersBar) {
            activeFiltersBar.innerHTML = '';
            if (state.filters && state.filters.size > 0) {
                activeFiltersBar.classList.remove('hidden');
                state.filters.forEach(f => {
                    const icon = attributeIcons[f] || '✨';
                    const label = attributeLabels[f] || f;
                    const indicator = document.createElement('span');
                    indicator.className = 'filter-indicator-mini';
                    indicator.innerHTML = f"{icon} {label}";
                    activeFiltersBar.appendChild(indicator);
                });
            } else {
                activeFiltersBar.classList.add('hidden');
            }
        }

        // Update Level Labels for this session
        levelLabels['Needs Attention'] = '不符合條件';
        levelLabels['High'] = (state.filters && state.filters.size > 0) ? '很適合你' : '值得推薦';
        levelLabels['Medium'] = '可以考慮';
        levelLabels['Insufficient Info'] = '資訊不足';

        const center = state.searchLocation;
        if (!center) return;

        if (typeof restaurantData === 'undefined' || !restaurantData) {
            console.error('restaurantData is missing');
            return;
        }

        // 1. Calculate distances directly on references to avoid object copying
        restaurantData.forEach(res => {
            res.distance = calculateDistance(center.lat, center.lng, res.latitude, res.longitude);
        });
        let restaurants = restaurantData;

        // 2. Filter by distance or keyword
        let filtered;
        if (center.type === '關鍵字搜尋') {
            const q = center.keyword.toLowerCase();
            filtered = restaurants.filter(res => 
                (res.name && res.name.toLowerCase().includes(q)) ||
                (res.address && res.address.toLowerCase().includes(q)) ||
                (res.cuisine && res.cuisine.toLowerCase().includes(q)) ||
                (res.district && res.district.toLowerCase().includes(q))
            );
        } else {
            let maxRadius = (center.type === '全市' || center.name === '整個台北市') ? 99999 : ((center.type === '行政區') ? 2.5 : 1.5);
            if (state.expandedRadius) {
                maxRadius = (center.type === '全市' || center.name === '整個台北市') ? 99999 : ((center.type === '行政區') ? 5.0 : 3.0);
            }
            filtered = restaurants.filter(res => res.distance <= maxRadius);
        }

        if (filtered.length === 0) {
            state.currentResults = [];
            handleNoResults(center);
            return;
        }

        const resultsContainer = document.getElementById('search-results-view');
        resultsContainer.classList.remove('hidden');
        homeView.classList.add('search-active');

        // Apply new dynamic status to each restaurant for sorting/rendering directly on references
        filtered.forEach(res => {
            const status = getDynamicStatus(res, state.filters);
            res.dynamicLevel = status.level;
            res.dynamicStatus = status;
        });
        const processed = filtered;

        // Priority for sorting
        const priority = {
            'High': 5,
            'Medium': 4,
            'Low Match': 3,
            'Insufficient Info': 2,
            'Needs Attention': 1
        };

        const sorted = processed.sort((a, b) => {
            const pA = priority[a.dynamicLevel] || 0;
            const pB = priority[b.dynamicLevel] || 0;
            if (pA !== pB) return pB - pA;

            // Within the same dynamicLevel, sort by matchCount descending
            const mA = a.dynamicStatus.matchCount || 0;
            const mB = b.dynamicStatus.matchCount || 0;
            if (mA !== mB) return mB - mA;

            const diff = (a.distance || 0) - (b.distance || 0); return isNaN(diff) ? 0 : diff; // Tertiarily sort by distance
        });

        // 4. Split and Render
        const exactMatches = sorted.filter(r => r.dynamicLevel === 'High' || r.dynamicLevel === 'Medium');
        
        let recommended, others;
        if (exactMatches.length > 0) {
            recommended = exactMatches;
            others = sorted.filter(r => r.dynamicLevel === 'Low Match' || r.dynamicLevel === 'Insufficient Info' || r.dynamicLevel === 'Needs Attention');
        } else {
            recommended = sorted.filter(r => r.dynamicLevel === 'Low Match');
            others = sorted.filter(r => r.dynamicLevel === 'Insufficient Info' || r.dynamicLevel === 'Needs Attention');
        }

        state.currentResults = sorted; 

        // Render recommended cards up to the recommendedLimit
        const visibleRecommended = recommended.slice(0, state.recommendedLimit);
        visibleRecommended.forEach(res => renderCard(res, recommendedList, res.dynamicLevel));

        // If there are more recommended items, render the Load More button
        if (recommended.length > state.recommendedLimit) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'btn-load-more';
            loadMoreBtn.textContent = '載入更多推薦';
            loadMoreBtn.addEventListener('click', () => {
                trackEvent('click_load_more_recommended', {
                    current_limit: state.recommendedLimit,
                    total_count: recommended.length
                });
                state.recommendedLimit += 30;
                renderResults();
            });
            recommendedList.appendChild(loadMoreBtn);
        }

        // Lazy Rendering of others list based on state.showOthers
        if (state.showOthers) {
            const visibleOthers = others.slice(0, state.othersLimit);
            visibleOthers.forEach(res => renderCard(res, othersList, res.dynamicLevel));

            // If there are more others items, render the Load More button
            if (others.length > state.othersLimit) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'btn-load-more';
                loadMoreBtn.textContent = '載入更多選項';
                loadMoreBtn.addEventListener('click', () => {
                    trackEvent('click_load_more_others', {
                        current_limit: state.othersLimit,
                        total_count: others.length
                    });
                    state.othersLimit += 30;
                    renderResults();
                });
                othersList.appendChild(loadMoreBtn);
            }
        }

        // Check if fully matching restaurants are 3 or fewer when filters are active
        const activeFiltersCount = (state.filters && state.filters.size > 0) ? state.filters.size : 0;
        fallbackHint.innerHTML = '';
        fallbackHint.classList.add('hidden');

        if (activeFiltersCount > 0) {
            const fullyMatchingCount = sorted.filter(r => r.dynamicLevel === 'High').length;
            if (fullyMatchingCount <= 3) {
                let msg = '';
                if (fullyMatchingCount === 0) {
                    msg = '找不到完全符合篩選條件的餐廳。';
                } else {
                    msg = "此區域附近完全符合條件的選擇較少（僅 " + fullyMatchingCount + " 間）。";
                }

                // Check what else is available
                const mediumCount = sorted.filter(r => r.dynamicLevel === 'Medium').length;
                const hasOthers = sorted.some(r => r.dynamicLevel === 'Low Match' || r.dynamicLevel === 'Insufficient Info');
                
                let recommendation = '';
                if (mediumCount > 0 && hasOthers) {
                    recommendation = '您可以考慮減少篩選條件，或參考下方「可以考慮」與「其他友善選擇」的餐廳。';
                } else if (mediumCount > 0) {
                    recommendation = '您可以考慮減少篩選條件，或參考下方「可以考慮（符合部分條件）」的餐廳。';
                } else if (hasOthers) {
                    recommendation = '您可以考慮減少篩選條件，或參考下方「其他友善選擇」的餐廳。';
                } else {
                    recommendation = '您可以考慮減少篩選條件以獲得更多推薦。';
                }

                const isWholeCity = (center.type === '全市' || center.name === '整個台北市');
                let expandHtml = '';
                if (!isWholeCity) {
                    if (!state.expandedRadius) {
                        expandHtml = '或者，您可以嘗試 <a href="#" id="btn-expand-search" style="color: #2563eb; text-decoration: underline; cursor: pointer; font-weight: 700; margin-left: 2px;">擴大搜尋範圍</a>。';
                    } else {
                        expandHtml = '（已擴大搜尋範圍）';
                    }
                }
'''

# We need to insert this into app_js right before:
#                fallbackHint.innerHTML = ${msg};

# So let's replace the small snippet around it.
import re

# find the exact string that is currently there:
target_regex = re.compile(r"(\s*safeScrollIntoView\(searchCard\);\s*)(fallbackHint\.innerHTML = \$\{msg\}\$\{recommendation\}\$\{expandHtml\};)")
match = target_regex.search(app_js)

if match:
    new_app = app_js[:match.start(2)] + replacement + app_js[match.start(2):]
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(new_app)
    print("Fixed!")
else:
    print("Not found! Let's just find the fallbackHint line")
    idx = app_js.find("fallbackHint.innerHTML = ${msg};")
    if idx != -1:
        new_app = app_js[:idx] + replacement + app_js[idx:]
        with open('app.js', 'w', encoding='utf-8') as f:
            f.write(new_app)
        print("Fixed fallback!")
    else:
        print("Still not found!")

