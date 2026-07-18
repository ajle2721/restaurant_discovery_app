import "./styles/main.css";
import { locationData } from "./data/locations.js";
import { restaurantData } from "./data/restaurant-index.js";
import { createFeedbackController } from "./feedback/feedback-controller.js";
import { createLeafletMapController } from "./map/leaflet-map.js";
import { trackEvent } from "./analytics/events.js";
import {
    attributeIcons,
    attributeLabels,
    filterMap,
    isPositiveAttributeValue,
    levelLabels,
} from "./restaurants/attributes.js";
import {
    getPriceSymbolForLevels,
} from "./restaurants/pricing.js";
import {
    fixSimplifiedAddress,
    formatAddressForCard,
    formatRestaurantName,
    formatStreetAddressForCard,
    getCardDistrict,
    getDisplaySummary,
    patchAiSummary,
} from "./restaurants/presentation.js";
import { createRestaurantDetailController } from "./restaurants/detail-controller.js";
import { setupPwaInstallPrompt } from "./pwa/install-prompt.js";
import { createAutocompleteController } from "./search/autocomplete-controller.js";
import {
    getCuisineFilterLabel,
    getCuisineFilterSummary as formatCuisineFilterSummary,
    getSearchableText,
    hasCuisineFilters as hasSelectedCuisineFilters,
    matchesCuisineFilter as matchesRestaurantCuisineFilter,
} from "./search/cuisine-filter.js";
import { calculateDistance, calculateTravelTimes, formatDistance } from "./search/distance.js";
import {
    getDisplayPriceLevels,
    inferPriceLevel,
    matchesPriceFilter as matchesRestaurantPriceFilter,
} from "./search/price-filter.js";
import {
    getDynamicStatus,
    getParentFriendlyBaseScore,
    isFullAttributeFilterMatch,
} from "./search/scoring.js";
import { createShortlistController } from "./shortlist/shortlist-controller.js";
import { state } from "./state/app-state.js";
import { safeSession } from "./state/storage.js";

const {
    closeFeedbackModal,
    closeSiteFeedbackModal,
    handleFeedbackSubmit,
    handleHomeFeedbackLinkClick,
    handleSiteFeedbackSubmit,
    openContributionModal,
    openFeedbackModal,
    openSiteFeedbackModal,
    submitAiFeedback,
} = createFeedbackController({ getLocationContext, showToast });

const {
    closeComparisonModal,
    loadFavorites,
    openComparisonModal,
    renderShortlistDrawer,
    saveFavorites,
    syncComparisonExpandButton,
    toggleFavorite,
    updateShortlistUI,
} = createShortlistController({ getDynamicStatus, showToast, updateUrl });

const {
    initMap,
    refreshMapMarkers,
    renderMap,
} = createLeafletMapController({
    getDynamicStatus,
    getParentFriendlyBaseScore,
    getRestaurantEventParams,
    recordRestaurantDetailView,
    showDetail,
    throttle,
});

function getLocationContext() {
    if (!state.searchLocation) return 'none';
    return state.searchLocation.name === '我附近' ? 'nearby' : state.searchLocation.name;
}

function getRestaurantEventParams(res, source) {
    const level = res?.dynamicLevel || res?.parent_friendly_level;
    return {
        restaurant_name: res?.name || '',
        source,
        recommendation_level: levelLabels[level] || level || '',
        location_context: getLocationContext()
    };
}

function trackAiSummaryFeedbackVote(restaurant, isHelpful) {
    trackEvent(isHelpful ? 'ai_summary_helpful_click' : 'ai_summary_unhelpful_click', {
        restaurant_name: restaurant?.name || '',
        restaurant_id: restaurant?.place_id || '',
        recommendation_level: levelLabels[restaurant?.dynamicLevel || restaurant?.parent_friendly_level] || restaurant?.parent_friendly_level || '',
        location_context: getLocationContext(),
        feedback_vote: isHelpful ? 'helpful' : 'unhelpful',
        has_ai_summary: Boolean(restaurant?.ai_summary)
    });
}

function resetViewedRestaurantCount() {
    state.viewedRestaurantIdsInSearch = new Set();
}

function recordRestaurantDetailView(res) {
    if (res?.place_id) {
        state.viewedRestaurantIdsInSearch.add(res.place_id);
    }
    return state.viewedRestaurantIdsInSearch.size;
}

function getViewedRestaurantCount() {
    const viewedIds = state.viewedRestaurantIdsInSearch;
    return viewedIds && typeof viewedIds.size === 'number' ? viewedIds.size : 0;
}

function trackSearchLocation(searchMethod, location) {
    trackEvent('search_location', {
        search_method: searchMethod,
        location
    });
}

// Throttle function for map interactions
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

function isInAppBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const uaLower = ua.toLowerCase();
    return uaLower.includes('fban') || 
           uaLower.includes('fbav') || 
           uaLower.includes('line/') || 
           uaLower.includes('instagram') || 
           uaLower.includes('micromessenger') || // WeChat
           uaLower.includes('pxbrowser');
}

function safeScrollIntoView(element) {
    if (!element) return;
    try {
        const isApp = isInAppBrowser();
        element.scrollIntoView({ behavior: isApp ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
        console.warn('scrollIntoView failed, falling back to basic scroll', e);
        try {
            element.scrollIntoView(true);
        } catch (err) {
            console.error('Basic scrollIntoView failed:', err);
        }
    }
}


function updateQuickLinksUI() {
    const loc = state.searchLocation;
    const items = document.querySelectorAll('.quick-link-item');
    items.forEach(btn => {
        let isActive = false;
        if (loc) {
            if (btn.dataset.loc && btn.dataset.loc === loc.name) {
                isActive = true;
            } else if (btn.id === 'btn-nearby-prominent' && loc.name === '我附近') {
                isActive = true;
            } else if (btn.id === 'btn-taipei-all' && (loc.name === '整個台北市' || loc.name === '台北市全區' || loc.type === '全市')) {
                isActive = true;
            }
        }
        btn.classList.toggle('active', isActive);
    });
}

function getPFSummaryTags(res, overrideLevel, simpleFormat = false) {
    const attrs = res.attributes || {};
    
    // If filters are active, show match count
    if (state.filters && state.filters.size > 0) {
        const level = overrideLevel || (typeof getDynamicStatus === 'function' ? getDynamicStatus(res, state.filters).level : 'Insufficient Info');
        
        const attributeDetails = {
            has_tableware: {
                yes: '兒童餐具',
                no: '無提供兒童餐具',
                unknown: '目前整理資料未提及餐具提供'
            },
            high_chair_available: {
                yes: '兒童椅',
                no: '無提供兒童椅',
                unknown: '目前整理資料未提及兒童椅'
            },
            has_diaper_table: {
                yes: '有尿布台',
                no: '無尿布台',
                unknown: '目前整理資料未提及尿布台'
            },
            kids_menu: {
                yes: '兒童餐',
                no: '無提供兒童餐',
                unknown: '目前整理資料未提及兒童餐'
            },
            kid_noise_tolerant: {
                yes: '不怕吵鬧',
                no: '氣氛較安靜',
                unknown: '目前整理資料未提及氣氛安靜度'
            },
            spacious_seating: {
                yes: '空間寬敞',
                no: '空間較為擁擠',
                unknown: '目前整理資料未提及空間大小'
            },
            has_play_area: {
                yes: '有遊樂區',
                no: '無遊樂區',
                unknown: '目前整理資料未提及遊戲設施'
            },
            has_private_room: {
                yes: '有包廂或可包場',
                no: '無提供包廂或包場',
                unknown: '目前整理資料未提及包廂或包場'
            }
        };

        if (level === 'Needs Attention' || level === '需留意') {
            const missAttrs = [];
            state.filters.forEach(f => {
                if (attrs[f] === 'no') {
                    missAttrs.push(attributeDetails[f].no);
                }
            });
            if (missAttrs.length > 0) {
                return `留意：${missAttrs.join('、')}`;
            }
        }
        
        if (level === 'Insufficient Info' || level === '資訊不足') {
            const unknownNouns = [];
            const nounMap = {
                has_tableware: '兒童餐具',
                high_chair_available: '兒童椅',
                has_diaper_table: '尿布台',
                kids_menu: '兒童餐',
                kid_noise_tolerant: '氣氛安靜度',
                spacious_seating: '空間大小',
                has_play_area: '遊樂區',
                has_private_room: '包廂或可包場'
            };
            state.filters.forEach(f => {
                if (!attrs[f] || attrs[f] === 'unknown') {
                    if (nounMap[f]) {
                        unknownNouns.push(nounMap[f]);
                    }
                }
            });
            if (unknownNouns.length > 0) {
                if (unknownNouns.length === 1) {
                    return `目前整理資料未提及${unknownNouns[0]}`;
                } else if (unknownNouns.length === 2) {
                    return `目前整理資料未提及${unknownNouns[0]}與${unknownNouns[1]}`;
                } else {
                    const lastNoun = unknownNouns.pop();
                    return `目前整理資料未提及${unknownNouns.join('、')}與${lastNoun}`;
                }
            }
        }
        
        if (level === 'Low Match' || level === '其他友善選擇') {
            const allKeys = ['has_tableware', 'high_chair_available', 'has_diaper_table', 'kids_menu', 'kid_noise_tolerant', 'spacious_seating', 'has_play_area', 'has_private_room'];
            const otherYesAttrs = [];
            allKeys.forEach(k => {
                const val = attrs[k];
                const isPositive = val === 'yes' || val === 'room' || val === 'venue' || val === 'likely' || val === 'likely_room' || val === 'likely_venue';
                const isLikely = String(val).startsWith('likely');
                if (!state.filters.has(k) && isPositive) {
                    otherYesAttrs.push(attributeDetails[k].yes + (isLikely ? '(估)' : ''));
                }
            });
            if (otherYesAttrs.length > 0) {
                return `具備其他特色：${otherYesAttrs.join('、')}`;
            }
        }

        let matchCount = 0;
        const matchedNames = [];
        state.filters.forEach(f => {
            const val = attrs[f];
            const isPositive = val === 'yes' || val === 'room' || val === 'venue' || val === 'likely' || val === 'likely_room' || val === 'likely_venue';
            if (isPositive) {
                matchCount++;
                const isLikely = String(val).startsWith('likely');
                matchedNames.push(attributeLabels[f] + (isLikely ? '(估)' : ''));
            }
        });
        if (matchCount > 0) {
            if (simpleFormat) {
                return `符合你勾選的 ${matchCount}/${state.filters.size} 項：${matchedNames.join('、')}`;
            }
            return `符合 ${matchCount}/${state.filters.size}：${matchedNames.join('、')}`;
        }
        return `符合 0/${state.filters.size} 項勾選條件`;
    }

    // Default view: list positive amenities
    const tags = [];
    if (attrs.has_tableware === 'yes' || attrs.has_tableware === 'likely') tags.push('兒童餐具' + (attrs.has_tableware === 'likely' ? '(估)' : ''));
    if (attrs.high_chair_available === 'yes' || attrs.high_chair_available === 'likely') tags.push('兒童椅' + (attrs.high_chair_available === 'likely' ? '(估)' : ''));
    if (attrs.has_diaper_table === 'yes' || attrs.has_diaper_table === 'likely') tags.push('尿布台' + (attrs.has_diaper_table === 'likely' ? '(估)' : ''));
    if (attrs.kids_menu === 'yes' || attrs.kids_menu === 'likely') tags.push('兒童餐' + (attrs.kids_menu === 'likely' ? '(估)' : ''));
    if (attrs.kid_noise_tolerant === 'yes' || attrs.kid_noise_tolerant === 'likely') tags.push('不怕吵' + (attrs.kid_noise_tolerant === 'likely' ? '(估)' : ''));
    if (attrs.spacious_seating === 'yes' || attrs.spacious_seating === 'likely') tags.push('空間寬敞' + (attrs.spacious_seating === 'likely' ? '(估)' : ''));
    if (attrs.has_play_area === 'yes' || attrs.has_play_area === 'likely') tags.push('有遊樂區' + (attrs.has_play_area === 'likely' ? '(估)' : ''));
    const pRoomVal = attrs.has_private_room;
    if (pRoomVal === 'yes' || pRoomVal === 'room' || pRoomVal === 'venue' || pRoomVal === 'likely' || pRoomVal === 'likely_room' || pRoomVal === 'likely_venue') {
        const isLikely = String(pRoomVal).startsWith('likely');
        tags.push('包廂或可包場' + (isLikely ? '(估)' : ''));
    }
    
    return tags.join('、');
}

// DOM Elements
const restaurantList = document.getElementById('restaurant-list');
const homeView = document.getElementById('home-view');
const detailView = document.getElementById('detail-view');
const detailContent = document.getElementById('detail-content');
const backHomeBtn = document.getElementById('back-home');
const floatShareBtn = document.getElementById('float-share');
const detailShareBtn = document.getElementById('share-detail');
const shareShortlistBtn = document.getElementById('btn-share-shortlist');
const toast = document.getElementById('toast');
const searchInput = document.getElementById('location-search');
const autocompleteDropdown = document.getElementById('search-autocomplete');
const btnNearby = document.getElementById('btn-nearby');
const searchMagnifier = document.getElementById('search-magnifier');
const clearSearchBtn = document.getElementById('clear-search');
const searchResultsView = document.getElementById('search-results-view');
const currentSearchLocText = document.getElementById('current-search-location');
const resetSearchBtn = document.getElementById('reset-search');
const recommendedList = document.getElementById('recommended-list');
const othersList = document.getElementById('others-list');
const toggleOthersBtn = document.getElementById('toggle-others');
const fallbackHint = document.getElementById('fallback-hint');
const noResultsState = document.getElementById('no-results');

const {
    executeSearch,
    handleAutocomplete,
} = createAutocompleteController({
    autocompleteDropdown,
    clearSearchBtn,
    getRestaurantEventParams,
    recordRestaurantDetailView,
    searchInput,
    searchMagnifier,
    selectLocation,
    showDetail,
    showPopularRecommendations,
    showToast,
    trackSearchLocation,
});

const { renderDetailContent } = createRestaurantDetailController({
    detailContent,
    getLocationContext,
    getPFSummaryTags,
    getViewedRestaurantCount,
    isInAppBrowser,
    openFeedbackModal,
    showToast,
    submitAiFeedback,
    trackAiSummaryFeedbackVote,
});

function isAreaSearchLocation(loc) {
    if (!loc) return false;
    if (loc.place_id || loc.type === '特定餐廳') return false;
    if (loc.keyword) return true;
    if (loc.isFallback || loc.resolvedAddress) return true;
    if (loc.type === '關鍵字搜尋' || loc.type === '自訂地點') return true;
    if (state.locationData && state.locationData.some(l => l.name === loc.name)) return true;
    return loc.type === '目前位置' || loc.type === '全市';
}

function hasCuisineFilters() {
    return hasSelectedCuisineFilters(state.cuisineFilter);
}

function matchesCuisineFilter(res) {
    return matchesRestaurantCuisineFilter(res, state.cuisineFilter);
}

function hasPriceFilters() {
    return state.priceFilter && state.priceFilter.size > 0;
}

function matchesPriceFilter(res) {
    return matchesRestaurantPriceFilter(res, state.priceFilter);
}

function getCuisineFilterSummary() {
    return formatCuisineFilterSummary(state.cuisineFilter);
}
function updateCuisineFilterUI(options = {}) {
    const toggle = document.getElementById('toggle-cuisine-filter');
    const panel = document.getElementById('cuisine-options');
    const selectedLabel = document.getElementById('selected-cuisine-label');
    const clearCuisineBtn = document.getElementById('clear-cuisine-filter');
    const shouldExpand = typeof options.expand === 'boolean'
        ? options.expand
        : toggle?.getAttribute('aria-expanded') === 'true';

    document.querySelectorAll('.cuisine-chip').forEach(chip => {
        chip.classList.toggle('active', state.cuisineFilter.has(chip.dataset.cuisine));
    });

    if (clearCuisineBtn) {
        clearCuisineBtn.classList.toggle('hidden', !hasCuisineFilters());
    }

    if (selectedLabel) {
        selectedLabel.textContent = getCuisineFilterSummary();
        selectedLabel.classList.toggle('hidden', !hasCuisineFilters());
    }

    if (toggle) {
        toggle.classList.toggle('active', shouldExpand);
        toggle.setAttribute('aria-expanded', String(shouldExpand));
    }

    if (panel) {
        panel.classList.toggle('hidden', !shouldExpand);
    }
}

function updateShowResultsButton(matchCount = 0) {
    const btnShowResultsContainer = document.getElementById('btn-show-results-container');
    const btnShowResults = document.getElementById('btn-show-results');
    if (!btnShowResultsContainer || !btnShowResults) return;

    const hasActiveFilters = (state.filters && state.filters.size > 0) || hasCuisineFilters() || hasPriceFilters();
    const shouldShow = isAreaSearchLocation(state.searchLocation)
        && hasActiveFilters
        && matchCount > 0;

    btnShowResultsContainer.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) {
        btnShowResults.textContent = `查看 ${matchCount} 間餐廳`;
    }
}

function getShowResultsPreviewCount() {
    if (!state.searchLocation) return 0;
    const hasActiveFilters = (state.filters && state.filters.size > 0) || hasCuisineFilters() || hasPriceFilters();
    if (!hasActiveFilters) return 0;
    if (typeof restaurantData === 'undefined' || !restaurantData) return 0;

    const center = state.searchLocation;
    let filtered;
    if (center.type === '多行政區') {
        filtered = restaurantData.filter(res => 
            res.district && center.districts.includes(res.district)
        );
    } else if (center.type === '行政區') {
        filtered = restaurantData.filter(res => 
            res.district === center.name
        );
    } else if (center.type === '多地點') {
        filtered = restaurantData.filter(res => {
            let matched = false;
            let minDistance = Infinity;
            center.locations.forEach(loc => {
                if (loc.type === '行政區') {
                    if (res.district === loc.name) {
                        matched = true;
                        const distToLoc = calculateDistance(loc.lat, loc.lng, res.latitude, res.longitude);
                        if (distToLoc < minDistance) {
                            minDistance = distToLoc;
                        }
                    }
                } else {
                    const distToLoc = calculateDistance(loc.lat, loc.lng, res.latitude, res.longitude);
                    let maxRadius = (loc.type === '全市') ? 99999 : ((loc.type === '行政區') ? 2.5 : 1.5);
                    if (state.expandedRadius) {
                        maxRadius = (loc.type === '全市') ? 99999 : ((loc.type === '行政區') ? 5.0 : 3.0);
                    }
                    if (distToLoc <= maxRadius) {
                        matched = true;
                        if (distToLoc < minDistance) {
                            minDistance = distToLoc;
                        }
                    }
                }
            });
            return matched;
        });
    } else if (center.type === '捷運站周邊') {
        const mrtStations = state.locationData.filter(l => l.type === '捷運站' || l.name.endsWith('站'));
        filtered = restaurantData.filter(res => {
            let minMrtDist = Infinity;
            mrtStations.forEach(mrt => {
                const dist = calculateDistance(mrt.lat, mrt.lng, res.latitude, res.longitude);
                if (dist < minMrtDist) {
                    minMrtDist = dist;
                }
            });
            return minMrtDist <= 0.8; // 800m
        });
    } else if (center.keyword) {
        const q = center.keyword.toLowerCase();
        filtered = restaurantData.filter(res =>
            (res.name && res.name.toLowerCase().includes(q)) ||
            (res.address && res.address.toLowerCase().includes(q)) ||
            (res.cuisine && res.cuisine.toLowerCase().includes(q)) ||
            (getSearchableText(res.cuisine_group).toLowerCase().includes(q)) ||
            (res.district && res.district.toLowerCase().includes(q))
        );
    } else {
        const maxRadius = (center.type === '全市' || center.name === '整個台北市')
            ? 99999
            : (state.expandedRadius ? 3.0 : 1.5);

        filtered = restaurantData.filter(res => {
            const distance = calculateDistance(center.lat, center.lng, res.latitude, res.longitude);
            return distance <= maxRadius;
        });
    }

    filtered = filtered.filter(matchesCuisineFilter).filter(matchesPriceFilter);

    if (!state.filters || state.filters.size === 0) {
        return filtered.length;
    }

    return filtered.filter(res => isFullAttributeFilterMatch(res, state.filters)).length;
}

function refreshShowResultsButton() {
    updateShowResultsButton(getShowResultsPreviewCount());
}

// Initialization
function init() {
    try {
        console.log('Initializing app...');
        // Check if data is available
        if (typeof locationData === 'undefined') {
            console.error('locationData is not loaded. Make sure locations.js is included.');
            state.locationData = [];
        } else {
            state.locationData = [...locationData];
            // Add virtual location for "捷運站周邊" (Near MRT Station)
            state.locationData.push({
                name: "捷運站周邊",
                type: "捷運站周邊",
                lat: 25.0374,
                lng: 121.5645,
                keywords: ["捷運", "捷運站", "捷運站周邊", "捷運周邊", "mrt"]
            });
        }

        if (typeof restaurantData === 'undefined') {
            console.error('restaurantData is not loaded. Make sure ai_review/index.js is included.');
        } else {
            console.log('restaurantData loaded successfully, count:', restaurantData.length);
            const statsEl = document.querySelector('.header-stats');
            if (statsEl) {
                statsEl.textContent = `📍 已分析台北市 ${restaurantData.length} 間餐廳，持續更新中`;
            }
        }

        initMap();
        loadFavorites();
        setupEventListeners();
        updateShortlistUI();
        setupPwaInstallPrompt();

        // Global listener for map popup buttons (View Details)
        state.map.on('popupopen', (e) => {
            // Prevent moveend from wiping markers (Leaflet auto-pans when opening a popup)
            state.popupOpen = true;
            const container = e.popup.getElement();
            const btn = container.querySelector('.btn-show-detail-from-map');
            if (btn) {
                const res = e.popup.options.restaurantData;
                if (res) {
                    btn.addEventListener('click', () => {
                        showDetail(res);
                    });
                }
            }
        });
        state.map.on('popupclose', () => {
            state.popupOpen = false;
        });

        console.log('Map initialized');
        syncStateFromUrl(true);
        console.log('App initialized successfully');
    } catch (err) {
        console.error('App initialization failed:', err);
        showToast('網站載入失敗，請重新整理');
    }
}

function setupEventListeners() {
    // Search Input
    searchInput.addEventListener('input', handleAutocomplete);
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length > 0) {
            autocompleteDropdown.classList.remove('hidden');
        } else {
            showPopularRecommendations();
        }
    });
    searchInput.addEventListener('click', () => {
        if (searchInput.value.trim().length === 0) {
            showPopularRecommendations();
        }
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            executeSearch(searchInput.value.trim());
        }
    });

    if (searchMagnifier) {
        searchMagnifier.addEventListener('click', () => {
            executeSearch(searchInput.value.trim());
        });
    }

    // Close autocomplete on click outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
            autocompleteDropdown.classList.add('hidden');
        }
    });

    // Clear Search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        autocompleteDropdown.classList.add('hidden');
        searchInput.focus();
    });

    // Nearby Button
    if (btnNearby) {
        btnNearby.addEventListener('click', () => {
            trackSearchLocation('popular_button', '我附近');
            handleNearby();
        });
    }

    const btnNearbyProminent = document.getElementById('btn-nearby-prominent');
    if (btnNearbyProminent) {
        btnNearbyProminent.addEventListener('click', () => {
            trackSearchLocation('popular_button', '我附近');
            if (state.searchLocation && state.searchLocation.name === '我附近') {
                resetSearchBtn.click();
            } else {
                handleNearby();
            }
        });
    }

    const btnTaipeiAll = document.getElementById('btn-taipei-all');
    if (btnTaipeiAll) {
        btnTaipeiAll.addEventListener('click', () => {
            trackSearchLocation('popular_button', '台北市全區');
            const taipeiAllLoc = {
                name: '整個台北市',
                type: '全市',
                district: '全市',
                lat: 25.037487, // Taipei Center
                lng: 121.564766
            };
            if (state.searchLocation && (state.searchLocation.name === '整個台北市' || state.searchLocation.name === '台北市全區' || state.searchLocation.type === '全市')) {
                resetSearchBtn.click();
            } else {
                selectLocation(taipeiAllLoc, 'taipei_all');
            }
        });
    }

    // Quick Links
    document.querySelectorAll('.quick-link-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const locName = btn.dataset.loc;
            if (!locName) return; // Skip buttons without data-loc like "我附近" or "台北市全區" to avoid duplicate handlers
            
            trackSearchLocation('popular_button', locName);
            
            if (state.searchLocation && state.searchLocation.name === locName) {
                resetSearchBtn.click();
            } else {
                const locObj = state.locationData.find(l => l.name === locName);
                if (locObj) selectLocation(locObj, 'popular_location');
            }
        });
    });

    // Filter Chips
    document.querySelectorAll('.filter-chip:not(.price-chip)').forEach(chip => {
        chip.addEventListener('click', () => {
            const filter = chip.dataset.filter;
            let action = 'select';
            
            if (state.filters.has(filter)) {
                state.filters.delete(filter);
                chip.classList.remove('active');
                action = 'deselect';
            } else {
                state.filters.add(filter);
                chip.classList.add('active');
            }
            
            state.recommendedLimit = 30; // Reset pagination limit
            state.othersLimit = 30; // Reset pagination limit
            refreshShowResultsButton();
            
            // Toggle active state in UI instantly, then defer heavy search execution
            setTimeout(() => {
                trackEvent('use_filter', {
                    filter_name: filterMap[filter] || filter,
                    action: action
                });
                
                renderResults();
                updateUrl();
            }, 20);
        });
    });

    // Price Chips
    document.querySelectorAll('.price-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const price = chip.dataset.price;
            let action = 'select';
            
            if (state.priceFilter.has(price)) {
                state.priceFilter.delete(price);
                chip.classList.remove('active');
                action = 'deselect';
            } else {
                state.priceFilter.add(price);
                chip.classList.add('active');
            }
            
            state.recommendedLimit = 30; // Reset pagination limit
            state.othersLimit = 30; // Reset pagination limit
            refreshShowResultsButton();
            
            setTimeout(() => {
                trackEvent('use_price_filter', {
                    price_level: price,
                    action: action
                });
                
                renderResults();
                updateUrl();
            }, 20);
        });
    });

    const toggleCuisineFilterBtn = document.getElementById('toggle-cuisine-filter');
    if (toggleCuisineFilterBtn) {
        toggleCuisineFilterBtn.addEventListener('click', () => {
            updateCuisineFilterUI({
                expand: toggleCuisineFilterBtn.getAttribute('aria-expanded') !== 'true'
            });
        });
    }
    // Cuisine Chips
    document.querySelectorAll('.cuisine-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const cuisine = chip.dataset.cuisine;
            let action = 'select';

            if (state.cuisineFilter.has(cuisine)) {
                state.cuisineFilter.delete(cuisine);
                action = 'deselect';
            } else {
                state.cuisineFilter.add(cuisine);
            }

            updateCuisineFilterUI({ expand: true });

            state.recommendedLimit = 30; // Reset pagination limit
            state.othersLimit = 30; // Reset pagination limit
            refreshShowResultsButton();

            // Toggle active state in UI instantly, then defer heavy search execution
            setTimeout(() => {
                trackEvent('use_cuisine_filter', {
                    cuisine_name: cuisine,
                    action: action
                });
                renderResults();
                updateUrl();
            }, 20);
        });
    });

    // Clear Cuisine Filter
    const clearCuisineFilterBtn = document.getElementById('clear-cuisine-filter');
    if (clearCuisineFilterBtn) {
        clearCuisineFilterBtn.addEventListener('click', () => {
            state.cuisineFilter.clear();
            updateCuisineFilterUI({ expand: false });
            
            state.recommendedLimit = 30; // Reset pagination limit
            state.othersLimit = 30; // Reset pagination limit
            refreshShowResultsButton();

            setTimeout(() => {
                renderResults();
                updateUrl();
            }, 20);
        });
    }

    // Clear All Filters
    const clearAllFiltersBtn = document.getElementById('clear-all-filters');
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            state.filters.clear();
            state.priceFilter.clear();
            document.querySelectorAll('.filter-chip:not(.price-chip)').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.price-chip').forEach(c => c.classList.remove('active'));
            state.recommendedLimit = 30; // Reset pagination limit
            state.othersLimit = 30; // Reset pagination limit
            refreshShowResultsButton();
            
            // Reset active states in UI instantly, then defer heavy search execution
            setTimeout(() => {
                renderResults();
                updateUrl();
            }, 20);
        });
    }

    // Map Marker Toggle
    const hideMarkersToggle = document.getElementById('hide-others-markers');
    if (hideMarkersToggle) {
        hideMarkersToggle.addEventListener('change', (e) => {
            state.hideLowQualityMarkers = e.target.checked;
            state.showOthers = !e.target.checked; // Sync list expansion with map toggle
            
            trackEvent('toggle_recommended_only', {
                action: state.hideLowQualityMarkers ? 'on' : 'off',
                location_context: state.searchLocation ? (state.searchLocation.name === '我附近' ? 'nearby' : state.searchLocation.name) : 'none'
            });
            
            // Update checkbox state instantly, then defer heavy rendering
            setTimeout(() => {
                renderResults();
            }, 20);
        });
    }

    // Toggle Others
    toggleOthersBtn.addEventListener('click', () => {
        // Track BEFORE state change to get current counts
        const recommended = state.currentResults.filter(r => ['High', 'Medium', '高', '中'].includes(r.parent_friendly_level));
        const others = state.currentResults.filter(r => ['Insufficient Info', 'Needs Attention', '資訊不足', '需留意'].includes(r.parent_friendly_level));
        
        if (!state.showOthers) {
            trackEvent('expand_other_results', {
                location_context: state.searchLocation ? (state.searchLocation.name === '我附近' ? 'nearby' : state.searchLocation.name) : 'none',
                visible_restaurant_count: recommended.length,
                hidden_restaurant_count: others.length
            });
        }

        state.showOthers = !state.showOthers;
        state.hideLowQualityMarkers = !state.showOthers; // Sync map toggle with list expansion
        if (hideMarkersToggle) hideMarkersToggle.checked = state.hideLowQualityMarkers;
        
        // Reset othersLimit when toggled
        state.othersLimit = 30;
        
        // Toggle expansion instantly, then defer heavy rendering
        setTimeout(() => {
            renderResults();
        }, 20);
    });

    // Reset Search
    resetSearchBtn.addEventListener('click', () => {
        state.searchLocation = null;
        state.userLocation = null;
        state.lastGeographicLocation = null;
        resetViewedRestaurantCount();
        state.filters.clear();
        state.cuisineFilter.clear();
        state.priceFilter.clear();
        state.hideLowQualityMarkers = true; // Reset to default: hide low quality
        state.showOthers = false; // Reset to default: hide others list
        state.recommendedLimit = 30; // Reset pagination limit
        state.othersLimit = 30; // Reset pagination limit
        
        document.querySelectorAll('.filter-chip:not(.price-chip)').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.price-chip').forEach(c => c.classList.remove('active'));
        updateCuisineFilterUI({ expand: false });
        const clearAllFiltersBtn = document.getElementById('clear-all-filters');
        if (clearAllFiltersBtn) clearAllFiltersBtn.classList.add('hidden');
        
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        searchResultsView.classList.add('hidden');
        if (floatShareBtn) floatShareBtn.classList.add('hidden');
        
        // Update checkbox UI
        const hideMarkersToggle = document.getElementById('hide-others-markers');
        if (hideMarkersToggle) hideMarkersToggle.checked = true;
        
        const trendingSection = document.querySelector('.trending-section');
        if (trendingSection) trendingSection.classList.remove('hidden');
        const featuresSection = document.querySelector('.features-section');
        if (featuresSection) featuresSection.classList.remove('hidden');
        document.querySelector('.main-header').style.display = 'block';
        homeView.classList.remove('search-active');
        homeView.classList.remove('header-collapsed');
        const btnShowResultsContainer = document.getElementById('btn-show-results-container');
        if (btnShowResultsContainer) btnShowResultsContainer.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        updateUrl(true);
        updateQuickLinksUI();
    });

    // Show Results Button
    const btnShowResults = document.getElementById('btn-show-results');
    if (btnShowResults) {
        btnShowResults.addEventListener('click', () => {
            homeView.classList.add('header-collapsed');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
                if (window.map) {
                    window.map.invalidateSize();
                }
            }, 300);
        });
    }

    // Modify Search Button
    const modifySearchBtn = document.getElementById('modify-search');
    if (modifySearchBtn) {
        modifySearchBtn.addEventListener('click', () => {
            homeView.classList.remove('header-collapsed');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Navigation
    backHomeBtn.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('loc') || params.get('f') || window.history.length > 1) {
            state.isUiNavigation = true;
            window.history.back();
            // Safety timeout to reset the flag if popstate is blocked/not fired
            setTimeout(() => {
                state.isUiNavigation = false;
            }, 100);
        } else {
            switchView('home');
            updateUrl(false);
        }
    });

    // Sharing
    if (floatShareBtn) floatShareBtn.addEventListener('click', shareCurrentFilters);
    detailShareBtn.addEventListener('click', () => {
        if (state.selectedRestaurant) shareRestaurant(state.selectedRestaurant);
    });

    // Detail Favorite Button
    const detailFavBtn = document.getElementById('btn-detail-fav');
    if (detailFavBtn) {
        detailFavBtn.addEventListener('click', () => {
            if (state.selectedRestaurant) {
                toggleFavorite(state.selectedRestaurant.place_id);
            }
        });
    }

    // Trending Items
    document.querySelectorAll('.trending-item').forEach(item => {
        item.addEventListener('click', () => {
            const locName = item.dataset.loc;
            const filter = item.dataset.filter;
            const scenarioTitle = item.textContent.trim();
            
            // Set filters
            state.filters.clear();
            if (filter) {
                state.filters.add(filter);
                // Sync UI chips
                document.querySelectorAll('.filter-chip:not(.price-chip)').forEach(chip => {
                    chip.classList.toggle('active', chip.dataset.filter === filter);
                });
            } else {
                document.querySelectorAll('.filter-chip:not(.price-chip)').forEach(chip => chip.classList.remove('active'));
            }

            const locObj = state.locationData.find(l => l.name === locName);
            if (locObj) selectLocation(locObj, 'suggested_scenario');
        });
    });

    // Shortlist Floating Button and Drawer Trigger
    const floatShortlistBtn = document.getElementById('float-shortlist');
    const closeShortlistDrawerBtn = document.getElementById('close-shortlist-drawer');
    const shortlistDrawerOverlay = document.getElementById('shortlist-drawer-overlay');
    const shortlistDrawer = document.getElementById('shortlist-drawer');
    const tabList = document.getElementById('tab-list');
    const tabCompare = document.getElementById('tab-compare');
    const clearShortlistBtn = document.getElementById('btn-clear-shortlist');
    const expandComparisonBtn = document.getElementById('btn-expand-comparison');
    const comparisonModalOverlay = document.getElementById('comparison-modal-overlay');
    const closeComparisonModalBtn = document.getElementById('close-comparison-modal');

    if (floatShortlistBtn) {
        floatShortlistBtn.addEventListener('click', () => {
            shortlistDrawer.classList.add('active');
            shortlistDrawerOverlay.classList.add('active');
            renderShortlistDrawer();
            syncComparisonExpandButton();
        });
    }

    if (closeShortlistDrawerBtn) {
        closeShortlistDrawerBtn.addEventListener('click', () => {
            shortlistDrawer.classList.remove('active');
            shortlistDrawerOverlay.classList.remove('active');
            shortlistDrawer.classList.remove('full-height');
            closeComparisonModal();
        });
    }

    if (shortlistDrawerOverlay) {
        shortlistDrawerOverlay.addEventListener('click', () => {
            shortlistDrawer.classList.remove('active');
            shortlistDrawerOverlay.classList.remove('active');
            shortlistDrawer.classList.remove('full-height');
            closeComparisonModal();
        });
    }

    // Touch Swiping / Tap Gestures for Drawer Height on Mobile
    const dragHandle = shortlistDrawer ? shortlistDrawer.querySelector('.drawer-drag-handle') : null;
    const drawerHeader = shortlistDrawer ? shortlistDrawer.querySelector('.drawer-header') : null;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const handleTouchStart = (e) => {
        // If the user touched a button or interactive element inside the header, ignore dragging
        if (e.target.closest('button') || e.target.closest('.drawer-actions')) {
            isDragging = false;
            return;
        }
        startY = e.touches[0].clientY;
        currentY = startY; // Reset currentY to startY to prevent stale values from previous gestures
        isDragging = true;
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        const diffY = startY - currentY; // Swipe up is positive

        if (diffY > 60) {
            // Swipe UP -> expand to full-height
            shortlistDrawer.classList.add('full-height');
        } else if (diffY < -60) {
            // Swipe DOWN -> contract to regular height or close
            if (shortlistDrawer.classList.contains('full-height')) {
                shortlistDrawer.classList.remove('full-height');
            } else {
                shortlistDrawer.classList.remove('active');
                shortlistDrawerOverlay.classList.remove('active');
            }
        }
    };

    if (dragHandle) {
        dragHandle.addEventListener('touchstart', handleTouchStart, { passive: true });
        dragHandle.addEventListener('touchmove', handleTouchMove, { passive: true });
        dragHandle.addEventListener('touchend', handleTouchEnd);
        dragHandle.addEventListener('click', () => {
            shortlistDrawer.classList.toggle('full-height');
        });
    }

    if (drawerHeader) {
        drawerHeader.addEventListener('touchstart', handleTouchStart, { passive: true });
        drawerHeader.addEventListener('touchmove', handleTouchMove, { passive: true });
        drawerHeader.addEventListener('touchend', handleTouchEnd);
    }

    if (tabList && tabCompare) {
        tabList.addEventListener('click', () => {
            tabList.classList.add('active');
            tabCompare.classList.remove('active');
            document.getElementById('shortlist-list-view').classList.add('active');
            document.getElementById('shortlist-compare-view').classList.remove('active');
            renderShortlistDrawer();
            syncComparisonExpandButton();
        });

        tabCompare.addEventListener('click', () => {
            tabCompare.classList.add('active');
            tabList.classList.remove('active');
            document.getElementById('shortlist-compare-view').classList.add('active');
            document.getElementById('shortlist-list-view').classList.remove('active');
            trackEvent('view_shortlist_compare', {
                shortlist_count: state.favorites.size
            });
            renderShortlistDrawer();
            syncComparisonExpandButton();
        });
    }

    if (expandComparisonBtn) {
        expandComparisonBtn.addEventListener('click', openComparisonModal);
    }

    if (comparisonModalOverlay) {
        comparisonModalOverlay.addEventListener('click', closeComparisonModal);
    }

    if (closeComparisonModalBtn) {
        closeComparisonModalBtn.addEventListener('click', closeComparisonModal);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeComparisonModal();
    });

    window.addEventListener('resize', syncComparisonExpandButton);

    if (clearShortlistBtn) {
        clearShortlistBtn.addEventListener('click', () => {
            if (confirm('確定要清空口袋名單中的所有餐廳嗎？')) {
                state.favorites.clear();
                saveFavorites();
                updateShortlistUI();
                renderShortlistDrawer();
                // Also update any visible card favorite states
                document.querySelectorAll('.card-favorite-btn').forEach(btn => {
                    btn.classList.remove('active');
                    btn.innerHTML = '🤍';
                });
                const detailFavBtn = document.getElementById('btn-detail-fav');
                if (detailFavBtn) {
                    detailFavBtn.classList.remove('active');
                    detailFavBtn.innerHTML = '🤍';
                }
                showToast('已清空口袋名單');
                updateUrl();
            }
        });
    }

    if (shareShortlistBtn) {
        shareShortlistBtn.addEventListener('click', () => {
            if (state.favorites.size === 0) return;
            const favIds = Array.from(state.favorites).join(',');
            const shareUrl = new URL(window.location.href.split('?')[0]);
            shareUrl.searchParams.set('favs', favIds);
            
            const shareText = `這是我精選的台北親子友善餐廳口袋名單，分享給你！`;
            const fullContent = `${shareText}\n${shareUrl.toString()}`;
            trackEvent('share_shortlist', {
                shortlist_count: state.favorites.size,
                location_context: getLocationContext()
            });
            
            if (navigator.share) {
                navigator.share({
                    title: '我的台北親子餐廳口袋名單',
                    text: shareText,
                    url: shareUrl.toString()
                }).catch(err => {
                    if (err.name !== 'AbortError') {
                        copyToClipboard(fullContent, true);
                        showToast('考慮清單連結已複製，快分享給好友吧！');
                    }
                });
            } else {
                copyToClipboard(fullContent, true);
                showToast('考慮清單連結已複製，快分享給好友吧！');
            }
        });
    }

    // Dynamic re-render on resize/orientationchange to toggle between portrait transposed table and landscape standard table
    window.addEventListener('resize', () => {
        const shortlistDrawer = document.getElementById('shortlist-drawer');
        if (shortlistDrawer && shortlistDrawer.classList.contains('active')) {
            renderShortlistDrawer();
        }
    });

    // popstate listener for back/forward browser buttons
    window.addEventListener('popstate', (e) => {
        console.log('Popstate detected, syncing view with URL...');
        const useAnimation = state.isUiNavigation;
        state.isUiNavigation = false; // Reset flag
        syncStateFromUrl(false, useAnimation);
    });

    // Map size toggle (Enlarge Map)
    const toggleMapSizeBtn = document.getElementById('btn-toggle-map-size');
    const mapContainer = document.getElementById('map-container');
    if (toggleMapSizeBtn && mapContainer) {
        toggleMapSizeBtn.addEventListener('click', () => {
            const isEnlarged = mapContainer.classList.toggle('enlarged');
            const iconSpan = toggleMapSizeBtn.querySelector('.icon');
            const textSpan = toggleMapSizeBtn.querySelector('.toggle-btn-text');
            
            if (isEnlarged) {
                if (iconSpan) {
                    iconSpan.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
                        </svg>
                    `;
                }
                if (textSpan) textSpan.textContent = '收合地圖';
                trackEvent('enlarge_map', { action: 'enlarge' });
            } else {
                if (iconSpan) {
                    iconSpan.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                        </svg>
                    `;
                }
                if (textSpan) textSpan.textContent = '放大地圖';
                trackEvent('enlarge_map', { action: 'collapse' });
            }
            
            // Redraw Leaflet map size dynamically during the height transition
            let count = 0;
            const interval = setInterval(() => {
                if (state.map) {
                    state.map.invalidateSize();
                }
                count++;
                if (count >= 20) { // 20 iterations * 20ms = 400ms transition duration
                    clearInterval(interval);
                }
            }, 20);
        });
    }

    // Feedback Modal Close & Cancel Actions
    const closeFeedbackBtn = document.getElementById('close-feedback-modal');
    if (closeFeedbackBtn) {
        closeFeedbackBtn.addEventListener('click', closeFeedbackModal);
    }
    
    const cancelFeedbackBtn = document.getElementById('btn-cancel-feedback');
    if (cancelFeedbackBtn) {
        cancelFeedbackBtn.addEventListener('click', closeFeedbackModal);
    }
    
    const feedbackOverlay = document.getElementById('feedback-modal-overlay');
    if (feedbackOverlay) {
        feedbackOverlay.addEventListener('click', closeFeedbackModal);
    }
    
    // Feedback Form Submit Action
    const feedbackForm = document.getElementById('feedback-form');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', handleFeedbackSubmit);
    }

    const siteFeedbackBtn = document.getElementById('float-site-feedback');
    if (siteFeedbackBtn) {
        siteFeedbackBtn.addEventListener('click', openSiteFeedbackModal);
    }

    const closeSiteFeedbackBtn = document.getElementById('close-site-feedback-modal');
    if (closeSiteFeedbackBtn) {
        closeSiteFeedbackBtn.addEventListener('click', closeSiteFeedbackModal);
    }

    const cancelSiteFeedbackBtn = document.getElementById('btn-cancel-site-feedback');
    if (cancelSiteFeedbackBtn) {
        cancelSiteFeedbackBtn.addEventListener('click', closeSiteFeedbackModal);
    }

    const siteFeedbackOverlay = document.getElementById('site-feedback-modal-overlay');
    if (siteFeedbackOverlay) {
        siteFeedbackOverlay.addEventListener('click', closeSiteFeedbackModal);
    }

    const siteFeedbackForm = document.getElementById('site-feedback-form');
    if (siteFeedbackForm) {
        siteFeedbackForm.addEventListener('submit', handleSiteFeedbackSubmit);
    }

    // Touch Swiping Gestures for Feedback Modal on Mobile
    const feedbackModal = document.getElementById('feedback-modal');
    const feedbackDragHandle = feedbackModal ? feedbackModal.querySelector('.drawer-drag-handle') : null;
    const feedbackHeader = feedbackModal ? feedbackModal.querySelector('.modal-header') : null;

    let feedbackStartY = 0;
    let feedbackCurrentY = 0;
    let feedbackIsDragging = false;

    const handleFeedbackTouchStart = (e) => {
        // If the user touched a button or interactive element inside the header, ignore dragging
        if (e.target.closest('button') || e.target.closest('.modal-close-btn')) {
            feedbackIsDragging = false;
            return;
        }
        feedbackStartY = e.touches[0].clientY;
        feedbackCurrentY = feedbackStartY;
        feedbackIsDragging = true;
    };

    const handleFeedbackTouchMove = (e) => {
        if (!feedbackIsDragging) return;
        feedbackCurrentY = e.touches[0].clientY;
    };

    const handleFeedbackTouchEnd = () => {
        if (!feedbackIsDragging) return;
        feedbackIsDragging = false;
        const diffY = feedbackStartY - feedbackCurrentY; // Swipe up is positive, swipe down is negative

        // Swipe DOWN -> close feedback modal
        if (diffY < -60) {
            closeFeedbackModal();
        }
    };

    if (feedbackDragHandle) {
        feedbackDragHandle.addEventListener('touchstart', handleFeedbackTouchStart, { passive: true });
        feedbackDragHandle.addEventListener('touchmove', handleFeedbackTouchMove, { passive: true });
        feedbackDragHandle.addEventListener('touchend', handleFeedbackTouchEnd);
    }

    if (feedbackHeader) {
        feedbackHeader.addEventListener('touchstart', handleFeedbackTouchStart, { passive: true });
        feedbackHeader.addEventListener('touchmove', handleFeedbackTouchMove, { passive: true });
        feedbackHeader.addEventListener('touchend', handleFeedbackTouchEnd);
    }

    // ESC key closes feedback modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('feedback-modal');
            if (modal && modal.classList.contains('active')) {
                closeFeedbackModal();
            }
        }
    });

}

function showPopularRecommendations() {
    const popularList = [
        { name: '我附近', type: '目前位置', icon: '📍' },
        { name: '台北市全區', type: '全市', icon: '🗺️' },
        { name: '台北車站', type: '捷運站/車站/地標', icon: '🚇' },
        { name: '西門町', type: '商圈/捷運站', icon: '🚇' },
        { name: '中山站', type: '捷運站/商圈', icon: '🚇' }
    ];

    autocompleteDropdown.innerHTML = `
        <div class="autocomplete-section-title" style="padding: 0.5rem 1rem 0.25rem; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); background: #f8fafc; border-bottom: 1px solid #e2e8f0;">熱門推薦區域</div>
        ${popularList.map(loc => `
            <div class="autocomplete-item" data-name="${loc.name}">
                <span class="icon">${loc.icon}</span>
                <span class="name">${loc.name}</span>
                <span class="type">${loc.type}</span>
            </div>
        `).join('')}
    `;
    autocompleteDropdown.classList.remove('hidden');

    autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const name = item.dataset.name;
            if (name === '我附近') {
                handleNearby();
            } else if (name === '台北市全區') {
                const taipeiAllLoc = {
                    name: '整個台北市',
                    type: '全市',
                    district: '全市',
                    lat: 25.037487,
                    lng: 121.564766
                };
                selectLocation(taipeiAllLoc, 'autocomplete_popular');
            } else {
                const locObj = state.locationData.find(l => l.name === name);
                if (locObj) selectLocation(locObj, 'autocomplete_popular');
            }
            autocompleteDropdown.classList.add('hidden');
        });
    });
}


function handleNearby() {
    if (!navigator.geolocation) {
        showToast('瀏覽器不支援定位功能');
        return;
    }

    const btnNearbyProminent = document.getElementById('btn-nearby-prominent');
    const mapPinSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" style="display: block; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
            <circle cx="12" cy="9" r="3.2" fill="#7A1E1A"/>
        </svg>
    `;

    if (btnNearby) btnNearby.innerHTML = '<span class="icon">⏳</span>';
    if (btnNearbyProminent) {
        btnNearbyProminent.innerHTML = '<span class="icon">⏳</span><span>定位中...</span>';
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const loc = {
                name: '我附近',
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                type: '目前位置'
            };
            state.userLocation = { lat: loc.lat, lng: loc.lng };
            selectLocation(loc, 'nearby');
            
            if (btnNearby) btnNearby.innerHTML = '<span class="icon">📍</span>';
            if (btnNearbyProminent) {
                btnNearbyProminent.innerHTML = `<span class="icon">${mapPinSvg}</span><span>我附近</span>`;
            }
        },
        (err) => {
            console.error(err);
            if (err && err.code === 1) {
                showToast('已停用定位。請點擊網址列旁的「鎖頭」或「設定」圖示重新開啟定位權限，或手動輸入地點。', 6000);
            } else {
                showToast('定位失敗，請手動輸入地點');
            }
            
            if (btnNearby) btnNearby.innerHTML = '<span class="icon">📍</span>';
            if (btnNearbyProminent) {
                btnNearbyProminent.innerHTML = `<span class="icon">${mapPinSvg}</span><span>我附近</span>`;
            }
        }
    );
}

function selectLocation(loc, source = 'other', pushState = true) {
    state.searchLocation = loc;
    resetViewedRestaurantCount();
    if (loc && loc.type !== '特定餐廳') {
        state.lastGeographicLocation = loc;
    }
    state.showOthers = false; // Reset to only show High+Medium results on new search
    state.expandedRadius = false; // Reset search range expansion
    state.recommendedLimit = 30; // Reset pagination limit
    state.othersLimit = 30; // Reset pagination limit
    searchInput.value = loc.name;
    
    // Dismiss mobile keyboard and focus
    if (searchInput) searchInput.blur();
    if (document.activeElement) {
        document.activeElement.blur();
    }
    
    autocompleteDropdown.classList.add('hidden');
    clearSearchBtn.classList.add('hidden');
    
    // Switch UI to results mode
    document.querySelector('.main-header').style.display = 'block'; 
    
    // Hide home-only sections
    const trendingSection = document.querySelector('.trending-section');
    if (trendingSection) trendingSection.classList.add('hidden');
    const featuresSection = document.querySelector('.features-section');
    if (featuresSection) featuresSection.classList.add('hidden');
    
    searchResultsView.classList.remove('hidden');
    if (floatShareBtn) floatShareBtn.classList.add('hidden'); // Ensure hidden as per user feedback
    currentSearchLocText.textContent = loc.name;
    refreshShowResultsButton();
    
    // CRITICAL: Leaflet needs to know the size changed after being unhidden
    if (state.map) {
        setTimeout(() => {
            state.map.invalidateSize();
            renderResults();
            updateUrl(pushState);
            
        }, 120);
    } else {
        renderResults();
        updateUrl(pushState);
    }
    updateQuickLinksUI();
}

async function renderResults() {
    try {
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
            const hasFilters = state.filters && state.filters.size > 0;
            const hasCuisine = hasCuisineFilters();
            const hasPrice = hasPriceFilters();

            if (hasFilters || hasCuisine || hasPrice) {
                activeFiltersBar.classList.remove('hidden');

                if (hasPrice) {
                    const priceLabels = {
                        'PRICE_LEVEL_INEXPENSIVE': '💰 平價',
                        'PRICE_LEVEL_MODERATE': '💵 中價',
                        'PRICE_LEVEL_EXPENSIVE': '💎 高價'
                    };
                    state.priceFilter.forEach(price => {
                        const indicator = document.createElement('span');
                        indicator.className = 'filter-indicator-mini filter-price-indicator';
                        indicator.textContent = priceLabels[price] || price;
                        activeFiltersBar.appendChild(indicator);
                    });
                }

                if (hasCuisine) {
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
                        '複合式料理': '🥗'
                    };
                    state.cuisineFilter.forEach(cuisine => {
                        const indicator = document.createElement('span');
                        indicator.className = 'filter-indicator-mini filter-cuisine-indicator';
                        const emoji = cuisineEmojis[cuisine] || '🍽️';
                        indicator.textContent = `${emoji} ${getCuisineFilterLabel(cuisine)}`;
                        activeFiltersBar.appendChild(indicator);
                    });
                }

                if (hasFilters) {
                    state.filters.forEach(f => {
                        const icon = attributeIcons[f] || '✨';
                        const label = attributeLabels[f] || f;
                        const indicator = document.createElement('span');
                        indicator.className = 'filter-indicator-mini';
                        indicator.textContent = `${icon} ${label}`;
                        activeFiltersBar.appendChild(indicator);
                    });
                }
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
        if (!center) {
            updateShowResultsButton(0);
            return;
        }

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
        if (center.type === '多行政區') {
            filtered = restaurants.filter(res => 
                res.district && center.districts.includes(res.district)
            );
        } else if (center.type === '行政區') {
            filtered = restaurants.filter(res => 
                res.district === center.name
            );
        } else if (center.type === '多地點') {
            filtered = restaurants.filter(res => {
                let matched = false;
                let minDistance = Infinity;
                center.locations.forEach(loc => {
                    if (loc.type === '行政區') {
                        if (res.district === loc.name) {
                            matched = true;
                            const distToLoc = calculateDistance(loc.lat, loc.lng, res.latitude, res.longitude);
                            if (distToLoc < minDistance) {
                                minDistance = distToLoc;
                            }
                        }
                    } else {
                        const distToLoc = calculateDistance(loc.lat, loc.lng, res.latitude, res.longitude);
                        let maxRadius = (loc.type === '全市') ? 99999 : ((loc.type === '行政區') ? 2.5 : 1.5);
                        if (state.expandedRadius) {
                            maxRadius = (loc.type === '全市') ? 99999 : ((loc.type === '行政區') ? 5.0 : 3.0);
                        }
                        if (distToLoc <= maxRadius) {
                            matched = true;
                            if (distToLoc < minDistance) {
                                minDistance = distToLoc;
                            }
                        }
                    }
                });
                if (matched) {
                    res.distance = minDistance;
                    return true;
                }
                return false;
            });
        } else if (center.type === '捷運站周邊') {
            // Find all MRT stations in locationData
            const mrtStations = state.locationData.filter(l => l.type === '捷運站' || l.name.endsWith('站'));
            filtered = restaurants.filter(res => {
                let minMrtDist = Infinity;
                mrtStations.forEach(mrt => {
                    const dist = calculateDistance(mrt.lat, mrt.lng, res.latitude, res.longitude);
                    if (dist < minMrtDist) {
                        minMrtDist = dist;
                    }
                });
                res.distance = minMrtDist;
                return minMrtDist <= 0.8; // 800m
            });
        } else if (center.keyword) {
            const q = center.keyword.toLowerCase();
            filtered = restaurants.filter(res => 
                (res.name && res.name.toLowerCase().includes(q)) ||
                (res.address && res.address.toLowerCase().includes(q)) ||
                (res.cuisine && res.cuisine.toLowerCase().includes(q)) ||
                (getSearchableText(res.cuisine_group).toLowerCase().includes(q)) ||
                (res.district && res.district.toLowerCase().includes(q))
            );
        } else {
            let maxRadius = (center.type === '全市' || center.name === '整個台北市') ? 99999 : 1.5;
            if (state.expandedRadius) {
                maxRadius = (center.type === '全市' || center.name === '整個台北市') ? 99999 : 3.0;
            }
            filtered = restaurants.filter(res => res.distance <= maxRadius);
        }

        // Apply cuisine filter if active
        filtered = filtered.filter(matchesCuisineFilter).filter(matchesPriceFilter);

        if (filtered.length === 0) {
            updateShowResultsButton(0);
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

            return (a.distance || 0) - (b.distance || 0); // Tertiarily sort by distance (nearest first)
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

        const fullMatchCount = (state.filters && state.filters.size > 0)
            ? sorted.filter(res => isFullAttributeFilterMatch(res, state.filters)).length
            : filtered.length;
        updateShowResultsButton(fullMatchCount);

        // Render recommended cards up to the recommendedLimit
        const visibleRecommended = recommended.slice(0, state.recommendedLimit);
        visibleRecommended.forEach(res => renderCard(res, recommendedList, res.dynamicLevel));

        // If there are more recommended items, render the Load More button
        if (recommended.length > state.recommendedLimit) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'btn-load-more';
            loadMoreBtn.textContent = '\u8f09\u5165\u66f4\u591a\u63a8\u85a6';
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
                loadMoreBtn.textContent = '\u8f09\u5165\u66f4\u591a\u9078\u9805';
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
                    msg = `此區域附近完全符合條件的選擇較少（僅 ${fullyMatchingCount} 間）。`;
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

                const isWholeCity = (center.type === '全市' || center.name === '整個台北市' || center.type === '多行政區' || center.type === '行政區');
                let expandHtml = '';
                if (!isWholeCity) {
                    if (!state.expandedRadius) {
                        expandHtml = `或者，您可以嘗試 <a href="#" id="btn-expand-search" style="color: #2563eb; text-decoration: underline; cursor: pointer; font-weight: 700; margin-left: 2px;">擴大搜尋範圍</a>。`;
                    } else {
                        expandHtml = `（已擴大搜尋範圍）`;
                    }
                }

                fallbackHint.innerHTML = `${msg}${recommendation}${expandHtml}`;
                fallbackHint.classList.remove('hidden');

                const btnExpand = document.getElementById('btn-expand-search');
                if (btnExpand) {
                    btnExpand.onclick = (e) => {
                        e.preventDefault();
                        state.expandedRadius = true;
                        state.recommendedLimit = 30; // Reset pagination limit
                        state.othersLimit = 30; // Reset pagination limit
                        renderResults();
                    };
                }
            }
        } else if (state.filters && state.filters.size > 0 && exactMatches.length === 0) {
            if (recommended.length > 0) {
                fallbackHint.innerHTML = '找不到符合勾選條件的餐廳，請參考以下其他友善選擇：';
            } else {
                fallbackHint.innerHTML = '找不到符合勾選條件的餐廳，請調整條件，或參考下方「查看更多」選項。';
            }
            fallbackHint.classList.remove('hidden');
        }
        
        // Update Toggle UI
        othersList.classList.toggle('hidden', !state.showOthers);
        toggleOthersBtn.classList.toggle('active', state.showOthers);
        toggleOthersBtn.querySelector('span').textContent = state.showOthers ? '收合額外選項' : '查看更多 (含資訊不足或不符合條件)';
        document.getElementById('others-section').classList.toggle('hidden', others.length === 0);

        const mapData = state.showOthers ? sorted : recommended;
        renderMap(mapData); 

        // Update Clear Filters button visibility
        const clearAllFiltersBtn = document.getElementById('clear-all-filters');
        if (clearAllFiltersBtn) {
            clearAllFiltersBtn.classList.toggle('hidden', state.filters.size === 0 && state.priceFilter.size === 0);
        }

        const hideMarkersToggle = document.getElementById('hide-others-markers');
        if (hideMarkersToggle) {
            hideMarkersToggle.checked = state.hideLowQualityMarkers;
        }
    } catch (err) {
        console.error('Error rendering results:', err);
        showToast('載入結果時發生錯誤');
    }
}

function handleNoResults(center) {
    noResultsState.classList.remove('hidden');
    document.getElementById('no-results-title').textContent = `找不到「${center.name}」附近的親子友善餐廳`;
    
    // Find suggestions: closest districts or landmarks
    const suggestions = state.locationData
        .filter(l => l.name !== center.name)
        .sort((a, b) => calculateDistance(center.lat, center.lng, a.lat, a.lng) - calculateDistance(center.lat, center.lng, b.lat, b.lng))
        .slice(0, 3);

    const suggestionContainer = document.getElementById('no-results-suggestions');
    suggestionContainer.innerHTML = suggestions.map(s => `
        <button class="suggestion-chip" onclick="selectLocationByName('${s.name}')">${s.name}</button>
    `).join('');
    
    renderMap([]);
}

window.selectLocationByName = (name) => {
    const loc = state.locationData.find(l => l.name === name);
    if (loc) selectLocation(loc);
};

function renderCard(res, container, overrideLevel) {
    if (res.ai_summary && !res._ai_summary_patched) {
        res.ai_summary = patchAiSummary(res, res.ai_summary, { maxSentences: 4, maxChars: 360 });
        res._ai_summary_patched = true;
    }
    if (res.card_summary && !res._card_summary_patched) {
        res.card_summary = patchAiSummary(res, res.card_summary, { maxSentences: 3, maxChars: 220 });
        res._card_summary_patched = true;
    }

    const card = document.createElement('div');
    card.className = 'restaurant-card';
    card.id = `card-${res.place_id}`;
    card.style.cursor = 'pointer';

    // Calculate dynamic status based on new rules
    const status = getDynamicStatus(res, state.filters);
    const level = status.level;
    const levelClass = status.class;
    const displayLabel = status.label;

    // Collect tags/warnings for quick viewing
    const summaryTags = getPFSummaryTags(res, level);
    let extraInfoHtml = '';
    if (summaryTags) {
        extraInfoHtml = `<span class="summary-tags-text ${levelClass}">${summaryTags}</span>`;
    }

    let nearestName = '';
    if (state.searchLocation) {
        if (state.searchLocation.type === '多地點') {
            let minDistance = Infinity;
            let nearestLoc = null;
            state.searchLocation.locations.forEach(loc => {
                const d = calculateDistance(loc.lat, loc.lng, res.latitude, res.longitude);
                if (d < minDistance) {
                    minDistance = d;
                    nearestLoc = loc;
                }
            });
            if (nearestLoc) {
                nearestName = nearestLoc.name;
            }
        } else if (state.searchLocation.type === '捷運站周邊') {
            const mrtStations = state.locationData.filter(l => l.type === '捷運站' || l.name.endsWith('站'));
            let minMrtDist = Infinity;
            let nearestMrt = null;
            mrtStations.forEach(mrt => {
                const d = calculateDistance(mrt.lat, mrt.lng, res.latitude, res.longitude);
                if (d < minMrtDist) {
                    minMrtDist = d;
                    nearestMrt = mrt;
                }
            });
            if (nearestMrt) {
                nearestName = nearestMrt.name;
            }
        }
    }

    const isWholeCity = state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市' || state.searchLocation.type === '多行政區');
    const times = (!isWholeCity && res.distance) ? calculateTravelTimes(res.distance) : null;
    let timeHtml = '';
    if (times) {
        if (nearestName) {
            timeHtml = `<span class="card-footer-time">(${nearestName} 🚶${times.walking}分·🚗${times.driving}分)</span>`;
        } else {
            timeHtml = `<span class="card-footer-time">(🚶${times.walking}分鐘·🚗${times.driving}分鐘)</span>`;
        }
    }

    const displayPriceLevels = getDisplayPriceLevels(res);
    const priceSymbol = getPriceSymbolForLevels(displayPriceLevels);
    const isMultiPrice = displayPriceLevels.length > 1;
    const inferredPrice = displayPriceLevels[displayPriceLevels.length - 1] || inferPriceLevel(res);
    const metaParts = [];
    if (res.cuisine) {
        metaParts.push(`<span class="card-cuisine">${res.cuisine}</span>`);
    }
    if (priceSymbol) {
        metaParts.push(`<span class="card-price" title="${isMultiPrice ? displayPriceLevels.join(',') : inferredPrice}">${priceSymbol}</span>`);
    }

    const metaHtml = metaParts.join('<span class="card-meta-dot">·</span>');

    const cardDistrict = getCardDistrict(res.address, res.district);
    const cardAddress = formatAddressForCard(res.address, cardDistrict);
    const cardStreetAddress = formatStreetAddressForCard(cardAddress, cardDistrict);

    const isFav = state.favorites.has(res.place_id);
    card.innerHTML = `
        <button class="card-map-btn" data-place-id="${res.place_id}" title="在地圖上查看">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
        </button>
        <button class="card-favorite-btn ${isFav ? 'active' : ''}" data-place-id="${res.place_id}" title="${isFav ? '移出口袋名單' : '加入口袋名單'}">
            ${isFav ? '❤️' : '🤍'}
        </button>
        <div class="card-header-row">
            <div class="restaurant-name">${formatRestaurantName(res.name)}</div>
        </div>
        ${metaHtml ? `
        <div class="card-meta-row">
            ${metaHtml}
        </div>
        ` : ''}
        <div class="card-status-row">
            <div class="decision-summary ${levelClass}">
                <span class="status-dot"></span>
                ${displayLabel}
            </div>
            ${extraInfoHtml}
        </div>
        <div class="card-summary">${getDisplaySummary(res, res.card_summary || res.ai_summary, { maxSentences: 3, maxChars: 220 })}</div>
        ${(res.address || timeHtml) ? `
        <div class="card-address-row">
            ${res.address ? `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${cardDistrict ? `<span class="restaurant-district">${cardDistrict}</span>` : ''}
            ${cardStreetAddress ? `<span class="restaurant-address" title="${fixSimplifiedAddress(res.address)}">${cardStreetAddress}</span>` : ''}
            ` : ''}
            ${(res.address && timeHtml) ? `<span class="card-meta-dot">\u00B7</span>` : ''}
            ${timeHtml ? timeHtml : ''}
        </div>
        ` : ''}

        <div class="card-detail-hint">查看詳情與行前資訊 ›</div>
    `;

    const mapBtn = card.querySelector('.card-map-btn');
    if (mapBtn) {
        mapBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            focusOnMap(e, res.place_id);
        });
    }

    const favBtn = card.querySelector('.card-favorite-btn');
    if (favBtn) {
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(res.place_id, e);
        });
    }

    card.addEventListener('click', (e) => {
        console.log('Card clicked, showing details:', res.name);
        try {
            const viewedCount = recordRestaurantDetailView(res);
            trackEvent('view_restaurant_detail', {
                ...getRestaurantEventParams(res, 'list_card'),
                viewed_restaurant_count: viewedCount
            });
        } catch (err) {}
        
        showDetail(res);
    });

    container.appendChild(card);
}

function focusOnMap(e, placeId) {
    e.stopPropagation();
    const res = restaurantData.find(r => r.place_id === placeId);
    const resultsView = document.getElementById('search-results-view');
    if (res && state.map && resultsView) {
        let needsReRender = false;
        
        // If it's a low quality marker and we are currently hiding them, toggle it off
        const status = getDynamicStatus(res, state.filters);
        const isLowQuality = (status.level === 'Insufficient Info' || status.level === 'Needs Attention');
        
        if (isLowQuality && state.hideLowQualityMarkers) {
            state.hideLowQualityMarkers = false;
            needsReRender = true;
        }

        // If marker doesn't exist in markerMap, it might be in 'others' or not rendered yet
        if (!state.markerMap[placeId]) {
            state.showOthers = true;
            needsReRender = true;
        }

        if (needsReRender) {
            renderResults();
        }

        // Pre-set popupOpen so moveend handler does not wipe popup
        state.popupOpen = true;

        // Offset the map center slightly North of the marker coordinate (res.latitude + 0.0008)
        // and pass { animate: false } to allow instantaneous positioning
        state.map.setView([res.latitude + 0.0008, res.longitude], 17, { animate: false });
        
        // Force refresh markers in the new viewport location to ensure the clicked marker is created
        refreshMapMarkers();

        const marker = state.markerMap[placeId];
        if (marker) {
            marker.openPopup();
        } else {
            state.popupOpen = false; // reset if marker failed to render
        }
        
        // Directly and reliably scroll the viewport using scrollIntoView
        safeScrollIntoView(resultsView);
    }
}

window.focusRestaurantOnMap = focusOnMap; // For backward compatibility if any


function showDetail(restaurant) {
    if (!restaurant) return;
    
    try {
        recordRestaurantDetailView(restaurant);
        state.selectedRestaurant = restaurant;
        renderDetailContent(restaurant);
        switchView('detail');
        updateUrl(true); // PUSH state on showing details
        
        // Track unique detail views for PWA install trigger
        if (restaurant.place_id && state.detailViews) {
            state.detailViews.add(restaurant.place_id);
            safeSession.setItem('pwa_detail_views', JSON.stringify(Array.from(state.detailViews)));
            if (typeof checkPwaInstallTrigger === 'function') {
                checkPwaInstallTrigger();
            }
        }
    } catch (err) {
        console.error('Error in showDetail:', err);
        showToast('無法載入詳情，請稍後再試');
    }
}

let lastScrollY = 0;

function switchView(viewName, animate = true) {
    if (state.viewTransitionTimeoutId) {
        clearTimeout(state.viewTransitionTimeoutId);
        state.viewTransitionTimeoutId = null;
    }

    if (!animate) {
        detailView.classList.add('no-transition');
    } else {
        detailView.classList.remove('no-transition');
    }

    if (viewName === 'detail') {
        state.view = 'detail';
        lastScrollY = window.scrollY;
        
        detailView.classList.add('active');
        detailView.scrollTo(0, 0); // Desktop detail view scrolls on the overlay itself
        detailContent.scrollTo(0, 0); // Scroll detail content back to its top
        document.body.style.overflow = 'hidden'; // Lock background window scroll to prevent double scrolling
    } else {
        state.view = 'home';
        detailView.classList.remove('active');
        
        const restoreHomeState = () => {
            document.body.style.overflow = ''; // Unlock background window scroll
            window.scrollTo(0, lastScrollY);
        };

        if (!animate) {
            restoreHomeState();
        } else {
            // Delay restoring background scrollbar until the slide-out transition
            // completely finishes (300ms) to prevent stutters or scroll position shifting during active animation.
            state.viewTransitionTimeoutId = setTimeout(() => {
                state.viewTransitionTimeoutId = null;
                restoreHomeState();
            }, 300);
        }
    }

    if (!animate) {
        void detailView.offsetHeight; // Force reflow
        detailView.classList.remove('no-transition');
    }
}


function getShareUrl() {
    const params = new URLSearchParams();
    if (state.searchLocation) {
        params.set('loc', state.searchLocation.name);
        if (state.searchLocation.lat && state.searchLocation.lng) {
            // 對於「我附近」或任何帶有座標的動態位置，強制附上經緯度
            params.set('lat', state.searchLocation.lat.toFixed(6));
            params.set('lng', state.searchLocation.lng.toFixed(6));
        }
        if (state.searchLocation.isFallback) {
            params.set('isFallback', '1');
            params.set('fbName', state.searchLocation.fallbackName);
        }
        if (state.searchLocation.resolvedAddress) {
            params.set('addr', state.searchLocation.resolvedAddress);
        }
        if (state.searchLocation.type === '特定餐廳' || state.searchLocation.place_id) {
            params.set('locType', 'restaurant');
        } else if (state.searchLocation.type === '關鍵字搜尋') {
            params.set('locType', 'keyword');
            if (state.searchLocation.keyword) {
                params.set('keyword', state.searchLocation.keyword);
            }
        }
    }
    state.filters.forEach(f => params.append('f', f));
    if (hasCuisineFilters()) {
        state.cuisineFilter.forEach(cuisine => params.append('cuisine', cuisine));
    }
    if (hasPriceFilters()) {
        state.priceFilter.forEach(price => params.append('price', price));
    }
    if (state.view === 'detail' && state.selectedRestaurant) {
        params.set('r', state.selectedRestaurant.place_id);
    }
    
    // 保持 favorites 在網址中，讓「在瀏覽器中開啟」能順利傳遞口袋名單
    if (state.favorites && state.favorites.size > 0) {
        params.set('favs', Array.from(state.favorites).join(','));
    }
    
    const queryString = params.toString();
    return window.location.origin + window.location.pathname + (queryString ? '?' + queryString : '');
}

function updateUrl(push = false) {
    const newUrl = getShareUrl();
    if (push) {
        if (window.location.href === newUrl && window.history.state && window.history.state.view === state.view) {
            return;
        }
        window.history.pushState({ view: state.view }, '', newUrl);
    } else {
        window.history.replaceState({ view: state.view }, '', newUrl);
    }
}

function urlMatchesCurrentState(params) {
    const locName = params.get('loc');
    const lat = params.get('lat');
    const lng = params.get('lng');
    
    const hasLocInUrl = !!locName;
    const hasLocInState = !!state.searchLocation;
    
    if (hasLocInUrl !== hasLocInState) return false;
    
    if (hasLocInUrl && hasLocInState) {
        if (state.searchLocation.name !== locName) return false;
        if (lat && state.searchLocation.lat) {
            if (Math.abs(state.searchLocation.lat - parseFloat(lat)) > 0.0001) return false;
        }
        if (lng && state.searchLocation.lng) {
            if (Math.abs(state.searchLocation.lng - parseFloat(lng)) > 0.0001) return false;
        }
    }
    
    // Check filters
    const urlFilters = params.getAll('f');
    if (urlFilters.length !== state.filters.size) return false;
    
    for (let f of urlFilters) {
        if (!state.filters.has(f)) return false;
    }

    // Check cuisine
    const urlCuisines = params.getAll('cuisine');
    if (urlCuisines.length !== state.cuisineFilter.size) return false;
    for (let cuisine of urlCuisines) {
        if (!state.cuisineFilter.has(cuisine)) return false;
    }

    // Check price
    const urlPrices = params.getAll('price');
    if (urlPrices.length !== state.priceFilter.size) return false;
    for (let price of urlPrices) {
        if (!state.priceFilter.has(price)) return false;
    }

    return true;
}

function syncStateFromUrl(isInitialLoad = false, animate = false) {
    const params = new URLSearchParams(window.location.search);
    
    // 1. 檢查是否有分享的考慮清單
    const favsParam = params.get('favs');
    if (favsParam) {
        console.log('Shared favorites detected:', favsParam);
        const ids = favsParam.split(',');
        let loadedAny = false;
        ids.forEach(id => {
            if (id && typeof restaurantData !== 'undefined' && restaurantData.some(r => r.place_id === id)) {
                state.favorites.add(id);
                loadedAny = true;
            }
        });
        if (loadedAny) {
            saveFavorites();
            updateShortlistUI();
            
            // 使用 sessionStorage 來記錄此連線階段是否已自動開啟過此分享的抽屜
            if (isInitialLoad) {
                const sessionKey = 'shortlist_auto_opened_' + favsParam;
                if (!safeSession.getItem(sessionKey)) {
                    safeSession.setItem(sessionKey, 'true');
                    
                    // 自動開啟口袋名單抽屜，讓使用者立即看到分享的項目
                    const openDrawer = () => {
                        const shortlistDrawer = document.getElementById('shortlist-drawer');
                        const shortlistDrawerOverlay = document.getElementById('shortlist-drawer-overlay');
                        if (shortlistDrawer && shortlistDrawerOverlay) {
                            shortlistDrawer.classList.add('active');
                            shortlistDrawerOverlay.classList.add('active');
                            renderShortlistDrawer();
                        }
                    };
                    if (document.readyState === 'complete') {
                        openDrawer();
                    } else {
                        window.addEventListener('load', openDrawer);
                    }
                }
            }
        }
    }

    // Check if the search parameters in URL match current active search state.
    // If they match, skip re-evaluating and re-rendering to prevent scroll resets/jumps!
    const searchStateMatches = urlMatchesCurrentState(params);

    if (!searchStateMatches) {
        console.log('Syncing search state from URL...');
        state.recommendedLimit = 30; // Reset pagination limit
        state.othersLimit = 30; // Reset pagination limit
        // 2. 恢復過濾條件
        state.filters.clear();
        document.querySelectorAll('.filter-chip:not(.price-chip)').forEach(c => c.classList.remove('active'));
        params.getAll('f').forEach(f => {
            state.filters.add(f);
            const chip = document.querySelector(`.filter-chip[data-filter="${f}"]`);
            if (chip) chip.classList.add('active');
        });

        // 2.5 恢復菜系過濾條件
        state.cuisineFilter.clear();
        params.getAll('cuisine').forEach(cuisine => state.cuisineFilter.add(cuisine));
        updateCuisineFilterUI({ expand: false });

        // 2.7 恢復價位過濾條件
        state.priceFilter.clear();
        document.querySelectorAll('.price-chip').forEach(c => c.classList.remove('active'));
        params.getAll('price').forEach(price => {
            state.priceFilter.add(price);
            const chip = document.querySelector(".price-chip[data-price=\"" + price + "\"]");
            if (chip) chip.classList.add('active');
        });

        // 3. 恢復搜尋地點
        const locName = params.get('loc');
        
        // Auto-recreate multi-location or multi-district location dynamically if present
        if (locName && locName.includes('、')) {
            const parts = locName.split('、');
            const matchedLocations = [];
            parts.forEach(p => {
                const locObj = state.locationData.find(l => l.name === p);
                if (locObj) {
                    matchedLocations.push(locObj);
                }
            });
            if (matchedLocations.length > 1) {
                const allDistricts = matchedLocations.every(l => l.type === '行政區');
                const multiLocType = allDistricts ? '多行政區' : '多地點';
                let sumLat = 0, sumLng = 0, count = 0;
                matchedLocations.forEach(loc => {
                    sumLat += loc.lat;
                    sumLng += loc.lng;
                    count++;
                });
                const avgLat = count > 0 ? sumLat / count : 25.0374;
                const avgLng = count > 0 ? sumLng / count : 121.5645;
                const multiLocationObj = {
                    name: locName,
                    type: multiLocType,
                    locations: matchedLocations,
                    districts: allDistricts ? matchedLocations.map(l => l.name) : [],
                    lat: avgLat,
                    lng: avgLng
                };
                if (!state.locationData.some(l => l.name === locName)) {
                    state.locationData.push(multiLocationObj);
                }
            }
        }
        
        const lat = params.get('lat');
        const lng = params.get('lng');
        
        if (lat && lng) {
            console.log('Syncing location from URL:', lat, lng);
            let matchedType = '分享位置';
            const locType = params.get('locType');
            if (locType === 'restaurant') {
                matchedType = '特定餐廳';
            } else if (locType === 'keyword') {
                matchedType = '關鍵字搜尋';
            }
            if (locName && state.locationData && state.locationData.length > 0) {
                const matchedLoc = state.locationData.find(l => l.name === locName);
                if (matchedLoc) {
                    matchedType = matchedLoc.type;
                }
            }

            const isFallback = params.get('isFallback') === '1';
            const fallbackName = params.get('fbName');
            const resolvedAddress = params.get('addr');
            const keyword = params.get('keyword');

            const loc = {
                name: locName || '分享的位置',
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                type: matchedType,
                isFallback: isFallback,
                fallbackName: fallbackName,
                resolvedAddress: resolvedAddress,
                keyword: keyword || undefined
            };
            
            // When syncing state back, do not push to history again
            if (document.readyState === 'complete') {
                selectLocation(loc, 'url_sync', false);
            } else {
                window.addEventListener('load', () => selectLocation(loc, 'url_sync', false));
            }
        } else if (locName && state.locationData.length > 0) {
            const loc = state.locationData.find(l => l.name === locName);
            if (loc) {
                if (document.readyState === 'complete') {
                    selectLocation(loc, 'url_sync', false);
                } else {
                    window.addEventListener('load', () => selectLocation(loc, 'url_sync', false));
                }
            }
        } else {
            // No location in URL: we are back at the landing page!
            state.searchLocation = null;
            state.userLocation = null;
            state.showOthers = false;
            searchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            searchResultsView.classList.add('hidden');
            if (floatShareBtn) floatShareBtn.classList.add('hidden');
            
            const clearAllFiltersBtn = document.getElementById('clear-all-filters');
            if (clearAllFiltersBtn) clearAllFiltersBtn.classList.add('hidden');
            
            state.cuisineFilter.clear();
            updateCuisineFilterUI({ expand: false });
            
            state.priceFilter.clear();
            document.querySelectorAll('.price-chip').forEach(c => c.classList.remove('active'));

            const trendingSection = document.querySelector('.trending-section');
            if (trendingSection) trendingSection.classList.remove('hidden');
            const featuresSection = document.querySelector('.features-section');
            if (featuresSection) featuresSection.classList.remove('hidden');
            document.querySelector('.main-header').style.display = 'block';
            homeView.classList.remove('search-active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            updateQuickLinksUI();
        }
    } else {
        console.log('URL search state matches current state, skipping search re-render.');
    }

    // 4. 恢復餐廳詳情
    const resId = params.get('r');
    if (resId && typeof restaurantData !== 'undefined') {
        const res = restaurantData.find(r => r.place_id === resId);
        if (res) {
            state.selectedRestaurant = res;
            renderDetailContent(res);
            switchView('detail', animate);
        } else {
            switchView('home', animate);
        }
    } else {
        switchView('home', animate);
    }
}

function copyToClipboard(text, quiet = false) {
    const performCopy = (txt) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(txt);
        } else {
            const input = document.createElement('textarea');
            input.value = txt;
            document.body.appendChild(input);
            input.select();
            const success = document.execCommand('copy');
            document.body.removeChild(input);
            return success ? Promise.resolve() : Promise.reject();
        }
    };

    performCopy(text).then(() => {
        if (!quiet) showToast('已複製分享內容');
    }).catch(err => {
        console.error('Clipboard failed', err);
        // Last resort: prompt the user to copy manually
        window.prompt('請手動複製分享內容：', text);
    });
}

function shareCurrentFilters() {
    const url = getShareUrl();
    const locationName = state.searchLocation ? state.searchLocation.name : '台北';
    const shareText = `我在看「${locationName}」附近適合帶小孩的餐廳，推薦給你！`;
    const fullContent = `${shareText}\n${url}`;

    if (navigator.share) {
        navigator.share({
            title: '帶小孩吃什麼？',
            text: shareText,
            url: url
        }).catch(err => {
            if (err.name !== 'AbortError') {
                copyToClipboard(fullContent);
            }
        });
    } else {
        copyToClipboard(fullContent);
    }
}

function shareRestaurant(res) {
    const url = getShareUrl();
    const cleanAddr = fixSimplifiedAddress(res.address);
    const shareText = `推薦這間親子友善餐廳給你：${res.name}！\n地址：${cleanAddr}`;
    const fullContent = `${shareText}\n${url}`;
    const params = getRestaurantEventParams(res, 'detail_share_button');

    trackEvent('share_restaurant', params);

    if (navigator.share) {
        navigator.share({
            title: res.name,
            text: shareText,
            url: url
        }).catch(err => {
            if (err.name !== 'AbortError') {
                copyToClipboard(fullContent);
            }
        });
    } else {
        copyToClipboard(fullContent);
    }
}

// Utilities


let toastTimeoutId = null;
function showToast(msg, duration = 3000) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.zIndex = "9999"; // Ensure it's on top
    toast.classList.add('show');
    
    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
    }
    toastTimeoutId = setTimeout(() => {
        toast.classList.remove('show');
        toastTimeoutId = null;
    }, duration);
}

// Shortlist & Favorite Helpers

// Feedback Modal functions

// PWA Installation Prompt Logic



document.addEventListener('click', handleHomeFeedbackLinkClick);
// Start the app
init();
