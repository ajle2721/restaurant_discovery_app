import "./styles/main.css";
import { locationData } from "./data/locations.js";
import { restaurantData } from "./data/restaurant-index.js";
import { createFeedbackController } from "./feedback/feedback-controller.js";
import { createLeafletMapController } from "./map/leaflet-map.js";
import { createUrlStateController } from "./navigation/url-state-controller.js";
import { trackEvent } from "./analytics/events.js";
import { levelLabels } from "./restaurants/attributes.js";
import {
    fixSimplifiedAddress,
} from "./restaurants/presentation.js";
import { createRestaurantCardRenderer } from "./restaurants/card-renderer.js";
import { createRestaurantDetailController } from "./restaurants/detail-controller.js";
import { getPFSummaryTags as formatPFSummaryTags } from "./restaurants/summary-tags.js";
import { setupPwaInstallPrompt } from "./pwa/install-prompt.js";
import { createAutocompleteController } from "./search/autocomplete-controller.js";
import {
    getCuisineFilterSummary as formatCuisineFilterSummary,
    hasCuisineFilters as hasSelectedCuisineFilters,
} from "./search/cuisine-filter.js";
import {
    getDynamicStatus,
    getParentFriendlyBaseScore,
} from "./search/scoring.js";
import { createSearchEvents } from "./search/search-events.js";
import { createResultsController } from "./search/results-controller.js";
import { createShortlistController } from "./shortlist/shortlist-controller.js";
import { state } from "./state/app-state.js";
import { safeSession } from "./state/storage.js";

const {
    openFeedbackModal,
    setupFeedbackEvents,
    submitAiFeedback,
} = createFeedbackController({ getLocationContext, showToast });

const {
    getShareUrl,
    syncStateFromUrl,
    updateUrl,
} = createUrlStateController({
    renderDetailContent: (...args) => renderDetailContent(...args),
    renderShortlistDrawer: (...args) => renderShortlistDrawer(...args),
    saveFavorites: (...args) => saveFavorites(...args),
    selectLocation: (...args) => selectLocation(...args),
    switchView: (...args) => switchView(...args),
    updateCuisineFilterUI: (...args) => updateCuisineFilterUI(...args),
    updateQuickLinksUI: (...args) => updateQuickLinksUI(...args),
    updateShortlistUI: (...args) => updateShortlistUI(...args),
});

const {
    loadFavorites,
    renderShortlistDrawer,
    saveFavorites,
    setupShortlistEvents,
    toggleFavorite,
    updateShortlistUI,
} = createShortlistController({
    copyToClipboard,
    getDynamicStatus,
    getLocationContext,
    showToast,
    updateUrl,
});

const {
    initMap,
    refreshMapMarkers,
    renderMap,
    setupMapEvents,
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
    return formatPFSummaryTags(res, state.filters, overrideLevel, simpleFormat);
}

// DOM Elements
const homeView = document.getElementById('home-view');
const detailView = document.getElementById('detail-view');
const detailContent = document.getElementById('detail-content');
const backHomeBtn = document.getElementById('back-home');
const floatShareBtn = document.getElementById('float-share');
const detailShareBtn = document.getElementById('share-detail');
const toast = document.getElementById('toast');
const searchInput = document.getElementById('location-search');
const autocompleteDropdown = document.getElementById('search-autocomplete');
const btnNearby = document.getElementById('btn-nearby');
const searchMagnifier = document.getElementById('search-magnifier');
const clearSearchBtn = document.getElementById('clear-search');
const searchResultsView = document.getElementById('search-results-view');
const currentSearchLocText = document.getElementById('current-search-location');
const resetSearchBtn = document.getElementById('reset-search');
const toggleOthersBtn = document.getElementById('toggle-others');

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

const { renderCard } = createRestaurantCardRenderer({
    focusOnMap,
    getPFSummaryTags,
    getRestaurantEventParams,
    recordRestaurantDetailView,
    showDetail,
    toggleFavorite,
});

const {
    getResultMatchCount,
    renderResults,
} = createResultsController({
    renderCard,
    renderMap,
    selectLocation,
    showToast,
    updateShowResultsButton,
});

const { setupSearchEvents } = createSearchEvents({
    autocompleteDropdown,
    btnNearby,
    clearSearchBtn,
    executeSearch,
    floatShareBtn,
    handleAutocomplete,
    handleNearby,
    homeView,
    refreshShowResultsButton,
    renderResults,
    resetSearchBtn,
    resetViewedRestaurantCount,
    searchInput,
    searchMagnifier,
    searchResultsView,
    selectLocation,
    showPopularRecommendations,
    toggleOthersBtn,
    trackSearchLocation,
    updateCuisineFilterUI,
    updateQuickLinksUI,
    updateUrl,
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

function hasPriceFilters() {
    return state.priceFilter && state.priceFilter.size > 0;
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

function refreshShowResultsButton() {
    updateShowResultsButton(getResultMatchCount());
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

        console.log('Map initialized');
        syncStateFromUrl(true);
        console.log('App initialized successfully');
    } catch (err) {
        console.error('App initialization failed:', err);
        showToast('網站載入失敗，請重新整理');
    }
}

function setupEventListeners() {
    setupSearchEvents();

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


    setupShortlistEvents();

    // popstate listener for back/forward browser buttons
    window.addEventListener('popstate', (e) => {
        console.log('Popstate detected, syncing view with URL...');
        const useAnimation = state.isUiNavigation;
        state.isUiNavigation = false; // Reset flag
        syncStateFromUrl(false, useAnimation);
    });

    setupMapEvents();

    setupFeedbackEvents();

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



// Start the app
init();
