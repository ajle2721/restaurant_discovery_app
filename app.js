const WEB3FORMS_ACCESS_KEY = "c7b3994f-f590-4126-a12f-111c28c58a19";

const safeSession = {
    getItem(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            console.warn('sessionStorage.getItem fallback:', e);
            return this._fallback[key] || null;
        }
    },
    setItem(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            console.warn('sessionStorage.setItem fallback:', e);
            this._fallback[key] = String(value);
        }
    },
    _fallback: {}
};

const safeLocal = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage.getItem fallback:', e);
            return this._fallback[key] || null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('localStorage.setItem fallback:', e);
            this._fallback[key] = String(value);
        }
    },
    _fallback: {}
};

const state = {
    filters: new Set(),
    searchLocation: null, // {name, lat, lng, type, district}
    userLocation: null, // {lat, lng}
    lastGeographicLocation: null, // {name, lat, lng, type, district}
    selectedRestaurant: null,
    view: 'home', // 'home', 'detail'
    map: null,
    markers: [],
    markerMap: {},
    locationData: [], // From taipei_locations.json
    showOthers: false,
    get hideLowQualityMarkers() {
        return !this.showOthers;
    },
    set hideLowQualityMarkers(val) {
        this.showOthers = !val;
    },
    currentResults: [],
    favorites: new Set(),
    viewTransitionTimeoutId: null,
    isUiNavigation: false,
    expandedRadius: false,
    recommendedLimit: 30,
    othersLimit: 30,
    detailViews: new Set(JSON.parse(safeSession.getItem('pwa_detail_views') || '[]'))
};

// Global Detail Viewer (must be global for onclick)
window.showDetailFromMap = function(placeId) {
    console.log('showDetailFromMap called with:', placeId);
    try {
        if (typeof restaurantData === 'undefined') {
            console.error('restaurantData is missing!');
            return;
        }
        const res = restaurantData.find(r => r.place_id === placeId);
        if (res) {
            showDetail(res);
        } else {
            console.error('Restaurant not found for ID:', placeId);
        }
    } catch (err) {
        console.error('Error in showDetailFromMap:', err);
    }
};

// GA4 Tracking Helper
function trackEvent(eventName, params) {
    try {
        if (typeof window.gtag === 'function') {
            var safeParams = {};
            if (params) {
                for (var key in params) {
                    if (key !== 'lat' && key !== 'lng' && key !== 'address') {
                        safeParams[key] = params[key];
                    }
                }
            }
            window.gtag('event', eventName, safeParams);
        }
    } catch (e) {
        console.warn('Tracking failed', e);
    }
}

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

const filterMap = {
    has_tableware: 'has_tableware',
    high_chair_available: 'child_seat_available',
    has_diaper_table: 'has_diaper_table',
    kids_menu: 'kids_menu_available',
    kid_noise_tolerant: 'kid_noise_tolerant',
    spacious_seating: 'spacious_seating',
    has_play_area: 'has_play_area',
    has_private_room: 'has_private_room'
};

const attributeIcons = {
    has_tableware: '🍽️',
    high_chair_available: '🪑',
    has_diaper_table: '🍼',
    kids_menu: '🥘',
    kid_noise_tolerant: '🥳',
    spacious_seating: '🛋️',
    has_play_area: '🧸',
    has_private_room: '🚪'
};

const attributeLabels = {
    has_tableware: '兒童餐具',
    high_chair_available: '兒童椅',
    has_diaper_table: '尿布台',
    kids_menu: '兒童餐',
    kid_noise_tolerant: '不怕吵',
    spacious_seating: '空間寬敞',
    has_play_area: '有遊樂區',
    has_private_room: '包廂或可包場'
};

const levelLabels = {
    'High': '👍 適合帶小孩',
    'Medium': '🙂 可以考慮',
    'Needs Attention': '⚠️ 需留意',
    'Insufficient Info': '❓ 資訊較少',
    '高': '👍 適合帶小孩',
    '中': '🙂 可以考慮',
    '需留意': '⚠️ 需留意',
    '資訊不足': '❓ 資訊較少'
};

const priceSymbols = {
    'PRICE_LEVEL_INEXPENSIVE': '$',
    'PRICE_LEVEL_MODERATE': '$$',
    'PRICE_LEVEL_EXPENSIVE': '$$$',
    'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$'
};

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
                if (!state.filters.has(k) && (attrs[k] === 'yes' || attrs[k] === 'likely')) {
                    otherYesAttrs.push(attributeDetails[k].yes + (attrs[k] === 'likely' ? '(估)' : ''));
                }
            });
            if (otherYesAttrs.length > 0) {
                return `具備其他特色：${otherYesAttrs.join('、')}`;
            }
        }

        let matchCount = 0;
        const matchedNames = [];
        state.filters.forEach(f => {
            if (attrs[f] === 'yes' || attrs[f] === 'likely') {
                matchCount++;
                matchedNames.push(attributeLabels[f] + (attrs[f] === 'likely' ? '(估)' : ''));
            }
        });
        if (matchCount > 0) {
            if (simpleFormat) {
                return `符合 ${matchCount}/${state.filters.size} 項勾選條件`;
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
    if (attrs.has_private_room === 'yes' || attrs.has_private_room === 'likely') tags.push('包廂或可包場' + (attrs.has_private_room === 'likely' ? '(估)' : ''));
    
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

function isAreaSearchLocation(loc) {
    if (!loc) return false;
    if (loc.place_id || loc.type === '特定餐廳') return false;
    if (loc.keyword) return true;
    if (loc.isFallback || loc.resolvedAddress) return true;
    if (loc.type === '關鍵字搜尋' || loc.type === '自訂地點') return true;
    if (state.locationData && state.locationData.some(l => l.name === loc.name)) return true;
    return loc.type === '目前位置' || loc.type === '全市';
}

function updateShowResultsButton(matchCount = 0) {
    const btnShowResultsContainer = document.getElementById('btn-show-results-container');
    const btnShowResults = document.getElementById('btn-show-results');
    if (!btnShowResultsContainer || !btnShowResults) return;

    const shouldShow = isAreaSearchLocation(state.searchLocation)
        && state.filters
        && state.filters.size > 0
        && matchCount > 0;

    btnShowResultsContainer.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) {
        btnShowResults.textContent = `查看 ${matchCount} 間餐廳`;
    }
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
            state.locationData = locationData;
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
    document.querySelectorAll('.filter-chip').forEach(chip => {
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

    // Clear All Filters
    const clearAllFiltersBtn = document.getElementById('clear-all-filters');
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            state.filters.clear();
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            state.recommendedLimit = 30; // Reset pagination limit
            state.othersLimit = 30; // Reset pagination limit
            
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
            trackEvent('click_show_more', {
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
        state.filters.clear();
        state.hideLowQualityMarkers = true; // Reset to default: hide low quality
        state.showOthers = false; // Reset to default: hide others list
        state.recommendedLimit = 30; // Reset pagination limit
        state.othersLimit = 30; // Reset pagination limit
        
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
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
                document.querySelectorAll('.filter-chip').forEach(chip => {
                    chip.classList.toggle('active', chip.dataset.filter === filter);
                });
            } else {
                document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
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

function handleAutocomplete() {
    const query = searchInput.value.trim().toLowerCase();
    if (query.length === 0) {
        showPopularRecommendations();
        clearSearchBtn.classList.add('hidden');
        return;
    }
    clearSearchBtn.classList.remove('hidden');

    // 1. Filter location matches (preset locations like districts, metro stations)
    const locationMatches = state.locationData.filter(loc => {
        return loc.name.toLowerCase().includes(query) || 
               (loc.keywords && loc.keywords.some(k => k.toLowerCase().includes(query)));
    }).slice(0, 5);

    // 2. Filter restaurant matches (matching name, cuisine, address, or district)
    let restaurantMatches = [];
    if (typeof restaurantData !== 'undefined') {
        restaurantMatches = restaurantData.filter(res => {
            return (res.name && res.name.toLowerCase().includes(query)) ||
                   (res.cuisine && res.cuisine.toLowerCase().includes(query)) ||
                   (res.address && res.address.toLowerCase().includes(query)) ||
                   (res.district && res.district.toLowerCase().includes(query));
        }).slice(0, 5);
    }

    const hasLocations = locationMatches.length > 0;
    const hasRestaurants = restaurantMatches.length > 0;

    if (hasLocations || hasRestaurants) {
        let htmlContent = '';

        if (hasLocations) {
            htmlContent += `
                <div class="autocomplete-section-title" style="padding: 0.5rem 1rem 0.25rem; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); background: #f8fafc; border-bottom: 1px solid #e2e8f0;">捷運、地標與行政區</div>
                ${locationMatches.map(loc => `
                    <div class="autocomplete-item" data-type="location" data-name="${loc.name}">
                        <span class="icon">${loc.type === '行政區' ? '🏘️' : (loc.type.includes('捷運') ? '🚇' : '📍')}</span>
                        <span class="name">${loc.name}</span>
                        <span class="type">${loc.type}</span>
                    </div>
                `).join('')}
            `;
        }

        if (hasRestaurants) {
            htmlContent += `
                <div class="autocomplete-section-title" style="padding: 0.5rem 1rem 0.25rem; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); background: #f8fafc; border-top: ${hasLocations ? '1px solid #e2e8f0' : 'none'}; border-bottom: 1px solid #e2e8f0;">推薦親子餐廳</div>
                <div class="autocomplete-item" data-type="keyword" data-keyword="${query}">
                    <span class="icon">🔍</span>
                    <span class="name" style="color: var(--primary);">搜尋關鍵字「${query}」</span>
                    <span class="type">搜尋所有符合分店</span>
                </div>
                ${restaurantMatches.map(res => `
                    <div class="autocomplete-item" data-type="restaurant" data-id="${res.place_id}">
                        <span class="icon">🍴</span>
                        <span class="name">${formatRestaurantName(res.name)}</span>
                        <span class="type">${res.cuisine || '親子友善餐廳'}</span>
                    </div>
                `).join('')}
            `;
        }

        autocompleteDropdown.innerHTML = htmlContent;
        autocompleteDropdown.classList.remove('hidden');

        autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                if (type === 'location') {
                    const name = item.dataset.name;
                    const locObj = locationMatches.find(m => m.name === name);
                    if (locObj) selectLocation(locObj, 'manual_input');
                } else if (type === 'keyword') {
                    const keyword = item.dataset.keyword;
                    executeSearch(keyword);
                } else if (type === 'restaurant') {
                    const placeId = item.dataset.id;
                    const res = restaurantMatches.find(r => r.place_id === placeId);
                    if (res) {
                        const customLoc = {
                            name: res.name,
                            lat: res.latitude,
                            lng: res.longitude,
                            type: '特定餐廳',
                            place_id: res.place_id
                        };
                        selectLocation(customLoc, 'autocomplete_restaurant');
                        showDetail(res);
                    }
                }
                autocompleteDropdown.classList.add('hidden');
            });
        });
    } else {
        autocompleteDropdown.classList.add('hidden');
    }
}

// Helper to verify if the geocoded result is a confident point/area (e.g. roads, transport, districts, public amenities)
function isConfidentResult(result) {
    if (!result) return false;
    const c = result.class;
    const t = result.type;
    
    // 1. Roads and highways
    if (c === 'highway') return true;
    
    // 2. Administrative boundaries and districts
    if (c === 'boundary' || c === 'place') {
        const adminTypes = ['postcode', 'suburb', 'quarter', 'neighbourhood', 'district', 'city', 'town', 'village', 'county', 'municipality'];
        if (adminTypes.includes(t)) return true;
        
        // Specific house numbers or buildings
        const addressTypes = ['house', 'house_number', 'building', 'address', 'residential'];
        if (addressTypes.includes(t)) return true;
    }
    
    // 3. Public transport (stations)
    if (c === 'railway' && (t === 'station' || t === 'halt' || t === 'subway_entrance')) return true;
    
    // 4. Large public tourist destinations
    if (c === 'tourism' && ['zoo', 'aquarium', 'theme_park', 'museum', 'gallery', 'attraction', 'park'].includes(t)) return true;
    
    // 5. Civic / public amenities
    if (c === 'amenity' && ['park', 'hospital', 'university', 'school', 'college', 'library', 'townhall', 'courthouse', 'place_of_worship'].includes(t)) return true;
    
    // 6. Landuse
    if (c === 'landuse' && ['forest', 'grass', 'cemetery', 'park', 'recreation_ground', 'reservoir'].includes(t)) return true;
    
    return false;
}

// Geocode address via OSM Nominatim API with confidence check and automatic road fallback
async function geocodeAddress(query) {
    // Restrict search bounds to Taipei & New Taipei City
    const viewbox = "121.43,25.21,121.67,24.93";
    const getUrl = (q) => `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&viewbox=${viewbox}&bounded=1&addressdetails=1`;
    
    const fetchGeocode = async (q) => {
        try {
            const response = await fetch(getUrl(q));
            if (!response.ok) {
                throw new Error('OSM Geocoding request failed');
            }
            const data = await response.json();
            if (data && data.length > 0) {
                return data[0];
            }
        } catch (err) {
            console.error('Nominatim Geocoding fetch error:', err);
        }
        return null;
    };

    // 1. Try original query
    let result = await fetchGeocode(query);
    if (result) {
        // Only accept if it is a confident public location/address
        if (isConfidentResult(result)) {
            return {
                name: query,
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                type: '自訂地點',
                resolvedAddress: result.display_name
            };
        } else {
            console.log(`OSM result is not confident (${result.class}/${result.type}). Rejecting to prevent misleading restaurant/POI location.`);
            return null;
        }
    }

    // 2. Fallback: Strip Taiwanese house numbers / floors / lane numbers at the end
    // E.g., "民生東路五段218號" -> "民生東路五段"
    let cleaned = query.replace(/\s*\d+([號樓fF]|之).*$/, '').trim();
    cleaned = cleaned.replace(/\s*\d+$/, '').trim(); // Remove raw trailing numbers

    if (cleaned && cleaned !== query) {
        console.log(`OSM geocoding fallback: retrying with "${cleaned}"`);
        result = await fetchGeocode(cleaned);
        if (result && isConfidentResult(result)) {
            return {
                name: query, // Keep original query for UI display
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                type: '自訂地點',
                isFallback: true,
                fallbackName: cleaned,
                resolvedAddress: result.display_name
            };
        }
    }

    return null;
}

function isAddressLikeQuery(query) {
    const value = String(query || '').trim();
    if (!value) return false;
    return /[路街巷弄段大道橋區里鄰號樓]|台北|臺北|新北|\d/.test(value);
}

// Main custom search handler
async function executeSearch(query) {
    if (!query) return;

    trackSearchLocation('keyword', query);

    // Dismiss dropdown
    autocompleteDropdown.classList.add('hidden');

    // 1. Check exact match in preset locations (case-insensitive)
    const exactLoc = state.locationData.find(loc => 
        loc.name.toLowerCase() === query.toLowerCase() ||
        (loc.keywords && loc.keywords.some(k => k.toLowerCase() === query.toLowerCase()))
    );
    if (exactLoc) {
        selectLocation(exactLoc, 'manual_input');
        return;
    }

    // 2. Check partial match in preset locations
    const partialLoc = state.locationData.find(loc => 
        loc.name.toLowerCase().includes(query.toLowerCase()) ||
        (loc.keywords && loc.keywords.some(k => k.toLowerCase().includes(query.toLowerCase())))
    );
    if (partialLoc) {
        selectLocation(partialLoc, 'manual_input');
        return;
    }

    // Show loading indicator on magnifier button
    let originalContent = '';
    if (searchMagnifier) {
        originalContent = searchMagnifier.innerHTML;
        searchMagnifier.innerHTML = `<span style="font-size: 0.9rem; line-height: 1;">⏳</span>`;
        searchMagnifier.disabled = true;
    }

    try {
        const q = query.toLowerCase();

        // 3. Address / road segment searches should behave as area searches.
        // This keeps first search results consistent with URL reload results.
        if (isAddressLikeQuery(query)) {
            const geocoded = await geocodeAddress(query);
            if (geocoded) {
                if (geocoded.isFallback) {
                    showToast(`📍 地圖圖資未收錄此門牌，已定位至鄰近路段「${geocoded.fallbackName}」`, 5000);
                }
                selectLocation(geocoded, 'nominatim_geocoding');
                return;
            }
        }

        // 4. Local restaurant name / address / cuisine fuzzy match
        const localMatches = restaurantData.filter(res => 
            (res.name && res.name.toLowerCase().includes(q)) ||
            (res.address && res.address.toLowerCase().includes(q)) ||
            (res.cuisine && res.cuisine.toLowerCase().includes(q)) ||
            (res.district && res.district.toLowerCase().includes(q))
        );

        if (localMatches.length > 0) {
            // Found matching restaurants locally!
            // Centering on the first matched restaurant
            const firstMatch = localMatches[0];
            const customLoc = {
                name: `關鍵字: ${query}`,
                lat: firstMatch.latitude,
                lng: firstMatch.longitude,
                type: '關鍵字搜尋',
                keyword: query
            };
            selectLocation(customLoc, 'local_keyword_search');
            return;
        }

        // 5. Online Geocoding via Nominatim
        const geocoded = await geocodeAddress(query);
        if (geocoded) {
            if (geocoded.isFallback) {
                showToast(`📍 地圖圖資未收錄此門牌，已定位至鄰近路段「${geocoded.fallbackName}」`, 5000);
            }
            selectLocation(geocoded, 'nominatim_geocoding');
        } else {
            showToast('找不到此地點或相符餐廳，請輸入更明確的雙北地址、地標或關鍵字');
        }
    } catch (e) {
        console.error('Custom search failed:', e);
        showToast('搜尋時發生錯誤，請稍後再試');
    } finally {
        if (searchMagnifier) {
            searchMagnifier.innerHTML = originalContent;
            searchMagnifier.disabled = false;
        }
    }
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
    clearSearchBtn.classList.remove('hidden');
    
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
    
    // CRITICAL: Leaflet needs to know the size changed after being unhidden
    if (state.map) {
        setTimeout(() => {
            state.map.invalidateSize();
            renderResults();
            updateUrl(pushState);
            
            // Only scroll to results on manual user search, not during back/forward URL synchronization
            if (source !== 'url_sync') {
                const searchCard = document.querySelector('.main-search-card');
                if (searchCard) {
                    safeScrollIntoView(searchCard);
                } else {
                    safeScrollIntoView(searchResultsView);
                }
            }
        }, 120);
    } else {
        renderResults();
        updateUrl(pushState);
        
        if (source !== 'url_sync') {
            const searchCard = document.querySelector('.main-search-card');
            if (searchCard) {
                safeScrollIntoView(searchCard);
            } else {
                safeScrollIntoView(searchResultsView);
            }
        }
    }
    updateQuickLinksUI();
}

function getParentFriendlyBaseScore(res) {
    const level = res.parent_friendly_level || 'Insufficient Info';
    const levelScoreMap = {
        '高': 300,
        'High': 300,
        '中': 200,
        'Medium': 200,
        '需留意': 50,
        'Needs Attention': 50,
        '資訊不足': 0,
        'Insufficient Info': 0
    };
    const attrs = res.attributes || {};
    const knownPositiveCount = Object.values(attrs).filter(val => val === 'yes' || val === 'likely').length;
    return (levelScoreMap[level] ?? 0) + knownPositiveCount;
}

function calculatePersonalizedScore(res) {
    if (!state.filters || state.filters.size === 0) {
        return {
            score: getParentFriendlyBaseScore(res),
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

        if (val === 'yes' || val === 'likely') {
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
                    indicator.innerHTML = `${icon} ${label}`;
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
        if (center.keyword) {
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

        const btnShowResultsContainer = document.getElementById('btn-show-results-container');
        const btnShowResults = document.getElementById('btn-show-results');
        if (btnShowResultsContainer && btnShowResults) {
            btnShowResultsContainer.style.display = 'block';
            btnShowResults.textContent = `查看 ${exactMatches.length} 間餐廳`;
        }

        updateShowResultsButton(exactMatches.length);

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

                const isWholeCity = (center.type === '全市' || center.name === '整個台北市');
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
            clearAllFiltersBtn.classList.toggle('hidden', state.filters.size === 0);
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

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateTravelTimes(km) {
    if (km === Infinity || isNaN(km)) return null;
    
    // Heuristic: Real road distance is approx 1.45x straight-line distance in Taipei
    const roadKm = km * 1.45;
    
    // Walking: ~4.5 km/h
    const walkingMin = Math.round((roadKm / 4.5) * 60);
    
    // Driving: ~20 km/h (average Taipei city speed with traffic/lights)
    const drivingMin = Math.round((roadKm / 20) * 60) + 1; // +1 min buffer
    
    return {
        walking: walkingMin,
        driving: drivingMin,
        roadKm: roadKm.toFixed(1)
    };
}

function formatDistance(km) {
    if (km === Infinity) return '';
    if (km < 1) return (km * 1000).toFixed(0) + 'm';
    return km.toFixed(1) + 'km';
}

function getDynamicStatus(res, selectedFilters) {
    const attrs = res.attributes || {};
    const allKeys = ['has_tableware', 'high_chair_available', 'has_diaper_table', 'kids_menu', 'kid_noise_tolerant', 'spacious_seating', 'has_play_area', 'has_private_room'];
    
    let matchCount = 0;
    if (selectedFilters && selectedFilters.size > 0) {
        selectedFilters.forEach(f => {
            if (attrs[f] === 'yes' || attrs[f] === 'likely') matchCount++;
        });
    }

    // 1. 不符合條件 (Any selected filter is 'no')
    let hasNo = false;
    if (selectedFilters && selectedFilters.size > 0) {
        selectedFilters.forEach(f => {
            if (attrs[f] === 'no') hasNo = true;
        });
    }
    if (hasNo) return { level: 'Needs Attention', label: '不符合條件', class: 'attention', matchCount: matchCount };

    // 2. 資訊不足 (All 4 are unknown/missing)
    const allUnknown = allKeys.every(k => !attrs[k] || attrs[k] === 'unknown');
    if (allUnknown) return { level: 'Insufficient Info', label: '資訊不足', class: 'info', matchCount: matchCount };

    // If user has selected filters
    if (selectedFilters && selectedFilters.size > 0) {
        // 很適合你 (Perfect match of all selected filters)
        if (matchCount === selectedFilters.size) {
            return { level: 'High', label: '很適合你', class: 'high', matchCount: matchCount };
        }
        
        // 可以考慮 (At least one match, and we already know there's no 'no')
        if (matchCount >= 1) {
            return { level: 'Medium', label: '可以考慮', class: 'medium', matchCount: matchCount };
        }

        // 其他友善選擇 (Zero matches, but something else is 'yes')
        let hasOtherYes = false;
        allKeys.forEach(k => {
            if (!selectedFilters.has(k) && (attrs[k] === 'yes' || attrs[k] === 'likely')) hasOtherYes = true;
        });
        if (hasOtherYes) {
            return { level: 'Low Match', label: '其他友善選擇', class: 'low-match', matchCount: matchCount };
        }
        
        return { level: 'Insufficient Info', label: '資訊不足', class: 'info', matchCount: matchCount };
    }

    // Default view (no filters selected)
    const hasTableware = attrs['has_tableware'] === 'yes' || attrs['has_tableware'] === 'likely';
    const hasHighChair = attrs['high_chair_available'] === 'yes' || attrs['high_chair_available'] === 'likely';
    const hasKidsMenu = attrs['kids_menu'] === 'yes' || attrs['kids_menu'] === 'likely';
    const hasPlayArea = attrs['has_play_area'] === 'yes' || attrs['has_play_area'] === 'likely';
    
    const isRecommended = (hasTableware && hasHighChair) || (hasKidsMenu || hasPlayArea);
    
    let totalYes = 0;
    allKeys.forEach(k => { if (attrs[k] === 'yes' || attrs[k] === 'likely') totalYes++; });
    
    if (isRecommended) return { level: 'High', label: '值得推薦', class: 'high', matchCount: 0 };
    if (totalYes >= 1) return { level: 'Medium', label: '可以考慮', class: 'medium', matchCount: 0 };
    return { level: 'Insufficient Info', label: '資訊不足', class: 'info', matchCount: 0 };
}

function renderCard(res, container, overrideLevel) {
    if (res.ai_summary && !res._ai_summary_patched) {
        res.ai_summary = patchAiSummary(res, res.ai_summary);
        res._ai_summary_patched = true;
    }
    if (res.card_summary && !res._card_summary_patched) {
        res.card_summary = patchAiSummary(res, res.card_summary);
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

    const isWholeCity = state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市');
    const times = (!isWholeCity && res.distance) ? calculateTravelTimes(res.distance) : null;
    let timeHtml = '';
    if (times) {
        timeHtml = `<span class="card-footer-time">(🚶${times.walking}分鐘·🚗${times.driving}分鐘)</span>`;
    }

    const priceSymbol = priceSymbols[res.price_level];
    const footerParts = [];
    if (res.cuisine) {
        footerParts.push(`<span class="card-cuisine">${res.cuisine}</span>`);
    }
    if (priceSymbol) {
        footerParts.push(`<span class="card-price" title="${res.price_level}">${priceSymbol}</span>`);
    }
    if (timeHtml) {
        footerParts.push(timeHtml);
    }
    const footerHtml = footerParts.join('<span class="card-meta-dot">·</span>');

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
        <div class="card-status-row">
            <div class="decision-summary ${levelClass}">
                <span class="status-dot"></span>
                ${displayLabel}
            </div>
            ${extraInfoHtml}
        </div>
        <div class="card-summary">${res.card_summary || res.ai_summary || '目前親子友善資訊較有限。'}</div>
        <div class="card-footer-row">
            ${footerHtml}
        </div>
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
            trackEvent('view_restaurant_detail', getRestaurantEventParams(res, 'list_card'));
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

function renderDetailContent(restaurant) {
    let dist = undefined;
    let originLabel = '';
    const isSpecificRestaurant = state.searchLocation && state.searchLocation.type === '特定餐廳';
    if (isSpecificRestaurant) {
        if (state.userLocation) {
            dist = calculateDistance(state.userLocation.lat, state.userLocation.lng, restaurant.latitude, restaurant.longitude);
            originLabel = '目前位置';
        } else if (state.lastGeographicLocation) {
            dist = calculateDistance(state.lastGeographicLocation.lat, state.lastGeographicLocation.lng, restaurant.latitude, restaurant.longitude);
            if (state.lastGeographicLocation.type === '行政區') {
                originLabel = `「${state.lastGeographicLocation.name}中心點」`;
            } else {
                originLabel = `「${state.lastGeographicLocation.name}」`;
            }
        }
    } else if (state.searchLocation && restaurant.latitude && restaurant.longitude) {
        dist = calculateDistance(state.searchLocation.lat, state.searchLocation.lng, restaurant.latitude, restaurant.longitude);
        if (state.searchLocation.type === '行政區') {
            originLabel = `「${state.searchLocation.name}中心點」`;
        } else {
            originLabel = `「${state.searchLocation.name}」`;
        }
    }
    if (restaurant.ai_summary && !restaurant._ai_summary_patched) {
        restaurant.ai_summary = patchAiSummary(restaurant, restaurant.ai_summary);
        restaurant._ai_summary_patched = true;
    }
    if (restaurant.card_summary && !restaurant._card_summary_patched) {
        restaurant.card_summary = patchAiSummary(restaurant, restaurant.card_summary);
        restaurant._card_summary_patched = true;
    }

    let tagsHtml = '';
    const attributes = restaurant.attributes || {};
    const orderedKeys = ['has_tableware', 'high_chair_available', 'has_diaper_table', 'kids_menu', 'kid_noise_tolerant', 'spacious_seating', 'has_play_area', 'has_private_room'];
    orderedKeys.forEach(attr => {
        const val = attributes[attr];
        if ((val === 'yes' || val === 'likely') && attributeLabels[attr]) {
            const isMatched = state.filters && state.filters.has(attr);
            const isLikely = val === 'likely';
            
            let tagClass = 'tag';
            if (isMatched) tagClass += ' matched';
            if (isLikely) tagClass += ' likely';
            
            const titleAttr = isLikely ? ' title="依公開地點資訊推估，尚未由店家或使用者明確確認，建議出發前再確認。"' : '';
            const checkIcon = isMatched ? '✓ ' : '';
            const suffix = isLikely ? '<span style="font-size:0.65em;opacity:0.7;letter-spacing:0;margin-left:2px;">(估)</span>' : '';
            
            tagsHtml += `<span class="${tagClass}"${titleAttr}><span>${checkIcon}${attributeIcons[attr] || '✨'}</span> <span style="display:flex;align-items:center;">${attributeLabels[attr]}${suffix}</span></span>`;
        }
    });

    if (!tagsHtml) {
        tagsHtml = '<div style="color: var(--text-muted); font-size: 0.9rem; font-style: italic;">未看到明確的親子友善資訊</div>';
    }

    const status = getDynamicStatus(restaurant, state.filters);
    const level = status.level;
    const displayLabel = status.label;
    const levelClass = status.class;
    
    // Calculate match count for detail view
    let matchCount = 0;
    const attributes_for_count = restaurant.attributes || {};
    if (state.filters && state.filters.size > 0) {
        state.filters.forEach(f => {
            if (attributes_for_count[f] === 'yes' || attributes_for_count[f] === 'likely') matchCount++;
        });
    }
    
    let summaryTags = getPFSummaryTags(restaurant, level, true);
    if (!state.filters || state.filters.size === 0) {
        summaryTags = '💡 評估依據：系統根據店家的親子硬體設備與環境進行綜合分析。';
    } else if (summaryTags) {
        if (summaryTags.startsWith('留意：')) {
            summaryTags = '⚠️ ' + summaryTags;
        } else if (summaryTags.startsWith('符合')) {
            summaryTags = '🔍 ' + summaryTags;
        } else if (summaryTags.startsWith('具備其他')) {
            summaryTags = '✨ ' + summaryTags;
        } else if (summaryTags.startsWith('目前整理資料未提及')) {
            summaryTags = 'ℹ️ ' + summaryTags;
        }
    }

    const isWholeCity = !isSpecificRestaurant && state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市');
    const times = (!isWholeCity && dist !== undefined) ? calculateTravelTimes(dist) : null;
    let timeHtml = '';
    if (times) {
        timeHtml = `
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <span style="background: #f1f5f9; padding: 0.25rem 0.6rem; border-radius: 2rem; font-size: 0.75rem; font-weight: 600; color: #475569;">🚶/🚗 從${originLabel}步行約 ${times.walking} 分鐘、開車約 ${times.driving} 分鐘</span>
            </div>
        `;
    }

    const cleanAddrForMap = fixSimplifiedAddress(restaurant.address || '');
    let googleMapsUrl = restaurant.google_maps_url || restaurant.url;
    if (!googleMapsUrl) {
        const query = encodeURIComponent((restaurant.name || '') + ' ' + cleanAddrForMap);
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    const isApp = isInAppBrowser();
    const mapTarget = isApp ? '_self' : '_blank';

    const priceSymbol = priceSymbols[restaurant.price_level];
    const detailMetaParts = [];
    if (restaurant.cuisine) {
        detailMetaParts.push(restaurant.cuisine);
    }
    if (priceSymbol) {
        detailMetaParts.push(priceSymbol);
    }
    const detailMetaHtml = detailMetaParts.join(' <span class="card-meta-dot">·</span> ');

    detailContent.innerHTML = `
        <h1 style="margin-bottom: 0.5rem; color: var(--text-main);">${formatRestaurantName(restaurant.name || '未命名餐廳')}</h1>
        ${detailMetaHtml ? `<div class="restaurant-meta" style="font-size: 1.1rem; margin-bottom: 0.5rem;">${detailMetaHtml}</div>` : ''}
        <div class="restaurant-address" style="font-size: 0.9rem; margin-bottom: 0.85rem;">📍 ${fixSimplifiedAddress(restaurant.address || '')}</div>
        
        ${timeHtml}

        <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">親子友善建議</div>
        <div style="margin-bottom: 1.5rem;">
            <div class="decision-summary ${levelClass}">
                <span class="status-dot"></span>
                ${displayLabel}
            </div>
            ${summaryTags ? `<div class="summary-tags-text ${levelClass}" style="font-size: 0.85rem; font-weight: 600; margin-top: 0.5rem; line-height: 1.5;">${summaryTags}</div>` : ''}
        </div>
        
        <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">親子友善條件</div>
        <div class="tag-container" style="gap: 0.75rem; margin-bottom: 1.5rem;">
            ${tagsHtml}
        </div>

        <div class="ai-summary" style="margin-bottom: 1.5rem;">
            <div class="ai-summary-title">親子用餐摘要（根據目前整理資料產生，僅供參考）</div>
            <div class="ai-summary-text">${(restaurant.ai_summary || '目前尚無摘要資訊。').replace(/\n/g, '<br>')}</div>
        </div>
        
        <div class="detail-feedback-section" id="ai-summary-feedback-container" style="margin-top: 1.5rem; margin-bottom: 1.5rem; border-top: 1px solid #e2e8f0; padding-top: 1.25rem;">
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.65rem;">本頁資訊有幫助嗎？</div>
            <div id="ai-feedback-options" style="display: flex; gap: 0.6rem;">
                <button class="feedback-vote-btn" id="btn-feedback-helpful" style="display: inline-flex; align-items: center; gap: 0.25rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: var(--text-main); cursor: pointer; transition: all 0.2s;">
                    👍 有幫助
                </button>
                <button class="feedback-vote-btn" id="btn-feedback-unhelpful" style="display: inline-flex; align-items: center; gap: 0.25rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: var(--text-main); cursor: pointer; transition: all 0.2s;">
                    👎 沒幫助
                </button>
            </div>
            <div id="ai-feedback-form-container" class="hidden" style="margin-top: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; font-size: 0.9rem; color: var(--text-main);">
                <div style="font-weight: 700; margin-bottom: 0.75rem; color: #475569;">哪裡沒有幫助？</div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                    <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                        <input type="checkbox" class="ai-feedback-issue" value="找不到符合需求的餐廳"> 找不到符合需求的餐廳
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                        <input type="checkbox" class="ai-feedback-issue" value="餐廳資訊不夠完整"> 餐廳資訊不夠完整
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                        <input type="checkbox" class="ai-feedback-issue" value="資料似乎不準確"> 資料似乎不準確
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                        <input type="checkbox" class="ai-feedback-issue" value="缺少我在意的條件"> 缺少我在意的條件
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                        <input type="checkbox" class="ai-feedback-issue" value="其他"> 其他
                    </label>
                </div>
                
                <div style="font-weight: 700; margin-bottom: 0.5rem; color: #475569;">願意多告訴我一些嗎？（選填）</div>
                <textarea id="ai-feedback-more-text" rows="3" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; font-family: inherit; font-size: 0.9rem; margin-bottom: 1rem; box-sizing: border-box; resize: vertical;" placeholder="請輸入說明..."></textarea>
                
                <div style="font-weight: 700; margin-bottom: 0.5rem; color: #475569;">願意接受後續訪談嗎？（選填 Email）</div>
                <input type="email" id="ai-feedback-email" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; font-family: inherit; font-size: 0.9rem; margin-bottom: 1rem; box-sizing: border-box;" placeholder="example@email.com">
                
                <button class="btn btn-primary" id="btn-submit-ai-feedback" style="width: 100%; padding: 0.75rem; font-size: 0.9rem; font-weight: 700; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                    提交回饋
                </button>
            </div>
            <div id="ai-feedback-thank-you" class="hidden" style="font-weight: 700; color: #16a34a; margin-top: 0.5rem; font-size: 0.95rem;">
                感謝回饋！
            </div>
        </div>

        <a id="btn-open-google-maps" class="btn btn-primary" href="${googleMapsUrl}" target="${mapTarget}" rel="noopener noreferrer" style="width: 100%; margin-top: 1rem; padding: 1.125rem; text-decoration: none; color: white; box-sizing: border-box;">
            在 Google 地圖中開啟
        </a>
        <button id="btn-trigger-feedback" class="btn-feedback-trigger">
            <span>🚩</span> 協助回報與貢獻此餐廳資訊
        </button>
    `;

    const detailFavBtn = document.getElementById('btn-detail-fav');
    if (detailFavBtn) {
        detailFavBtn.dataset.placeId = restaurant.place_id;
        const isNowFav = state.favorites.has(restaurant.place_id);
        detailFavBtn.classList.toggle('active', isNowFav);
        detailFavBtn.innerHTML = isNowFav ? '❤️' : '🤍';
        detailFavBtn.title = isNowFav ? '移出口袋名單' : '加入口袋名單';
    }

    const gMapBtn = document.getElementById('btn-open-google-maps');
    if (gMapBtn) {
        gMapBtn.onclick = () => {
            try {
                trackEvent('open_google_maps', {
                    restaurant_name: restaurant.name,
                    location_context: state.searchLocation ? (state.searchLocation.name === '我附近' ? 'nearby' : state.searchLocation.name) : 'none'
                });
            } catch (e) {}
        };
    }

    const feedbackTriggerBtn = document.getElementById('btn-trigger-feedback');
    if (feedbackTriggerBtn) {
        feedbackTriggerBtn.onclick = () => {
            openFeedbackModal(restaurant);
        };
    }

    // AI Summary Feedback event listeners
    const btnHelpful = document.getElementById('btn-feedback-helpful');
    const btnUnhelpful = document.getElementById('btn-feedback-unhelpful');
    const feedbackOptions = document.getElementById('ai-feedback-options');
    const feedbackFormContainer = document.getElementById('ai-feedback-form-container');
    const feedbackThankYou = document.getElementById('ai-feedback-thank-you');
    const btnSubmitAiFeedback = document.getElementById('btn-submit-ai-feedback');

    if (btnHelpful) {
        btnHelpful.onclick = () => {
            feedbackOptions.classList.add('hidden');
            feedbackThankYou.classList.remove('hidden');
            submitAiFeedback(true, [], '', '', restaurant);
        };
    }

    if (btnUnhelpful) {
        btnUnhelpful.onclick = () => {
            feedbackOptions.classList.add('hidden');
            feedbackFormContainer.classList.remove('hidden');
        };
    }

    if (btnSubmitAiFeedback) {
        btnSubmitAiFeedback.onclick = async () => {
            const checkedIssues = [];
            document.querySelectorAll('.ai-feedback-issue:checked').forEach(cb => {
                checkedIssues.push(cb.value);
            });
            const comment = document.getElementById('ai-feedback-more-text').value.trim();
            const email = document.getElementById('ai-feedback-email').value.trim();

            const originalBtnText = btnSubmitAiFeedback.innerHTML;
            btnSubmitAiFeedback.disabled = true;
            btnSubmitAiFeedback.innerHTML = '⌛ 提交中...';

            await submitAiFeedback(false, checkedIssues, comment, email, restaurant);

            btnSubmitAiFeedback.disabled = false;
            btnSubmitAiFeedback.innerHTML = originalBtnText;

            feedbackFormContainer.classList.add('hidden');
            feedbackThankYou.classList.remove('hidden');
            showToast('感謝您的寶貴回饋！');
        };
    }
}

function showDetail(restaurant) {
    if (!restaurant) return;
    
    try {
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

// Global helper to check for low match condition
function isLowMatchGlobal(restaurant, level) {
    if (state.filters && state.filters.size > 0) {
        const isRecommended = (level === 'High' || level === '高' || level === 'Medium' || level === '中');
        if (!isRecommended) return false;

        let matchCount = 0;
        const attributes = restaurant.attributes || {};
        state.filters.forEach(f => {
            if (attributes[f] === 'yes' || attributes[f] === 'likely') matchCount++;
        });
        return matchCount === 0;
    }
    return false;
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

function initMap() {
    if (state.map) return;
    state.map = L.map('map-container', { zoomControl: false }).setView([25.033, 121.565], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(state.map);
    L.control.zoom({ position: 'bottomright' }).addTo(state.map);

    // GA4: map_interaction (Deferred to avoid initialization issues)
    setTimeout(() => {
        if (!state.map) return;
        const trackMapInteraction = throttle((type) => {
            trackEvent('map_interaction', {
                interaction_type: type,
                location_context: state.searchLocation ? (state.searchLocation.name === '我附近' ? 'nearby' : state.searchLocation.name) : 'none'
            });
        }, 2000);

        state.map.on('dragend', () => trackMapInteraction('drag'));
        state.map.on('zoomend', () => trackMapInteraction('zoom'));
    }, 1000);
}

function renderMap(restaurants) {
    if (!state.map) return;
    
    // Store restaurants for progressive zoom-based rendering
    state.mapRestaurants = restaurants;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    let hasPoints = false;
    
    const isWholeCity = state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市');
    if (state.searchLocation && !isWholeCity) {
        const lat = state.searchLocation.lat;
        const lng = state.searchLocation.lng;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            hasPoints = true;
        }
    }
    
    restaurants.forEach(res => {
        if (typeof res.latitude === 'number' && typeof res.longitude === 'number' && !isNaN(res.latitude) && !isNaN(res.longitude)) {
            const status = getDynamicStatus(res, state.filters);
            const level = status.level;
            const isLowQuality = (level === 'Insufficient Info' || level === 'Needs Attention');

            // Skip if user wants to hide low quality markers
            if (state.hideLowQualityMarkers && isLowQuality) return;

            minLat = Math.min(minLat, res.latitude);
            maxLat = Math.max(maxLat, res.latitude);
            minLng = Math.min(minLng, res.longitude);
            maxLng = Math.max(maxLng, res.longitude);
            hasPoints = true;
        }
    });

    if (hasPoints && minLat !== Infinity) {
        const mapSize = state.map.getSize();
        if (mapSize.x > 0 && mapSize.y > 0) {
            try {
                if (minLat === maxLat && minLng === maxLng) {
                    state.map.setView([minLat, minLng], 15);
                } else {
                    const southWest = L.latLng(minLat, minLng);
                    const northEast = L.latLng(maxLat, maxLng);
                    const boundsObj = L.latLngBounds(southWest, northEast);
                    state.map.fitBounds(boundsObj, { padding: [50, 50], maxZoom: 16 });
                }
            } catch (e) {
                console.error('fitBounds / setView failed:', e);
                if (state.searchLocation) {
                    state.map.setView([state.searchLocation.lat, state.searchLocation.lng], 15);
                }
            }
        } else {
            console.warn('Map container has 0 size, using setView fallback');
            if (state.searchLocation) {
                state.map.setView([state.searchLocation.lat, state.searchLocation.lng], 15);
            }
        }
    } else if (state.searchLocation) {
        state.map.setView([state.searchLocation.lat, state.searchLocation.lng], 15);
    }

    // Perform initial marker rendering based on new view/zoom
    refreshMapMarkers();

    // Setup moveend listener once to handle pans and zooms
    if (!state.mapMoveEndListenerSetup) {
        state.map.on('moveend', () => {
            // Skip refresh if a popup is open — Leaflet fires moveend when
            // auto-panning to reveal a popup, and refreshing would destroy it.
            if (state.popupOpen) return;
            refreshMapMarkers();
        });
        state.mapMoveEndListenerSetup = true;
    }
}

function refreshMapMarkers() {
    if (!state.map || !state.mapRestaurants) return;

    // Clear existing markers
    state.markers.forEach(m => {
        try {
            state.map.removeLayer(m);
        } catch (e) {
            console.warn('Failed to remove marker layer:', e);
        }
    });
    state.markers = [];
    state.markerMap = {};

    const colorMap = {
        'High': '#059669', '高': '#059669',
        'Medium': '#84cc16', '中': '#84cc16',
        'Needs Attention': '#dc2626', '需留意': '#dc2626',
        'Insufficient Info': '#94a3b8', '資訊不足': '#94a3b8',
        'Low Match': '#0284c7'
    };

    const isWholeCity = state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市');
    
    let zoom = 13;
    try {
        zoom = state.map.getZoom();
    } catch (e) {
        console.warn('Failed to get map zoom:', e);
    }

    let mapBounds = null;
    try {
        mapBounds = state.map.getBounds();
    } catch (e) {
        console.warn('Failed to get map bounds:', e);
    }

    const totalCount = state.mapRestaurants.length;

    // 1. Render Search Center Pin
    if (state.searchLocation && !isWholeCity) {
        const centerIcon = L.divIcon({
            html: `<div class="search-center-marker-inner" style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" style="display: block; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.3));">
                       <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
                       <circle cx="12" cy="9" r="3.2" fill="#7A1E1A"/>
                     </svg>
                   </div>`,
            className: 'search-center-marker-outer',
            iconSize: [36, 36],
            iconAnchor: [18, 33],
            popupAnchor: [0, -33]
        });

        const centerMarker = L.marker([state.searchLocation.lat, state.searchLocation.lng], {
            icon: centerIcon,
            interactive: true
        }).addTo(state.map);
        
        const isCurrent = state.searchLocation.type === '目前位置' || state.searchLocation.name === '我附近';
        let popupTitle = isCurrent ? '您的目前位置' : '您搜尋的位置';
        let popupWarning = '';
        if (state.searchLocation.isFallback) {
            popupWarning = `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 4px; line-height: 1.3;">📍 地圖圖資未收錄此門牌，已定位至鄰近路段「${state.searchLocation.fallbackName}」</div>`;
        }

        const popupContent = `
            <div class="map-popup-compact" style="text-align: center; padding: 4px; min-width: 160px;">
                <div style="font-size: 1.25rem; margin-bottom: 4px;">${isCurrent ? '📍' : '🔍'}</div>
                <strong style="color: var(--primary); font-size: 0.9rem; display: block; margin-bottom: 4px;">
                    ${popupTitle}
                </strong>
                <div style="font-size: 0.8rem; color: var(--text-main); font-weight: 600; word-break: break-all;">
                    ${state.searchLocation.name}
                </div>
                ${popupWarning}
            </div>
        `;
        centerMarker.bindPopup(popupContent);
        state.markers.push(centerMarker);
    }

    const usedCoords = new Map();

    const prominenceRanks = new Map();
    if (totalCount > 60) {
        // Sort markers by parent-friendly relevance.
        const sorted = [...state.mapRestaurants].sort((a, b) => {
            return getParentFriendlyBaseScore(b) - getParentFriendlyBaseScore(a);
        });
        sorted.forEach((res, index) => {
            prominenceRanks.set(res.place_id, index);
        });
    }

    // Pre-calculate top 60 viewport-contained markers at zoom >= 14 to prevent OOM / CPU crash
    let allowedPlaceIds = null;
    if (totalCount > 60 && zoom >= 14 && mapBounds && typeof mapBounds.contains === 'function') {
        const inViewport = state.mapRestaurants.filter(res => {
            if (typeof res.latitude !== 'number' || typeof res.longitude !== 'number' || isNaN(res.latitude) || isNaN(res.longitude)) return false;
            const status = getDynamicStatus(res, state.filters);
            const level = status.level;
            const isLowQuality = (level === 'Insufficient Info' || level === 'Needs Attention');
            if (state.hideLowQualityMarkers && isLowQuality) return false;
            return mapBounds.contains([res.latitude, res.longitude]);
        });
        
        if (inViewport.length > 60) {
            inViewport.sort((a, b) => {
                const rankA = prominenceRanks.has(a.place_id) ? prominenceRanks.get(a.place_id) : Infinity;
                const rankB = prominenceRanks.has(b.place_id) ? prominenceRanks.get(b.place_id) : Infinity;
                return rankA - rankB;
            });
            allowedPlaceIds = new Set(inViewport.slice(0, 60).map(r => r.place_id));
        }
    }

    // 2. Filter mapRestaurants by zoom level and viewport bounds if count is large (> 60)
    const filteredRestaurants = state.mapRestaurants.filter(res => {
        if (typeof res.latitude !== 'number' || typeof res.longitude !== 'number' || isNaN(res.latitude) || isNaN(res.longitude)) return false;

        const status = getDynamicStatus(res, state.filters);
        const level = status.level;
        const isLowQuality = (level === 'Insufficient Info' || level === 'Needs Attention');

        // Apply global hideLowQualityMarkers toggle
        if (state.hideLowQualityMarkers && isLowQuality) return false;

        // Progressive filtering logic based on zoom levels (Google Maps style - prominence-based)
        if (totalCount > 60) {
            const rank = prominenceRanks.has(res.place_id) ? prominenceRanks.get(res.place_id) : Infinity;
            if (zoom <= 11) {
                // Show only top 15 most prominent matching restaurants
                return rank < 15;
            } else if (zoom === 12) {
                // Show top 30 most prominent matching restaurants
                return rank < 30;
            } else if (zoom === 13) {
                // Show top 60 most prominent matching restaurants
                return rank < 60;
            } else if (zoom >= 14) {
                if (allowedPlaceIds) {
                    return allowedPlaceIds.has(res.place_id);
                }
                if (mapBounds && typeof mapBounds.contains === 'function') {
                    return mapBounds.contains([res.latitude, res.longitude]);
                }
                return false;
            }
        }
        return true;
    });

    // 3. Render filtered restaurant markers
    filteredRestaurants.forEach(res => {
        let markerLat = res.latitude;
        let markerLng = res.longitude;

        // Jitter logic for overlapping pins
        const coordKey = `${res.latitude.toFixed(5)},${res.longitude.toFixed(5)}`;
        if (usedCoords.has(coordKey)) {
            const count = usedCoords.get(coordKey);
            usedCoords.set(coordKey, count + 1);
            const angle = (count - 1) * (2 * Math.PI / 8); 
            const radius = 0.0002; 
            markerLat += Math.cos(angle) * radius;
            markerLng += Math.sin(angle) * radius;
        } else {
            usedCoords.set(coordKey, 1);
        }

        const status = getDynamicStatus(res, state.filters);
        const level = status.level;
        const color = colorMap[level] || '#94a3b8';
        const isLowQuality = (level === 'Insufficient Info' || level === 'Needs Attention');
        const isHollow = isLowQuality;

        const pinIcon = L.divIcon({
            html: `<div class="custom-pin">
                     <div class="pin-teardrop ${isHollow ? 'hollow' : ''}" style="background-color: ${color}; color: ${color};"></div>
                   </div>`,
            className: '',
            iconSize: [24, 30],
            iconAnchor: [12, 30],
            popupAnchor: [0, -30]
        });

        try {
            const marker = L.marker([markerLat, markerLng], {
                icon: pinIcon
            }).addTo(state.map);
            
            const times = (!isWholeCity) ? calculateTravelTimes(res.distance) : null;

            marker.bindPopup(`<div class="map-popup-compact">
                <div class="map-popup-title-row">
                    <span class="map-popup-name">${formatRestaurantName(res.name)}</span>
                </div>
                <div class="map-popup-meta-row">
                    <span class="map-popup-level-tag" style="background: ${color}">${status.label}</span>
                    ${times ? `<span class="map-popup-time-mini">🚶${times.walking}分鐘 · 🚗${times.driving}分鐘</span>` : ''}
                </div>
                <div class="map-popup-address">📍 ${fixSimplifiedAddress(res.address)}</div>
                <button class="map-popup-action" onclick="showDetailFromMap('${res.place_id}')">查看詳情</button>
            </div>`, { 
                maxWidth: 240,
                autoPanPadding: L.point(20, 20)
            });

            state.markers.push(marker);
            state.markerMap[res.place_id] = marker;
        } catch (err) {
            console.error('Failed to add marker for restaurant:', res.name, err);
        }
    });
}

window.showDetailFromMap = (id) => {
    // Priority: find in current dynamic results first to get personalized level
    const res = state.currentResults.find(r => r.place_id === id) || restaurantData.find(r => r.place_id === id);
    if (res) {
        trackEvent('view_restaurant_detail', getRestaurantEventParams(res, 'map_card'));
        showDetail(res);
    }
};

window.showDetailById = (id) => {
    const res = state.currentResults.find(r => r.place_id === id) || restaurantData.find(r => r.place_id === id);
    if (res) showDetail(res);
};

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
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        params.getAll('f').forEach(f => {
            state.filters.add(f);
            const chip = document.querySelector(`.filter-chip[data-filter="${f}"]`);
            if (chip) chip.classList.add('active');
        });

        // 3. 恢復搜尋地點
        const locName = params.get('loc');
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
function fixSimplifiedAddress(addr) {
    if (!addr) return '';
    
    const charMap = {
        '东': '東',
        '义': '義',
        '万': '萬',
        '区': '區',
        '号': '號',
        '楼': '樓',
        '湾': '灣',
        '台': '臺',
        '国': '國',
        '学': '學',
        '发': '發',
        '电': '電',
        '复': '復',
        '关': '關',
        '园': '園',
        '龙': '龍',
        '兴': '興',
        '庄': '莊',
        '丰': '豐',
        '双': '雙',
        '华': '華',
        '临': '臨',
        '庆': '慶',
        '宝': '寶',
        '宁': '寧',
        '辽': '遼',
        '阳': '陽',
        '桥': '橋',
        '铁': '鐵',
        '营': '營',
        '头': '頭',
        '观': '觀',
        '门': '門',
        '乐': '樂',
        '艺': '藝',
        '爱': '愛',
        '广': '廣',
        '苏': '蘇',
        '芦': '蘆',
        '温': '溫',
        '叶': '葉',
        '荣': '榮',
        '卫': '衛',
        '丽': '麗',
        '罗': '羅',
        '恒': '恆',
        '馆': '館',
        '栋': '棟',
        '柜': '櫃',
        '县': '縣',
        '镇': '鎮',
        '乡': '鄉',
        '经': '經',
        '贸': '貿',
        '农': '農',
        '剑': '劍',
        '仑': '崙'
    };
    
    let result = '';
    for (let i = 0; i < addr.length; i++) {
        const char = addr[i];
        result += charMap[char] || char;
    }
    return result;
}


function formatRestaurantName(name) {
    if (!name) return '';
    // Split by parenthesized parts, or delimiters (space, dash, colon, slash, pipe)
    const parts = name.split(/([\(\[【（].*?[\)\]】）]|[ \-－—:：\/／\|｜])/g).filter(p => p !== '');
    
    return parts.map(part => {
        if (/^[ \-－—:：\/／\|｜]$/.test(part)) return part;
        if (/^[\(\[【（].*?[\)\]】）]$/.test(part)) {
            return `<span class="no-wrap">${part}</span>`;
        }
        if (part.length > 0 && part.length <= 12) {
            return `<span class="no-wrap">${part}</span>`;
        }
        return part;
    }).join('<wbr>');
}

function neutralizeSummarySourceCopy(summary) {
    if (!summary) return '';
    return String(summary)
        .replace(/Google Maps\s*官方標記/g, '公開地點資訊標示')
        .replace(/Google Maps\s*標記/g, '公開地點資訊標示')
        .replace(/Google\s*Maps/g, '公開地點資訊')
        .replace(/Google\s*官方/g, '公開地點資訊')
        .replace(/Google/g, '公開地點資訊')
        .replace(/官方明確標示/g, '店家資訊顯示')
        .replace(/官方明確表示/g, '店家資訊顯示')
        .replace(/官方明確/g, '目前資料明確')
        .replace(/官方標記/g, '公開地點資訊標示')
        .replace(/官方標示/g, '公開地點資訊標示')
        .replace(/官方資訊/g, '公開地點資訊')
        .replace(/官方/g, '店家資訊')
        .replace(/根據評論分析/g, '根據目前整理資料')
        .replace(/根據評論/g, '根據目前整理資料')
        .replace(/AI根據公開評論整理/g, '根據目前整理資料產生，僅供參考')
        .replace(/AI 根據公開評論整理/g, '根據目前整理資料產生，僅供參考')
        .replace(/公開評論整理/g, '目前整理資料')
        .replace(/公開評論/g, '目前整理資料')
        .replace(/顧客評論/g, '顧客回饋')
        .replace(/評論資訊/g, '顧客回饋')
        .replace(/評論多集中/g, '目前整理資料多集中')
        .replace(/評論反映/g, '目前整理資料顯示')
        .replace(/有評論指出/g, '目前整理資料指出')
        .replace(/評論指出/g, '目前整理資料指出')
        .replace(/有評論提到/g, '目前整理資料提到')
        .replace(/有評論提及/g, '目前整理資料提及')
        .replace(/評論提到/g, '目前整理資料提到')
        .replace(/評論提及/g, '目前整理資料提及')
        .replace(/評論中目前未提及/g, '目前整理資料中未提及')
        .replace(/目前評論中較少提及/g, '目前整理資料較少提及')
        .replace(/目前評論中未提及/g, '目前整理資料中未提及')
        .replace(/目前評論中/g, '目前整理資料中')
        .replace(/評論中也未提及/g, '目前整理資料中也未提及')
        .replace(/評論中並未提及/g, '目前整理資料中未提及')
        .replace(/評論中尚未提及/g, '目前整理資料中尚未提及')
        .replace(/評論中未有明確提及/g, '目前整理資料尚未明確提及')
        .replace(/評論中未明確提及/g, '目前整理資料尚未明確提及')
        .replace(/評論中沒有提及/g, '目前整理資料中未提及')
        .replace(/評論中也提到/g, '目前整理資料也提到')
        .replace(/評論中提及/g, '目前整理資料提及')
        .replace(/評論中未提及/g, '目前整理資料中未提及')
        .replace(/評論中/g, '目前整理資料中')
        .replace(/評論未提及/g, '目前整理資料未提及')
        .replace(/評論顯示/g, '目前整理資料顯示')
        .replace(/有顧客評論提到/g, '目前整理資料提到')
        .replace(/顧客評論提到/g, '目前整理資料提到')
        .replace(/評論/g, '目前整理資料');
}


function patchAiSummary(restaurant, summary) {
    const attrs = restaurant.attributes || {};

    // Detect facilities that are only "likely" (inferred, not explicitly confirmed)
    const likelyFacilities = [];
    if (attrs.high_chair_available === 'likely') likelyFacilities.push('兒童椅');
    if (attrs.has_tableware === 'likely') likelyFacilities.push('兒童餐具');

    // If no likely-only items, still neutralize source wording.
    if (likelyFacilities.length === 0) return neutralizeSummarySourceCopy(summary || '');

    // Collect confirmed (yes) facilities to naturally weave in
    const confirmedParts = [];
    if (attrs.kids_menu === 'yes') confirmedParts.push('提供兒童餐');
    if (attrs.has_diaper_table === 'yes') confirmedParts.push('設有尿布台');
    if (attrs.has_play_area === 'yes') confirmedParts.push('設有遊樂區');
    if (attrs.has_private_room === 'yes') confirmedParts.push('可包廂');
    if (attrs.spacious_seating === 'yes') confirmedParts.push('座位較寬敞');
    if (attrs.kid_noise_tolerant === 'yes') confirmedParts.push('環境不怕吵鬧');

    const likelyStr = likelyFacilities.join('與');
    let note = `根據公開地點資訊，這家餐廳被標示為適合兒童，因此系統推估可能備有${likelyStr}（標示為「估」）。目前尚未取得明確設備資訊，建議出發前向店家確認。`;

    if (confirmedParts.length > 0) {
        note += `此外，此店${confirmedParts.join('、')}。`;
    }

    if (!summary || !summary.trim()) return neutralizeSummarySourceCopy(note);

    // Extract unique context from the original summary — skip sentences that only repeat
    // what our note already covers (Google marking, child facilities absence, visit recommendation).
    const skipKeywords = [
        '官方標記', '官方標示', '適合兒童用餐', '適合兒童', 'Google', '公開地點資訊標示',
        '評論中並未提及', '評論未提及', '評論中沒有', '目前整理資料中未提及',
        '建議前往前', '建議攜帶幼童', '先向店家確認',
        '系統推估', '兒童椅', '兒童餐具'
    ];

    // Split original into sentences (split on 。 keeping the period)
    const rawParts = summary.split('。');
    const sentences = rawParts
        .slice(0, rawParts[rawParts.length - 1].trim() === '' ? -1 : rawParts.length)
        .map(s => s.trim())
        .filter(Boolean);

    const extraSentences = sentences.filter(s =>
        !skipKeywords.some(kw => s.includes(kw))
    ).map(s => s + '。');

    if (extraSentences.length > 0) {
        note += extraSentences.join('');
    }

    return neutralizeSummarySourceCopy(note);
}


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
function loadFavorites() {
    try {
        const stored = safeLocal.getItem('taipei_kids_restaurants_favorites');
        if (stored) {
            const arr = JSON.parse(stored);
            if (Array.isArray(arr)) {
                state.favorites = new Set(arr);
            }
        }
    } catch (e) {
        console.error('Failed to load favorites', e);
    }
}

function saveFavorites() {
    try {
        const arr = Array.from(state.favorites);
        safeLocal.setItem('taipei_kids_restaurants_favorites', JSON.stringify(arr));
    } catch (e) {
        console.error('Failed to save favorites', e);
    }
}

function syncComparisonExpandButton() {
    const expandComparisonBtn = document.getElementById('btn-expand-comparison');
    if (!expandComparisonBtn) return;

    const compareView = document.getElementById('shortlist-compare-view');
    const shortlistDrawer = document.getElementById('shortlist-drawer');
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    const shouldShow = isDesktop
        && state.favorites.size > 0
        && shortlistDrawer
        && shortlistDrawer.classList.contains('active')
        && compareView
        && compareView.classList.contains('active');

    expandComparisonBtn.classList.toggle('hidden', !shouldShow);
}

function wireComparisonTableActions(root) {
    if (!root) return;

    root.querySelectorAll('.comparison-table-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(btn.dataset.placeId);
            refreshComparisonModal();
        });
    });
}

function openComparisonModal() {
    const compareView = document.getElementById('shortlist-compare-view');
    const modal = document.getElementById('comparison-modal');
    const overlay = document.getElementById('comparison-modal-overlay');
    const body = document.getElementById('comparison-modal-body');

    if (!compareView || !modal || !overlay || !body || state.favorites.size === 0) return;

    if (!compareView.classList.contains('active')) {
        return;
    }

    body.innerHTML = compareView.innerHTML;
    wireComparisonTableActions(body);
    overlay.classList.add('active');
    modal.classList.add('active');
    document.body.classList.add('modal-open');
}

function refreshComparisonModal() {
    const modal = document.getElementById('comparison-modal');
    if (!modal || !modal.classList.contains('active')) return;

    if (state.favorites.size === 0) {
        closeComparisonModal();
        return;
    }

    renderShortlistDrawer();
    openComparisonModal();
}

function closeComparisonModal() {
    const modal = document.getElementById('comparison-modal');
    const overlay = document.getElementById('comparison-modal-overlay');
    const body = document.getElementById('comparison-modal-body');

    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    if (body) body.innerHTML = '';
    document.body.classList.remove('modal-open');
}

function updateShortlistUI() {
    const floatShortlistBtn = document.getElementById('float-shortlist');
    const shortlistCountBadge = document.getElementById('shortlist-count');
    const drawerCountBadge = document.getElementById('drawer-count-badge');
    const clearShortlistBtn = document.getElementById('btn-clear-shortlist');
    const shareShortlistBtn = document.getElementById('btn-share-shortlist');

    const count = state.favorites.size;

    if (floatShortlistBtn) {
        if (count > 0) {
            floatShortlistBtn.classList.remove('hidden');
        } else {
            floatShortlistBtn.classList.add('hidden');
            // If the drawer was open, close it
            const shortlistDrawer = document.getElementById('shortlist-drawer');
            const shortlistDrawerOverlay = document.getElementById('shortlist-drawer-overlay');
            if (shortlistDrawer && shortlistDrawer.classList.contains('active')) {
                shortlistDrawer.classList.remove('active');
                shortlistDrawerOverlay.classList.remove('active');
            }
        }
    }

    if (shortlistCountBadge) {
        shortlistCountBadge.textContent = count;
    }
    if (drawerCountBadge) {
        drawerCountBadge.textContent = count;
    }
    if (clearShortlistBtn) {
        if (count > 0) {
            clearShortlistBtn.classList.remove('hidden');
        } else {
            clearShortlistBtn.classList.add('hidden');
        }
    }
    if (shareShortlistBtn) {
        if (count > 0) {
            shareShortlistBtn.classList.remove('hidden');
        } else {
            shareShortlistBtn.classList.add('hidden');
        }
    }
    syncComparisonExpandButton();
}

function toggleFavorite(placeId, event) {
    const isNowFav = !state.favorites.has(placeId);
    
    // Find restaurant name for logging
    const res = restaurantData.find(r => r.place_id === placeId);
    const resName = res ? res.name : '';

    if (isNowFav) {
        state.favorites.add(placeId);
        showToast(`已將「${resName}」加入口袋名單`);
        trackEvent('add_to_shortlist', { restaurant_name: resName });
    } else {
        state.favorites.delete(placeId);
        showToast(`已將「${resName}」移出口袋名單`);
        trackEvent('remove_from_shortlist', { restaurant_name: resName });
    }

    saveFavorites();
    updateShortlistUI();

    // 1. Sync card buttons across the app
    document.querySelectorAll(`.card-favorite-btn[data-place-id="${placeId}"]`).forEach(btn => {
        btn.classList.toggle('active', isNowFav);
        btn.innerHTML = isNowFav ? '❤️' : '🤍';
        btn.title = isNowFav ? '移出口袋名單' : '加入口袋名單';
    });

    // 2. Sync detail view button if open
    const detailFavBtn = document.getElementById('btn-detail-fav');
    if (detailFavBtn && detailFavBtn.dataset.placeId === placeId) {
        detailFavBtn.classList.toggle('active', isNowFav);
        detailFavBtn.innerHTML = isNowFav ? '❤️' : '🤍';
        detailFavBtn.title = isNowFav ? '移出口袋名單' : '加入口袋名單';
    }

    // 3. Re-render drawer if open
    const shortlistDrawer = document.getElementById('shortlist-drawer');
    if (shortlistDrawer && shortlistDrawer.classList.contains('active')) {
        renderShortlistDrawer();
    }

    // 4. Update the URL parameters to match current shortlist
    updateUrl();
}

function renderShortlistDrawer() {
    const listView = document.getElementById('shortlist-list-view');
    const compareView = document.getElementById('shortlist-compare-view');

    if (!listView || !compareView) return;

    const count = state.favorites.size;
    if (count === 0) {
        const emptyHtml = `
            <div class="drawer-empty-state">
                <span class="drawer-empty-icon">❤️</span>
                <h3>你的口袋名單還是空的</h3>
                <p>在餐廳卡片或詳情頁面中點擊「加入口袋」，即可在此比對與挑選心儀的餐廳！</p>
            </div>
        `;
        listView.innerHTML = emptyHtml;
        compareView.innerHTML = emptyHtml;
        syncComparisonExpandButton();
        return;
    }

    // Get selected restaurant data objects
    const savedRestaurants = Array.from(state.favorites)
        .map(id => {
            const res = restaurantData.find(r => r.place_id === id);
            if (!res) return null;
            if (res.ai_summary && !res._ai_summary_patched) {
                res.ai_summary = patchAiSummary(res, res.ai_summary);
                res._ai_summary_patched = true;
            }
            if (res.card_summary && !res._card_summary_patched) {
                res.card_summary = patchAiSummary(res, res.card_summary);
                res._card_summary_patched = true;
            }
            const copy = { ...res };
            if (state.searchLocation && copy.latitude && copy.longitude) {
                copy.distance = calculateDistance(state.searchLocation.lat, state.searchLocation.lng, copy.latitude, copy.longitude);
            }
            return copy;
        })
        .filter(Boolean);

    // Render list view
    if (listView.classList.contains('active')) {
        let listHtml = '<div class="shortlist-list">';
        savedRestaurants.forEach(res => {
            const status = getDynamicStatus(res, state.filters);
            const levelClass = status.class;
            const displayLabel = status.label;
            
            // Build amenity text
            const ams = [];
            const attrs = res.attributes || {};
            if (attrs.has_tableware === 'yes' || attrs.has_tableware === 'likely') ams.push('🍽️兒童餐具' + (attrs.has_tableware === 'likely' ? '(估)' : ''));
            if (attrs.high_chair_available === 'yes' || attrs.high_chair_available === 'likely') ams.push('🪑兒童椅' + (attrs.high_chair_available === 'likely' ? '(估)' : ''));
            if (attrs.has_diaper_table === 'yes' || attrs.has_diaper_table === 'likely') ams.push('🍼尿布台' + (attrs.has_diaper_table === 'likely' ? '(估)' : ''));
            if (attrs.kids_menu === 'yes' || attrs.kids_menu === 'likely') ams.push('🥘兒童餐' + (attrs.kids_menu === 'likely' ? '(估)' : ''));
            if (attrs.kid_noise_tolerant === 'yes' || attrs.kid_noise_tolerant === 'likely') ams.push('🥳不怕吵' + (attrs.kid_noise_tolerant === 'likely' ? '(估)' : ''));
            if (attrs.spacious_seating === 'yes' || attrs.spacious_seating === 'likely') ams.push('🛋️空間寬敞' + (attrs.spacious_seating === 'likely' ? '(估)' : ''));
            if (attrs.has_play_area === 'yes' || attrs.has_play_area === 'likely') ams.push('🧸有遊樂區' + (attrs.has_play_area === 'likely' ? '(估)' : ''));
            if (attrs.has_private_room === 'yes' || attrs.has_private_room === 'likely') ams.push('🚪包廂或可包場' + (attrs.has_private_room === 'likely' ? '(估)' : ''));
            const amsText = ams.length > 0 ? ams.join(' · ') : '暫無特徵標籤';

            listHtml += `
                <div class="shortlist-card" style="cursor: pointer;" onclick="window.showDetailFromMap('${res.place_id}')">
                    <div class="shortlist-info">
                        <div class="shortlist-name-row">
                            <span class="shortlist-name">${formatRestaurantName(res.name)}</span>
                        </div>
                        <div class="shortlist-summary">${res.card_summary || res.ai_summary || '無摘要'}</div>
                        <div class="shortlist-amenities">${amsText}</div>
                    </div>
                    <button class="shortlist-del-btn" data-place-id="${res.place_id}" title="移出清單">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            `;
        });
        listHtml += '</div>';
        listView.innerHTML = listHtml;

        // Wire delete buttons
        listView.querySelectorAll('.shortlist-del-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(btn.dataset.placeId);
            });
        });
    }

    // Render comparison table view
    if (compareView.classList.contains('active')) {
        const isMobilePortrait = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
        let tableHtml = '';

        if (isMobilePortrait) {
            tableHtml += `
                <div class="comparison-mobile-tip">
                    <span class="tip-icon">💡</span>
                    <span>手機橫放或使用大螢幕，可獲得更佳的對比排版體驗喔！</span>
                </div>
            `;
        }

        tableHtml += `
            <div class="comparison-table-wrapper">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>餐廳名稱</th>
                            <th>兒童餐具</th>
                            <th>兒童椅</th>
                            <th>尿布台</th>
                            <th>兒童餐</th>
                            <th>不怕吵</th>
                            <th>空間寬敞</th>
                            <th>有遊樂區</th>
                            <th>可包場</th>
                            <th>車程/步行</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        savedRestaurants.forEach(res => {
            const attrs = res.attributes || {};
            
            const checkIcon = '<span class="check-icon">✓ 有</span>';
            const checkLikelyIcon = '<span class="check-icon likely-icon" title="依公開地點資訊推估，尚未由店家或使用者明確確認，建議出發前再確認。">✓ 估</span>';
            const crossIcon = '<span class="cross-icon">✗ 較小</span>';
            const crossGeneralIcon = '<span class="cross-icon">✗ 無</span>';
            const unknownIcon = '<span class="unknown-icon">? 未知</span>';

            const chair = attrs.high_chair_available === 'yes' ? checkIcon : (attrs.high_chair_available === 'likely' ? checkLikelyIcon : (attrs.high_chair_available === 'no' ? crossGeneralIcon : unknownIcon));
            const spacious = attrs.spacious_seating === 'yes' ? checkIcon : (attrs.spacious_seating === 'likely' ? checkLikelyIcon : (attrs.spacious_seating === 'no' ? crossIcon : unknownIcon));
            const noise = attrs.kid_noise_tolerant === 'yes' ? checkIcon : (attrs.kid_noise_tolerant === 'likely' ? checkLikelyIcon : (attrs.kid_noise_tolerant === 'no' ? crossGeneralIcon : unknownIcon));
            const menu = attrs.kids_menu === 'yes' ? checkIcon : (attrs.kids_menu === 'likely' ? checkLikelyIcon : (attrs.kids_menu === 'no' ? crossGeneralIcon : unknownIcon));
            const tableware = attrs.has_tableware === 'yes' ? checkIcon : (attrs.has_tableware === 'likely' ? checkLikelyIcon : (attrs.has_tableware === 'no' ? crossGeneralIcon : unknownIcon));
            const diaper = attrs.has_diaper_table === 'yes' ? checkIcon : (attrs.has_diaper_table === 'likely' ? checkLikelyIcon : (attrs.has_diaper_table === 'no' ? crossGeneralIcon : unknownIcon));
            const play = attrs.has_play_area === 'yes' ? checkIcon : (attrs.has_play_area === 'likely' ? checkLikelyIcon : (attrs.has_play_area === 'no' ? crossGeneralIcon : unknownIcon));
            const room = attrs.has_private_room === 'yes' ? checkIcon : (attrs.has_private_room === 'likely' ? checkLikelyIcon : (attrs.has_private_room === 'no' ? crossGeneralIcon : unknownIcon));

            const isWholeCity = state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市');
            const times = (!isWholeCity && res.distance) ? calculateTravelTimes(res.distance) : null;
            const travelText = times ? `🚗${times.driving}分 / 🚶${times.walking}分` : (isWholeCity ? '全市範圍' : '未定位');

            tableHtml += `
                <tr>
                    <td>
                        <div class="comparison-table-name-cell">
                            <a href="#" onclick="window.showDetailFromMap('${res.place_id}'); return false;">${formatRestaurantName(res.name)}</a>
                        </div>
                    </td>
                    <td>${tableware}</td>
                    <td>${chair}</td>
                    <td>${diaper}</td>
                    <td>${menu}</td>
                    <td>${noise}</td>
                    <td>${spacious}</td>
                    <td>${play}</td>
                    <td>${room}</td>
                    <td style="color: var(--text-muted); font-weight: 600;">${travelText}</td>
                    <td>
                        <span class="comparison-table-del" data-place-id="${res.place_id}" title="移出清單">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </span>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;
        compareView.innerHTML = tableHtml;

        // Wire table delete links
        compareView.querySelectorAll('.comparison-table-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(btn.dataset.placeId);
            });
        });
    }

    syncComparisonExpandButton();
}

// Feedback Modal functions
function openFeedbackModal(restaurant) {
    if (!restaurant) return;
    trackEvent('open_feedback_modal', { restaurant_name: restaurant.name });
    
    const modalOverlay = document.getElementById('feedback-modal-overlay');
    const modal = document.getElementById('feedback-modal');
    const nameInput = document.getElementById('feedback-restaurant-name');
    const idInput = document.getElementById('feedback-restaurant-id');
    const descriptionTextarea = document.getElementById('feedback-description');
    const emailInput = document.getElementById('feedback-email');
    
    // Prefill
    if (nameInput) nameInput.value = restaurant.name || '';
    if (idInput) idInput.value = restaurant.place_id || '';
    
    // Dynamically render issue checkboxes based on restaurant's current attributes
    const attrs = restaurant.attributes || {};
    const issueGrid = document.getElementById('feedback-issue-grid');
    if (issueGrid) {
        const specs = [
            {
                key: 'has_tableware',
                emoji: '🍽️',
                yesLabel: '實際上無兒童餐具',
                yesValue: '實際上無提供兒童餐具',
                noLabel: '其實有兒童餐具',
                noValue: '其實有提供兒童餐具'
            },
            {
                key: 'high_chair_available',
                emoji: '🪑',
                yesLabel: '實際上無兒童椅',
                yesValue: '實際上無提供兒童椅',
                noLabel: '其實有兒童椅',
                noValue: '其實有提供兒童椅'
            },
            {
                key: 'has_diaper_table',
                emoji: '🍼',
                yesLabel: '實際上無尿布台',
                yesValue: '實際上無尿布台',
                noLabel: '其實有尿布台',
                noValue: '其實有尿布台'
            },
            {
                key: 'kids_menu',
                emoji: '🥘',
                yesLabel: '實際上無兒童餐',
                yesValue: '實際上無提供兒童餐',
                noLabel: '其實有兒童餐',
                noValue: '其實有提供兒童餐'
            },
            {
                key: 'kid_noise_tolerant',
                emoji: '🥳',
                yesLabel: '實際上氣氛安靜需留意',
                yesValue: '實際上氣氛安靜不適合吵鬧',
                noLabel: '其實環境不怕吵鬧',
                noValue: '其實環境不怕吵鬧'
            },
            {
                key: 'spacious_seating',
                emoji: '🛋️',
                yesLabel: '實際上空間較狹窄',
                yesValue: '實際上空間較狹窄',
                noLabel: '其實空間寬敞',
                noValue: '其實空間寬敞'
            },
            {
                key: 'has_play_area',
                emoji: '🧸',
                yesLabel: '實際上無遊樂區',
                yesValue: '實際上無遊樂區',
                noLabel: '其實有遊樂區',
                noValue: '其實有遊樂區'
            },
            {
                key: 'has_private_room',
                emoji: '🚪',
                yesLabel: '實際上無包廂且不可包場',
                yesValue: '實際上無包廂且不可包場',
                noLabel: '其實有包廂或可包場',
                noValue: '其實有包廂或可包場'
            }
        ];

        let gridHtml = '';
        specs.forEach(spec => {
            const hasFeature = attrs[spec.key] === 'yes' || attrs[spec.key] === 'likely';
            const label = hasFeature ? spec.yesLabel : spec.noLabel;
            const value = hasFeature ? spec.yesValue : spec.noValue;
            gridHtml += `
                <label class="checkbox-label">
                    <input type="checkbox" class="feedback-issue-cb" value="${value}"> ${spec.emoji} ${label}
                </label>
            `;
        });

        // Add static options: closed/moved and other
        gridHtml += `
            <label class="checkbox-label text-danger">
                <input type="checkbox" class="feedback-issue-cb" value="餐廳已歇業或搬遷"> ⚠️ 餐廳已歇業/搬遷
            </label>
            <label class="checkbox-label">
                <input type="checkbox" class="feedback-issue-cb" value="其他"> 💬 其他建議或補充
            </label>
        `;

        issueGrid.innerHTML = gridHtml;
    }
    
    // Clear form text inputs
    if (descriptionTextarea) descriptionTextarea.value = '';
    if (emailInput) emailInput.value = '';
    
    // Show Modal
    if (modalOverlay) modalOverlay.classList.add('active');
    if (modal) modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock scrolling
}

function closeFeedbackModal() {
    const modalOverlay = document.getElementById('feedback-modal-overlay');
    const modal = document.getElementById('feedback-modal');
    
    if (modalOverlay) modalOverlay.classList.remove('active');
    if (modal) modal.classList.remove('active');
    
    // Restore scrolling only if detail view is NOT active
    if (state.view !== 'detail') {
        document.body.style.overflow = '';
    }
}

async function handleFeedbackSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('btn-submit-feedback');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '提交回報';
    
    // Collect checked issues
    const checkedIssues = [];
    document.querySelectorAll('.feedback-issue-cb:checked').forEach(cb => {
        checkedIssues.push(cb.value);
    });
    
    const description = document.getElementById('feedback-description').value.trim();
    const email = document.getElementById('feedback-email').value.trim();
    const restaurantName = document.getElementById('feedback-restaurant-name').value;
    const restaurantId = document.getElementById('feedback-restaurant-id').value;
    
    // Validation: Must select at least one issue, OR write a description
    if (checkedIssues.length === 0 && !description) {
        alert('請至少選擇一個欲回報或補充的項目，或填寫具體說明！');
        return;
    }
    
    // Spam honeypot check
    const honeypot = document.querySelector('.hidden-honeypot');
    if (honeypot && honeypot.checked) {
        console.warn('Bot detected');
        closeFeedbackModal();
        return;
    }
    
    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '⌛ 提交中...';
        }
        
        // Construct form data payload for Web3Forms to prevent CORS preflight and PWA spam filters
        const formData = new URLSearchParams();
        formData.append('access_key', WEB3FORMS_ACCESS_KEY);
        formData.append('name', '親子餐廳地圖 - 資訊回報與貢獻');
        formData.append('subject', `🚩 餐廳資訊更新回報: ${restaurantName}`);
        formData.append('restaurant_name', restaurantName);
        formData.append('restaurant_id', restaurantId);
        formData.append('issues', checkedIssues.join(', '));
        formData.append('description', description);
        if (email) {
            formData.append('email', email);
        }
        
        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: formData.toString()
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            trackEvent('submit_feedback_form', {
                restaurant_name: restaurantName,
                issue_count: checkedIssues.length,
                has_description: description ? 'yes' : 'no',
                has_email: email ? 'yes' : 'no'
            });
            showToast('感謝您的回報與貢獻！我們會核實並儘快更新。');
            closeFeedbackModal();
        } else {
            throw new Error(result.message || '伺服器回應異常');
        }
    } catch (err) {
        console.error('Error submitting feedback:', err);
        alert('提交失敗：' + err.message + '\n\n【排查提示】\n如果您在手機上測試時使用的是局域網 IP (如 192.168.x.x) 或直接開檔案測試，Web3Forms 安全機制可能會因為網域不符而拒絕傳送。請部署至 GitHub Pages 後再在正式網址上測試，即可正常使用！');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

async function submitAiFeedback(isHelpful, checkedIssues, comment, email, restaurant) {
    try {
        const formData = new URLSearchParams();
        formData.append('access_key', WEB3FORMS_ACCESS_KEY);
        formData.append('name', '親子餐廳地圖 - 詳情頁面意見回饋');
        formData.append('subject', `${isHelpful ? '👍' : '👎'} 詳情頁面回饋: ${restaurant.name || '未命名餐廳'}`);
        formData.append('restaurant_name', restaurant.name || '未命名餐廳');
        formData.append('restaurant_id', restaurant.place_id || '');
        formData.append('is_helpful', isHelpful ? '有幫助' : '沒幫助');
        if (!isHelpful) {
            formData.append('issues', checkedIssues.join(', ') || '無');
            formData.append('comment', comment || '無');
        }
        if (email) {
            formData.append('email', email);
        }

        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: formData.toString()
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            console.error('AI Feedback server error:', result.message);
        }
    } catch (err) {
        console.error('Error submitting AI feedback:', err);
    }
}

// PWA Installation Prompt Logic
let deferredPrompt = null;
if (!safeSession.getItem('pwa_session_start_time')) {
    safeSession.setItem('pwa_session_start_time', Date.now().toString());
}
let pwaSessionStartTime = parseInt(safeSession.getItem('pwa_session_start_time'), 10);

function getPwaBrowserContext() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);
    const isIOSSafari = isIOS && /WebKit/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua) && !/EdgiOS/.test(ua) && !/GSA/.test(ua) && !/Line\//.test(ua) && !/FBAV/.test(ua) && !/FBAN/.test(ua) && !/Instagram/.test(ua);
    const isIOSChrome = isIOS && /CriOS/.test(ua);
    const isIOSInApp = isIOS && !isIOSSafari && !isIOSChrome;
    const isAndroidInApp = isAndroid && /Line\/|FBAV|FBAN|Instagram|MicroMessenger/.test(ua);
    return { ua, isIOS, isAndroid, isIOSSafari, isIOSChrome, isIOSInApp, isAndroidInApp };
}

function showPwaPrompt() {
    const promptEl = document.getElementById('pwa-install-prompt');
    if (!promptEl || promptEl.classList.contains('show')) return;

    preparePwaPromptForCurrentBrowser();
    promptEl.classList.remove('hidden');
    setTimeout(() => {
        promptEl.classList.add('show');
    }, 50);
}

function preparePwaPromptForCurrentBrowser() {
    const promptEl = document.getElementById('pwa-install-prompt');
    const cancelBtn = document.getElementById('pwa-btn-cancel');
    const installBtn = document.getElementById('pwa-btn-install');
    if (!promptEl) return;

    const context = getPwaBrowserContext();
    const titleEl = promptEl.querySelector('.pwa-prompt-title');
    const descEl = promptEl.querySelector('.pwa-prompt-desc');
    const iosGuideline = promptEl.querySelector('.pwa-ios-guideline');
    const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');

    if (iosGuideline) iosGuideline.classList.add('hidden');
    if (browserGuideline) browserGuideline.classList.add('hidden');
    if (cancelBtn) cancelBtn.textContent = '下次再說';
    if (installBtn) {
        installBtn.style.display = '';
        installBtn.textContent = '立即加入';
    }
    if (titleEl) titleEl.textContent = '將「帶小孩吃什麼」加入主畫面';

    if (context.isAndroid && deferredPrompt) {
        if (descEl) descEl.textContent = '按下「立即加入」後，瀏覽器會跳出加入主畫面的確認視窗。';
        promptEl.dataset.pwaMode = 'android-native';
    } else if (context.isAndroid) {
        if (descEl) descEl.textContent = '請使用瀏覽器選單中的「新增至主畫面」或「安裝應用程式」。';
        if (installBtn) installBtn.textContent = '查看步驟';
        promptEl.dataset.pwaMode = 'android-guideline';
    } else {
        if (descEl) descEl.textContent = '下次查詢更快速，還能享有全螢幕的體驗！';
        promptEl.dataset.pwaMode = 'default';
    }
}

function showPwaSafariInstallGuideline() {
    const promptEl = document.getElementById('pwa-install-prompt');
    const cancelBtn = document.getElementById('pwa-btn-cancel');
    const installBtn = document.getElementById('pwa-btn-install');
    if (!promptEl) return;

    const iosGuideline = promptEl.querySelector('.pwa-ios-guideline');
    const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
    const descEl = promptEl.querySelector('.pwa-prompt-desc');

    if (browserGuideline) browserGuideline.classList.add('hidden');
    if (iosGuideline) iosGuideline.classList.remove('hidden');
    if (installBtn) installBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.textContent = '我知道了';
    if (descEl) descEl.textContent = '依照下方導引，即可將此網頁加入主畫面。';
    promptEl.dataset.pwaMode = 'safari-guideline';
}

function setupPwaInstallPrompt() {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registered successfully:', reg.scope))
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }

    // 2. Track unique visits across sessions (using sessionStorage to guard new sessions)
    if (!safeSession.getItem('pwa_session_active')) {
        safeSession.setItem('pwa_session_active', 'true');
        let visitCount = parseInt(safeLocal.getItem('pwa_visit_count') || '0', 10);
        visitCount += 1;
        safeLocal.setItem('pwa_visit_count', visitCount.toString());
        console.log(`PWA Session visit count incremented: ${visitCount}`);
    }

    // 3. Listen for Android/Chrome native PWA install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        console.log('beforeinstallprompt event captured');
        preparePwaPromptForCurrentBrowser();
        
        // Check triggers when the browser says app is installable
        checkPwaInstallTrigger();
    });

    // 4. Setup prompt action buttons
    const promptEl = document.getElementById('pwa-install-prompt');
    const cancelBtn = document.getElementById('pwa-btn-cancel');
    const installBtn = document.getElementById('pwa-btn-install');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (cancelBtn.textContent === '我知道了') {
                trackEvent('close_pwa_tutorial');
            } else {
                trackEvent('click_pwa_cancel');
            }
            if (promptEl) promptEl.classList.remove('show');
            
            // Store session dismissal
            safeSession.setItem('pwa_dismissed_this_session', 'true');
            
            // Increment total dismiss count
            let dismissCount = parseInt(safeLocal.getItem('pwa_dismiss_count') || '0', 10);
            dismissCount++;
            safeLocal.setItem('pwa_dismiss_count', dismissCount.toString());
            
            console.log('PWA prompt dismissed by user. Total dismisses: ' + dismissCount);
        });
    }

    if (installBtn) {
        installBtn.addEventListener('click', () => {
            trackEvent('click_pwa_install', { pwa_mode: promptEl.dataset.pwaMode || 'unknown' });
            const ua = navigator.userAgent;
            const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
            const isAndroid = /Android/.test(ua);

            // --- Detect browser context ---
            const isIOSSafari   = isIOS && /WebKit/.test(ua) && !/CriOS/.test(ua) && !/GSA/.test(ua) && !/Line\//.test(ua) && !/FBAV/.test(ua) && !/FBAN/.test(ua) && !/Instagram/.test(ua);
            const isIOSChrome   = isIOS && /CriOS/.test(ua);
            const isIOSInApp    = isIOS && !isIOSSafari && !isIOSChrome; // LINE, GSA, FB, IG, Messenger, etc.
            const isAndroidInApp= isAndroid && /Line\/|FBAV|FBAN|Instagram|MicroMessenger/.test(ua);

            // Helper: show a guideline panel and transform buttons
            function showGuideline(guidelineEl, descText, injectUrlParam = false) {
                guidelineEl.classList.remove('hidden');
                installBtn.style.display = 'none';
                cancelBtn.textContent = '我知道了';
                const descEl = promptEl.querySelector('.pwa-prompt-desc');
                if (descEl) descEl.textContent = descText;

                if (injectUrlParam) {
                    const url = new URL(window.location.href);
                    if (!url.searchParams.has('open_pwa')) {
                        url.searchParams.set('open_pwa', '1');
                        window.history.replaceState({}, '', url);
                    }
                }
            }

            // Helper: build numbered step HTML
            function steps(arr) {
                return arr.map((s, i) =>
                    `<div class="pwa-step"><span class="pwa-step-num">${i + 1}</span><span class="pwa-step-desc">${s}</span></div>`
                ).join('');
            }

            if (isAndroid && deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        safeLocal.setItem('pwa_prompt_dismissed', 'true');
                        console.log('User accepted the PWA install prompt');
                    } else {
                        console.log('User dismissed the PWA install prompt');
                    }
                    deferredPrompt = null;
                });
                if (promptEl) promptEl.classList.remove('show');
                return;
            }

            if (isAndroid && !isAndroidInApp) {
                const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
                const browserText = promptEl.querySelector('.pwa-browser-text');
                if (browserGuideline && browserText) {
                    browserText.innerHTML = steps([
                        '點擊右上角瀏覽器選單「⋮」',
                        '選擇「<strong>新增至主畫面</strong>」或「<strong>安裝應用程式</strong>」',
                        '依照瀏覽器畫面確認即可完成'
                    ]);
                    showGuideline(browserGuideline, '這個瀏覽器目前沒有提供一鍵安裝視窗，請依照下方步驟加入主畫面。');
                }
                return;
            }

            if (isIOSChrome) {
                const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
                const browserText = promptEl.querySelector('.pwa-browser-text');
                if (browserGuideline && browserText) {
                    browserText.innerHTML = steps([
                        '點右上角的分享或選單按鈕',
                        '選擇「在 Safari 中開啟」',
                        'Safari 開啟後，會立刻出現加入主畫面的步驟'
                    ]);
                    showGuideline(browserGuideline, '請先用 Safari 開啟：', true);
                }
                return;
            }

            if (isIOSSafari) {
                // Show Safari-specific panel (arrow pointing down to bottom toolbar)
                const iosGuideline = promptEl.querySelector('.pwa-ios-guideline');
                if (iosGuideline) showGuideline(iosGuideline, '依照下方導引，即可將此網頁安裝至主畫面。');

            } else if (isIOSChrome) {
                // iOS Chrome: share button is at top right
                const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
                const browserText      = promptEl.querySelector('.pwa-browser-text');
                if (browserGuideline && browserText) {
                    browserText.innerHTML = steps([
                        '點擊右上角的分享圖示 ↑（網址列右側）',
                        '在選單中選擇「<strong>加入主畫面</strong>」➕',
                        '點擊右上角「加入」即完成！',
                    ]);
                    showGuideline(browserGuideline, '依照下方步驟，用 Chrome 加入主畫面：');
                }

            } else if (isIOSInApp) {
                // iOS in-app browser (LINE、Google App、Facebook、Instagram 等)
                // 只引導切換到外部瀏覽器，切換後 PWA 提示會自動重新出現
                const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
                const browserText      = promptEl.querySelector('.pwa-browser-text');
                if (browserGuideline && browserText) {
                    const isLINE = /Line\//.test(ua);
                    if (isLINE) {
                        browserText.innerHTML =
                            '<div style="margin-bottom:8px;">此頁在 LINE 內開啟，無法直接安裝。</div>' +
                            steps([
                                '點擊畫面<strong>右下角</strong>的 <strong>⋯</strong>',
                                '選擇「<strong>在瀏覽器中開啟</strong>」',
                                '網頁在 Safari 開啟後，提示將自動再次出現 🎉',
                            ]);
                    } else {
                        browserText.innerHTML =
                            '<div style="margin-bottom:8px;">此頁在 App 內開啟，無法直接安裝。</div>' +
                            steps([
                                '點擊瀏覽器的分享 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline; margin: 0 2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> 按鈕',
                                '選擇「<strong>在 Safari 中開啟</strong>」或「<strong>用瀏覽器開啟</strong>」',
                                '網頁在 Safari 開啟後，提示將自動再次出現 🎉',
                            ]);
                    }
                    showGuideline(browserGuideline, '請先切換到 Safari：', true);
                }

            } else if (deferredPrompt) {
                // Android Chrome (or other supporting browsers): native install prompt
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the PWA install prompt');
                    } else {
                        console.log('User dismissed the PWA install prompt');
                    }
                    deferredPrompt = null;
                });
                if (promptEl) promptEl.classList.remove('show');

            } else if (isAndroidInApp) {
                // Android in-app browser (LINE, Facebook, Instagram, WeChat...)
                // 只引導切換到外部瀏覽器，切換後 PWA 提示會自動重新出現
                const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
                const browserText      = promptEl.querySelector('.pwa-browser-text');
                if (browserGuideline && browserText) {
                    const isLINE = /Line\//.test(ua);
                    if (isLINE) {
                        browserText.innerHTML =
                            '<div style="margin-bottom:8px;">此頁在 LINE 內開啟，無法直接安裝。</div>' +
                            steps([
                                '點擊畫面<strong>右下角</strong>的 <strong>⋯</strong>',
                                '選擇「<strong>在瀏覽器中開啟</strong>」',
                                '網頁在 Chrome 開啟後，提示將自動再次出現 🎉',
                            ]);
                    } else {
                        browserText.innerHTML =
                            '<div style="margin-bottom:8px;">此頁在 App 內開啟，無法直接安裝。</div>' +
                            steps([
                                '點擊瀏覽器內的 <strong>⋯</strong> 選單或分享按鈕',
                                '選擇「<strong>用預設瀏覽器開啟</strong>」或「<strong>在 Chrome 中開啟</strong>」',
                                '網頁在 Chrome 開啟後，提示將自動再次出現 🎉',
                            ]);
                    }
                    showGuideline(browserGuideline, '請先切換到 Chrome：', true);
                }

            } else {
                // Fallback
                const descEl = promptEl.querySelector('.pwa-prompt-desc');
                if (descEl) {
                    descEl.innerHTML = '請點擊瀏覽器選單中的「<strong>新增至主畫面</strong>」或「<strong>安裝應用程式</strong>」即可安裝。';
                }
                installBtn.style.display = 'none';
            }
        });
    }

    // 5. Setup a periodic check for the duration trigger (every 10 seconds)
    setInterval(checkPwaInstallTrigger, 10000);
    
    // Check immediately on load (especially for ?open_pwa=1 Safari handoffs)
    setTimeout(checkPwaInstallTrigger, 100);
}

function checkPwaInstallTrigger() {
    const promptEl = document.getElementById('pwa-install-prompt');
    if (!promptEl) return;

    // Check for open_pwa parameter (from in-app browser handoff)
    const urlParams = new URLSearchParams(window.location.search);
    let forceShow = false;
    if (urlParams.get('open_pwa') === '1') {
        forceShow = true;
        urlParams.delete('open_pwa');
        const newSearch = urlParams.toString();
        const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
    }

    // Check if running in standalone/installed mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
        console.log('PWA is already running in standalone mode');
        return;
    }

    // Check if dismissed (unless forced via URL)
    if (!forceShow) {
        // Hide if dismissed in current session
        if (safeSession.getItem('pwa_dismissed_this_session') === 'true') return;
        
        // Hide permanently if dismissed 3 or more times
        const dismissCount = parseInt(safeLocal.getItem('pwa_dismiss_count') || '0', 10);
        if (dismissCount >= 3) return;
        
        // Backwards compatibility for old dismissed flag
        if (safeLocal.getItem('pwa_prompt_dismissed') === 'true') return;
    }

    // Skip desktop users (devices with a precise pointer, i.e. mouse)
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (isDesktop && !forceShow) return;

    // Evaluate triggers (mobile only)
    const visitCount = parseInt(safeLocal.getItem('pwa_visit_count') || '0', 10);
    const sessionDuration = (Date.now() - pwaSessionStartTime) / 1000; // in seconds
    const pwaContext = getPwaBrowserContext();

    // Show if: forced from a browser handoff, OR used continuously for 60+ seconds.
    // Do not use visit count as an early trigger: on iOS Chrome this made the prompt
    // appear almost immediately for returning users.
    const hasViewedDetail = state.detailViews && state.detailViews.size > 0;
    const shouldShow = forceShow || (sessionDuration >= 60 && hasViewedDetail);

    if (shouldShow && !promptEl.classList.contains('show')) {
        console.log(`Triggering PWA install prompt: visits=${visitCount}, duration=${sessionDuration.toFixed(1)}s, forceShow=${forceShow}`);
        showPwaPrompt();
        if (forceShow && pwaContext.isIOSSafari) {
            setTimeout(showPwaSafariInstallGuideline, 80);
        }
    }
}

// Start the app
init();

