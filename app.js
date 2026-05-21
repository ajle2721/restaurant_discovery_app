const state = {
    filters: new Set(),
    searchLocation: null, // {name, lat, lng, type, district}
    userLocation: null, // {lat, lng}
    selectedRestaurant: null,
    view: 'home', // 'home', 'detail'
    map: null,
    markers: [],
    markerMap: {},
    locationData: [], // From taipei_locations.json
    showOthers: false,
    hideLowQualityMarkers: true, // Default to true
    currentResults: [],
    favorites: new Set(),
    mapManuallyToggled: false,
    isInitialSearchScroll: false
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

const filterMap = {
    high_chair_available: 'child_seat_available',
    kids_menu: 'kids_menu_available',
    spacious_seating: 'spacious_seating',
    kid_noise_tolerant: 'kid_noise_tolerant'
};

const attributeIcons = {
    high_chair_available: '🪑',
    kids_menu: '🥘',
    spacious_seating: '🛋️',
    kid_noise_tolerant: '🥳'
};

const attributeLabels = {
    high_chair_available: '兒童椅',
    kids_menu: '兒童餐',
    spacious_seating: '空間寬敞',
    kid_noise_tolerant: '不怕吵'
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

function getPFSummaryTags(res, overrideLevel, simpleFormat = false) {
    const attrs = res.attributes || {};
    
    // If filters are active, show match count
    if (state.filters && state.filters.size > 0) {
        const level = overrideLevel || (typeof getDynamicStatus === 'function' ? getDynamicStatus(res, state.filters).level : 'Insufficient Info');
        
        const attributeDetails = {
            high_chair_available: {
                yes: '兒童椅',
                no: '無提供兒童椅',
                unknown: '評論未提及兒童椅'
            },
            kids_menu: {
                yes: '兒童餐',
                no: '無提供兒童餐',
                unknown: '評論未提及兒童餐'
            },
            spacious_seating: {
                yes: '空間寬敞',
                no: '空間較為擁擠',
                unknown: '評論未提及空間大小'
            },
            kid_noise_tolerant: {
                yes: '不怕吵鬧',
                no: '氣氛較安靜',
                unknown: '評論未提及氣氛安靜度'
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
                high_chair_available: '兒童椅',
                kids_menu: '兒童餐',
                spacious_seating: '空間大小',
                kid_noise_tolerant: '氣氛安靜度'
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
                    return `評論未提及${unknownNouns[0]}`;
                } else if (unknownNouns.length === 2) {
                    return `評論未提及${unknownNouns[0]}與${unknownNouns[1]}`;
                } else {
                    const lastNoun = unknownNouns.pop();
                    return `評論未提及${unknownNouns.join('、')}與${lastNoun}`;
                }
            }
        }
        
        if (level === 'Low Match' || level === '其他友善選擇') {
            const allKeys = ['high_chair_available', 'kids_menu', 'spacious_seating', 'kid_noise_tolerant'];
            const otherYesAttrs = [];
            allKeys.forEach(k => {
                if (!state.filters.has(k) && attrs[k] === 'yes') {
                    otherYesAttrs.push(attributeDetails[k].yes);
                }
            });
            if (otherYesAttrs.length > 0) {
                return `具備其他特色：${otherYesAttrs.join('、')}`;
            }
        }

        let matchCount = 0;
        const matchedNames = [];
        state.filters.forEach(f => {
            if (attrs[f] === 'yes') {
                matchCount++;
                matchedNames.push(attributeLabels[f]);
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
    if (attrs.high_chair_available === 'yes') tags.push('兒童椅');
    if (attrs.kids_menu === 'yes') tags.push('兒童餐');
    if (attrs.spacious_seating === 'yes') tags.push('空間寬敞');
    if (attrs.kid_noise_tolerant === 'yes') tags.push('不怕吵');
    
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
const clearSearchBtn = document.getElementById('clear-search');
const searchResultsView = document.getElementById('search-results-view');
const currentSearchLocText = document.getElementById('current-search-location');
const resetSearchBtn = document.getElementById('reset-search');
const recommendedList = document.getElementById('recommended-list');
const othersList = document.getElementById('others-list');
const toggleOthersBtn = document.getElementById('toggle-others');
const fallbackHint = document.getElementById('fallback-hint');
const noResultsState = document.getElementById('no-results');

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
        }

        initMap();
        loadFavorites();
        setupEventListeners();
        updateShortlistUI();

        // Global listener for map popup buttons (View Details)
        state.map.on('popupopen', (e) => {
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

        console.log('Map initialized');
        checkUrlParams();
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
        }
    });

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
    btnNearby.addEventListener('click', () => {
        trackEvent('click_nearby');
        handleNearby();
    });

    // Quick Links
    document.querySelectorAll('.quick-link-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const locName = btn.dataset.loc;
            const locObj = state.locationData.find(l => l.name === locName);
            
            trackEvent('click_popular_location', { location_name: locName });
            
            if (locObj) selectLocation(locObj, 'popular_location');
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
            
            trackEvent('use_filter', {
                filter_name: filterMap[filter] || filter,
                action: action
            });
            
            renderResults();
            updateUrl();
        });
    });

    // Clear All Filters
    const clearAllFiltersBtn = document.getElementById('clear-all-filters');
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            state.filters.clear();
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            renderResults();
            updateUrl();
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
            
            renderResults();
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
        renderResults();
    });

    // Reset Search
    resetSearchBtn.addEventListener('click', () => {
        state.searchLocation = null;
        state.userLocation = null;
        state.filters.clear();
        state.hideLowQualityMarkers = true; // Reset to default: hide low quality
        state.showOthers = false; // Reset to default: hide others list
        state.mapManuallyToggled = false;
        toggleMap(true);
        
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
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
        updateUrl();
    });

    // Navigation
    backHomeBtn.addEventListener('click', () => switchView('home'));

    // Sharing
    if (floatShareBtn) floatShareBtn.addEventListener('click', shareCurrentFilters);
    detailShareBtn.addEventListener('click', () => {
        if (state.selectedRestaurant) shareRestaurant(state.selectedRestaurant);
    });

    // Trending Items
    document.querySelectorAll('.trending-item').forEach(item => {
        item.addEventListener('click', () => {
            const locName = item.dataset.loc;
            const filter = item.dataset.filter;
            const scenarioTitle = item.textContent.trim();
            
            trackEvent('click_suggested_scenario', { scenario_title: scenarioTitle });

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

    if (floatShortlistBtn) {
        floatShortlistBtn.addEventListener('click', () => {
            shortlistDrawer.classList.add('active');
            shortlistDrawerOverlay.classList.add('active');
            renderShortlistDrawer();
        });
    }

    if (closeShortlistDrawerBtn) {
        closeShortlistDrawerBtn.addEventListener('click', () => {
            shortlistDrawer.classList.remove('active');
            shortlistDrawerOverlay.classList.remove('active');
            shortlistDrawer.classList.remove('full-height');
        });
    }

    if (shortlistDrawerOverlay) {
        shortlistDrawerOverlay.addEventListener('click', () => {
            shortlistDrawer.classList.remove('active');
            shortlistDrawerOverlay.classList.remove('active');
            shortlistDrawer.classList.remove('full-height');
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
        });

        tabCompare.addEventListener('click', () => {
            tabCompare.classList.add('active');
            tabList.classList.remove('active');
            document.getElementById('shortlist-compare-view').classList.add('active');
            document.getElementById('shortlist-list-view').classList.remove('active');
            renderShortlistDrawer();
        });
    }

    if (clearShortlistBtn) {
        clearShortlistBtn.addEventListener('click', () => {
            if (confirm('確定要清空考慮清單中的所有餐廳嗎？')) {
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
                    detailFavBtn.innerHTML = '📋 加入考慮清單';
                }
                showToast('已清空考慮清單');
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
            
            const shareText = `這是我精選的台北親子友善餐廳考慮清單，分享給你！`;
            const fullContent = `${shareText}\n${shareUrl.toString()}`;
            
            if (navigator.share) {
                navigator.share({
                    title: '我的台北親子餐廳考慮清單',
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

    // Map Collapse Button click listener
    const toggleMapBtn = document.getElementById('toggle-map-btn');
    if (toggleMapBtn) {
        toggleMapBtn.addEventListener('click', () => {
            const mapContainer = document.getElementById('map-container');
            if (mapContainer) {
                const isCollapsed = mapContainer.classList.contains('collapsed');
                state.mapManuallyToggled = true; // Mark as explicitly toggled by user
                toggleMap(isCollapsed);
                
                trackEvent('click_toggle_map', {
                    action: isCollapsed ? 'expand' : 'collapse'
                });
            }
        });
    }

    // Auto-collapse map on mobile scroll
    let autoCollapsed = false;
    window.addEventListener('scroll', () => {
        if (state.isInitialSearchScroll) return; // Skip during initial scroll jump
        if (window.innerWidth >= 768) return;
        const resultsView = document.getElementById('search-results-view');
        if (!resultsView || resultsView.classList.contains('hidden')) return;

        const mapContainer = document.getElementById('map-container');
        if (!mapContainer) return;

        const currentScrollY = window.scrollY;
        const relativeScrollY = currentScrollY - resultsView.offsetTop;

        // User scrolled down past 120px relative to search results top, and map is expanded
        if (relativeScrollY > 120 && !mapContainer.classList.contains('collapsed') && !state.mapManuallyToggled) {
            toggleMap(false);
            autoCollapsed = true;

            // Stabilize layout: adjust scroll position so the first restaurant smoothly aligns with the viewport top
            state.isInitialSearchScroll = true;
            window.scrollTo(0, resultsView.offsetTop);
            setTimeout(() => {
                state.isInitialSearchScroll = false;
            }, 50);
        }
        // User scrolled back past the top of search results (relative scroll < -10) and map was auto-collapsed
        else if (relativeScrollY < -10 && mapContainer.classList.contains('collapsed') && autoCollapsed) {
            toggleMap(true);
            autoCollapsed = false;
        }
    });
}

function toggleMap(visible) {
    const mapContainer = document.getElementById('map-container');
    const toggleMapBtn = document.getElementById('toggle-map-btn');
    if (!mapContainer || !toggleMapBtn) return;

    const mapBtnText = toggleMapBtn.querySelector('.map-btn-text');

    if (visible) {
        mapContainer.classList.remove('collapsed');
        if (mapBtnText) mapBtnText.textContent = '收起地圖';
        // Invalidate size after transition finishes
        setTimeout(() => {
            if (state.map) {
                state.map.invalidateSize();
            }
        }, 360);
    } else {
        mapContainer.classList.add('collapsed');
        if (mapBtnText) mapBtnText.textContent = '顯示地圖';
    }
}

function handleAutocomplete() {
    const query = searchInput.value.trim().toLowerCase();
    if (query.length === 0) {
        autocompleteDropdown.classList.add('hidden');
        clearSearchBtn.classList.add('hidden');
        return;
    }
    clearSearchBtn.classList.remove('hidden');

    const matches = state.locationData.filter(loc => {
        return loc.name.toLowerCase().includes(query) || 
               (loc.keywords && loc.keywords.some(k => k.toLowerCase().includes(query)));
    }).slice(0, 8);

    if (matches.length > 0) {
        autocompleteDropdown.innerHTML = matches.map(loc => `
            <div class="autocomplete-item" data-name="${loc.name}">
                <span class="icon">${loc.type === '行政區' ? '🏘️' : (loc.type.includes('捷運') ? '🚇' : '📍')}</span>
                <span class="name">${loc.name}</span>
                <span class="type">${loc.type}</span>
            </div>
        `).join('');
        autocompleteDropdown.classList.remove('hidden');

        autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const locObj = matches.find(m => m.name === item.dataset.name);
                selectLocation(locObj, 'manual_input');
            });
        });
    } else {
        autocompleteDropdown.classList.add('hidden');
    }
}

function handleNearby() {
    if (!navigator.geolocation) {
        showToast('瀏覽器不支援定位功能');
        return;
    }

    btnNearby.innerHTML = '定位中...';
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
            btnNearby.innerHTML = '<span class="icon">📍</span> <span class="btn-text-desktop">看我附近適合帶小孩的餐廳</span><span class="btn-text-mobile">找我附近適合小孩的餐廳</span>';
        },
        (err) => {
            console.error(err);
            showToast('定位失敗，請手動輸入地點');
            btnNearby.innerHTML = '<span class="icon">📍</span> <span class="btn-text-desktop">看我附近適合帶小孩的餐廳</span><span class="btn-text-mobile">找我附近適合小孩的餐廳</span>';
        }
    );
}

function selectLocation(loc, source = 'other') {
    state.searchLocation = loc;
    state.mapManuallyToggled = false;
    state.isInitialSearchScroll = true; // Mark that we are doing the initial search scroll
    toggleMap(true);
    state.showOthers = false; // Reset to only show High+Medium results on new search
    searchInput.value = loc.name;
    autocompleteDropdown.classList.add('hidden');
    clearSearchBtn.classList.remove('hidden');
    
    // GA4: search_location
    var selectedFiltersArr = [];
    state.filters.forEach(function(f) {
        selectedFiltersArr.push(filterMap[f] || f);
    });

    trackEvent('search_location', {
        location_query: loc.name === '我附近' ? 'nearby' : loc.name,
        search_source: source,
        selected_filters: selectedFiltersArr.join(',')
    });

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
            updateUrl();
            // Scroll to results
            searchResultsView.scrollIntoView({ behavior: 'smooth' });
            
            // Allow auto-collapse after scroll completes
            setTimeout(() => {
                state.isInitialSearchScroll = false;
            }, 1000);
        }, 100);
    } else {
        renderResults();
        updateUrl();
        searchResultsView.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
            state.isInitialSearchScroll = false;
        }, 1000);
    }
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
    const allKeys = ['high_chair_available', 'kids_menu', 'spacious_seating', 'kid_noise_tolerant'];

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
        level = 'Needs Attention'; // "不太符合條件"
    } else if (matchCount === state.filters.size && state.filters.size > 0) {
        level = 'High'; // "值得推薦"
    } else if (matchCount > 0 || (otherMatchCount > 0 && missCount === 0)) {
        level = 'Medium'; // "可以考慮"
    } else if (unknownCount === 4) {
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

        // Update Level Labels for this session
        levelLabels['Needs Attention'] = '不太符合條件';
        levelLabels['High'] = '值得推薦';
        levelLabels['Medium'] = '可以考慮';
        levelLabels['Insufficient Info'] = '資訊不足';

        const center = state.searchLocation;
        if (!center) return;

        // 1. Calculate distances
        let restaurants = restaurantData.map(res => ({
            ...res,
            distance: calculateDistance(center.lat, center.lng, res.latitude, res.longitude)
        }));

        // 2. Filter by distance
        const maxRadius = (center.type === '行政區') ? 2.5 : 1.5;
        let filtered = restaurants.filter(res => res.distance <= maxRadius);

        if (filtered.length === 0) {
            handleNoResults(center);
            return;
        }

        const resultsContainer = document.getElementById('search-results-view');
        resultsContainer.classList.remove('hidden');
        homeView.classList.add('search-active');

        // Apply new dynamic status to each restaurant for sorting/rendering
        const processed = filtered.map(res => {
            const status = getDynamicStatus(res, state.filters);
            return { ...res, dynamicLevel: status.level, dynamicStatus: status };
        });

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
        const recommended = sorted.filter(r => r.dynamicLevel === 'High' || r.dynamicLevel === 'Medium' || r.dynamicLevel === 'Low Match');
        const others = sorted.filter(r => r.dynamicLevel === 'Insufficient Info' || r.dynamicLevel === 'Needs Attention');

        state.currentResults = sorted; 

        recommended.forEach(res => renderCard(res, recommendedList, res.dynamicLevel));
        others.forEach(res => renderCard(res, othersList, res.dynamicLevel));
        
        // Update Toggle UI
        othersList.classList.toggle('hidden', !state.showOthers);
        toggleOthersBtn.classList.toggle('active', state.showOthers);
        toggleOthersBtn.querySelector('span').textContent = state.showOthers ? '收合額外選項' : '查看更多 (含資訊不足或不太符合條件)';
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
    const allKeys = ['high_chair_available', 'kids_menu', 'spacious_seating', 'kid_noise_tolerant'];
    
    let matchCount = 0;
    if (selectedFilters && selectedFilters.size > 0) {
        selectedFilters.forEach(f => {
            if (attrs[f] === 'yes') matchCount++;
        });
    }

    // 1. 不太符合條件 (Any selected filter is 'no')
    let hasNo = false;
    if (selectedFilters && selectedFilters.size > 0) {
        selectedFilters.forEach(f => {
            if (attrs[f] === 'no') hasNo = true;
        });
    }
    if (hasNo) return { level: 'Needs Attention', label: '不太符合條件', class: 'attention', matchCount: matchCount };

    // 2. 資訊不足 (All 4 are unknown/missing)
    const allUnknown = allKeys.every(k => !attrs[k] || attrs[k] === 'unknown');
    if (allUnknown) return { level: 'Insufficient Info', label: '資訊不足', class: 'info', matchCount: matchCount };

    // If user has selected filters
    if (selectedFilters && selectedFilters.size > 0) {
        // 值得推薦 (Perfect match of all selected filters)
        if (matchCount === selectedFilters.size) {
            return { level: 'High', label: '值得推薦', class: 'high', matchCount: matchCount };
        }
        
        // 可以考慮 (At least one match, and we already know there's no 'no')
        if (matchCount >= 1) {
            return { level: 'Medium', label: '可以考慮', class: 'medium', matchCount: matchCount };
        }

        // 其他友善選擇 (Zero matches, but something else is 'yes')
        let hasOtherYes = false;
        allKeys.forEach(k => {
            if (!selectedFilters.has(k) && attrs[k] === 'yes') hasOtherYes = true;
        });
        if (hasOtherYes) {
            return { level: 'Low Match', label: '其他友善選擇', class: 'low-match', matchCount: matchCount };
        }
        
        return { level: 'Insufficient Info', label: '資訊不足', class: 'info', matchCount: matchCount };
    }

    // Default view (no filters selected)
    let totalYes = 0;
    allKeys.forEach(k => { if (attrs[k] === 'yes') totalYes++; });
    if (totalYes >= 2) return { level: 'High', label: '值得推薦', class: 'high', matchCount: 0 };
    if (totalYes >= 1) return { level: 'Medium', label: '可以考慮', class: 'medium', matchCount: 0 };
    return { level: 'Insufficient Info', label: '資訊不足', class: 'info', matchCount: 0 };
}

function renderCard(res, container, overrideLevel) {
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

    const times = res.distance ? calculateTravelTimes(res.distance) : null;
    let timeHtml = '';
    if (times) {
        timeHtml = `
            <span class="card-footer-time">(🚶${times.walking}分鐘 · 🚗${times.driving}分鐘)</span>
        `;
    }

    const isFav = state.favorites.has(res.place_id);
    card.innerHTML = `
        <button class="card-favorite-btn ${isFav ? 'active' : ''}" data-place-id="${res.place_id}" title="${isFav ? '移出考慮清單' : '加入考慮清單'}">
            ${isFav ? '❤️' : '🤍'}
        </button>
        <div class="card-header-row">
            <div class="restaurant-name">${res.name}</div>
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
            <span class="card-rating">⭐ ${res.rating}</span>
            ${timeHtml}
            <span class="card-address">📍 ${fixSimplifiedAddress(res.address)}</span>
        </div>
    `;

    const favBtn = card.querySelector('.card-favorite-btn');
    if (favBtn) {
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(res.place_id, e);
        });
    }

    card.addEventListener('click', (e) => {
        console.log('Card clicked, jumping to map:', res.name);
        try {
            trackEvent('click_restaurant_card', {
                restaurant_name: res.name,
                source: 'list_card'
            });
        } catch (err) {}
        
        focusOnMap(e, res.place_id);
    });

    container.appendChild(card);
}

function focusOnMap(e, placeId) {
    e.stopPropagation();
    const res = restaurantData.find(r => r.place_id === placeId);
    if (res && state.map) {
        // If marker doesn't exist, it might be in 'others' and hidden.
        if (!state.markerMap[placeId]) {
            state.showOthers = true;
            renderResults();
        }

        // If the map is collapsed, expand it!
        const mapContainer = document.getElementById('map-container');
        let needsDelay = false;
        if (mapContainer && mapContainer.classList.contains('collapsed')) {
            toggleMap(true);
            state.mapManuallyToggled = false; // Restore auto-collapse behavior
            needsDelay = true;
        }

        const marker = state.markerMap[placeId];
        if (marker) {
            const focus = () => {
                state.map.setView([res.latitude, res.longitude], 17);
                marker.openPopup();
                // Scroll map into view if needed
                document.getElementById('map-container').scrollIntoView({ behavior: 'smooth' });
            };

            if (needsDelay) {
                // Wait for the container to start expanding so Leaflet can calculate dimensions correctly
                setTimeout(focus, 150);
            } else {
                focus();
            }
        }
    }
}

window.focusRestaurantOnMap = focusOnMap; // For backward compatibility if any

function showDetail(restaurant) {
    if (!restaurant) return;
    
    try {
        state.selectedRestaurant = restaurant;

        let tagsHtml = '';
        const attributes = restaurant.attributes || {};
        Object.keys(attributes).forEach(attr => {
            if (attributes[attr] === 'yes' && attributeLabels[attr]) {
                const isMatched = state.filters && state.filters.has(attr);
                if (isMatched) {
                    tagsHtml += `<span class="tag matched"><span>✓ ${attributeIcons[attr] || '✨'}</span> ${attributeLabels[attr]}</span>`;
                } else {
                    tagsHtml += `<span class="tag"><span>${attributeIcons[attr] || '✨'}</span> ${attributeLabels[attr]}</span>`;
                }
            }
        });

        if (!tagsHtml) {
            tagsHtml = '<div style="color: var(--text-muted); font-size: 0.9rem; font-style: italic;">未看到明確的親子友善資訊</div>';
        }

        let signalsHtml = '';
        /* 暫時隱藏判斷依據（原評論線索）區塊以避免合規爭議
        let signals = Array.isArray(restaurant.signals) ? restaurant.signals : (typeof restaurant.signals === 'string' ? [restaurant.signals] : []);
        if (signals.length > 0) {
            signalsHtml = `
                <div style="font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-muted);">判斷依據</div>
                <ul style="list-style: none; padding-left: 0; margin-bottom: 1.5rem;">
                    ${signals.map(s => `<li style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem;">● ${s}</li>`).join('')}
                </ul>
            `;
        }
        */

        const status = getDynamicStatus(restaurant, state.filters);
        const level = status.level;
        const displayLabel = status.label;
        const levelClass = status.class;
        
        // Calculate match count for detail view
        let matchCount = 0;
        const attributes_for_count = restaurant.attributes || {};
        if (state.filters && state.filters.size > 0) {
            state.filters.forEach(f => {
                if (attributes_for_count[f] === 'yes') matchCount++;
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
            } else if (summaryTags.startsWith('評論未提及')) {
                summaryTags = 'ℹ️ ' + summaryTags;
            }
        }

        let dist = restaurant.distance;
        if (dist === undefined && state.searchLocation && restaurant.latitude && restaurant.longitude) {
            dist = calculateDistance(state.searchLocation.lat, state.searchLocation.lng, restaurant.latitude, restaurant.longitude);
        }
        const times = dist ? calculateTravelTimes(dist) : null;
        let timeHtml = '';
        if (times) {
            const startLocName = state.searchLocation ? state.searchLocation.name : '';
            const startLocType = state.searchLocation ? state.searchLocation.type : '';
            const isNearby = startLocName === '我附近' || startLocType === '目前位置';
            
            let originLabel = '';
            if (isNearby) {
                originLabel = '目前位置';
            } else if (startLocType === '行政區') {
                originLabel = `「${startLocName}中心點」`;
            } else {
                originLabel = `「${startLocName}」`;
            }

            timeHtml = `
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                    <span style="background: #f1f5f9; padding: 0.25rem 0.6rem; border-radius: 2rem; font-size: 0.75rem; font-weight: 600; color: #475569;">🚶 從${originLabel}步行約 ${times.walking} 分鐘</span>
                    <span style="background: #f1f5f9; padding: 0.25rem 0.6rem; border-radius: 2rem; font-size: 0.75rem; font-weight: 600; color: #475569;">🚗 從${originLabel}開車約 ${times.driving} 分鐘</span>
                </div>
            `;
        }

        const isDetailFav = state.favorites.has(restaurant.place_id);
        detailContent.innerHTML = `
            <h1 style="margin-bottom: 0.5rem; color: var(--text-main);">${restaurant.name || '未命名餐廳'}</h1>
            <div class="restaurant-rating" style="font-size: 1.1rem; margin-bottom: 0.5rem;">⭐ ${restaurant.rating || 'N/A'}</div>
            <div class="restaurant-address" style="font-size: 0.9rem; margin-bottom: 0.85rem;">📍 ${fixSimplifiedAddress(restaurant.address || '')}</div>
            
            <button class="detail-favorite-btn ${isDetailFav ? 'active' : ''}" id="btn-detail-fav">
                ${isDetailFav ? '❤️ 已在考慮清單中' : '📋 加入考慮清單'}
            </button>

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
                <div class="ai-summary-title">親子用餐摘要（AI根據公開評論整理）</div>
                <div class="ai-summary-text">${restaurant.ai_summary || '目前尚無摘要資訊。'}</div>
            </div>
            ${signalsHtml}

            <button id="btn-open-google-maps" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 1.125rem;">
                在 Google 地圖中開啟
            </button>
        `;

        const detailFavBtn = document.getElementById('btn-detail-fav');
        if (detailFavBtn) {
            detailFavBtn.addEventListener('click', () => {
                toggleFavorite(restaurant.place_id);
                // Visual feedback is handled via global listeners, but we sync this btn immediately
                const isNowFav = state.favorites.has(restaurant.place_id);
                detailFavBtn.className = `detail-favorite-btn ${isNowFav ? 'active' : ''}`;
                detailFavBtn.innerHTML = isNowFav ? '❤️ 已在考慮清單中' : '📋 加入考慮清單';
            });
        }

        const gMapBtn = document.getElementById('btn-open-google-maps');
        if (gMapBtn) {
            gMapBtn.addEventListener('click', () => {
                const cleanAddr = fixSimplifiedAddress(restaurant.address || '');
                try {
                    trackEvent('open_google_maps', {
                        restaurant_name: restaurant.name,
                        location_context: state.searchLocation ? (state.searchLocation.name === '我附近' ? 'nearby' : state.searchLocation.name) : 'none'
                    });
                } catch (e) {}
                const query = encodeURIComponent((restaurant.name || '') + ' ' + cleanAddr);
                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
            });
        }

        switchView('detail');
        updateUrl();
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
            if (attributes[f] === 'yes') matchCount++;
        });
        return matchCount === 0;
    }
    return false;
}


function switchView(viewName) {
    state.view = viewName;
    if (viewName === 'home') {
        homeView.classList.add('active');
        detailView.classList.remove('active');
        window.scrollTo(0, 0);
        setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 100);
    } else {
        homeView.classList.remove('active');
        detailView.classList.add('active');
        window.scrollTo(0, 0);
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
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];
    state.markerMap = {};

    const colorMap = {
        'High': '#059669', '高': '#059669',
        'Medium': '#0284c7', '中': '#0284c7',
        'Needs Attention': '#dc2626', '需留意': '#dc2626',
        'Insufficient Info': '#94a3b8', '資訊不足': '#94a3b8',
        'Low Match': '#6366f1' // New purple for low matches
    };

    const bounds = [];
    const usedCoords = new Map(); // Track coordinates to prevent overlap
    
    // Add Search Center Marker
    if (state.searchLocation) {
        const coordKey = `${state.searchLocation.lat.toFixed(6)},${state.searchLocation.lng.toFixed(6)}`;
        usedCoords.set(coordKey, 1);
        
        // Use a prominent blue pin for the search center
        const centerIcon = L.divIcon({
            html: `<div class="search-center-marker-inner" style="background-color: #3b82f6; width: 16px; height: 16px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 15px rgba(59, 130, 246, 0.6); position: relative;">
                     <div style="position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 11px solid #3b82f6;"></div>
                   </div>`,
            className: 'search-center-marker-outer',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const centerMarker = L.marker([state.searchLocation.lat, state.searchLocation.lng], {
            icon: centerIcon,
            interactive: true
        }).addTo(state.map);
        
        const isCurrent = state.searchLocation.type === '目前位置' || state.searchLocation.name === '我附近';
        const popupContent = `
            <div class="map-popup-compact" style="text-align: center; padding: 4px; min-width: 140px;">
                <div style="font-size: 1.25rem; margin-bottom: 4px;">${isCurrent ? '📍' : '🔍'}</div>
                <strong style="color: var(--primary); font-size: 0.9rem; display: block; margin-bottom: 4px;">
                    ${isCurrent ? '您的目前位置' : '您搜尋的位置'}
                </strong>
                <div style="font-size: 0.8rem; color: var(--text-main); font-weight: 600; word-break: break-all;">
                    ${state.searchLocation.name}
                </div>
            </div>
        `;
        centerMarker.bindPopup(popupContent);
        state.markers.push(centerMarker);
        bounds.push([state.searchLocation.lat, state.searchLocation.lng]);
    }

    restaurants.forEach(res => {
        if (res.latitude && res.longitude) {
            let markerLat = res.latitude;
            let markerLng = res.longitude;

            // Jitter logic: if coords match exactly, add a tiny offset
            const coordKey = `${res.latitude.toFixed(6)},${res.longitude.toFixed(6)}`;
            if (usedCoords.has(coordKey)) {
                const count = usedCoords.get(coordKey);
                usedCoords.set(coordKey, count + 1);
                
                // Add tiny offset (approx 20-25 meters) in a circular pattern
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

            // Skip if user wants to hide low quality markers
            if (state.hideLowQualityMarkers && isLowQuality) return;

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

            const marker = L.marker([markerLat, markerLng], {
                icon: pinIcon
            }).addTo(state.map);
            
            const times = calculateTravelTimes(res.distance);
            const timeInfo = times ? `<div class="map-popup-time">🚶${times.walking}分 | 🚗${times.driving}分</div>` : '';

            marker.bindPopup(`<div class="map-popup-compact">
                <div class="map-popup-title-row">
                    <span class="map-popup-name">${res.name}</span>
                    <span class="map-popup-rating">⭐${res.rating}</span>
                </div>
                <div class="map-popup-meta-row">
                    <span class="map-popup-level-tag" style="background: ${color}">${status.label}</span>
                    ${times ? `<span class="map-popup-time-mini">🚶${times.walking}分鐘 · 🚗${times.driving}分鐘</span>` : ''}
                </div>
                <button class="map-popup-action" onclick="showDetailFromMap('${res.place_id}')">查看詳情</button>
            </div>`, { 
                maxWidth: 240,
                autoPanPadding: L.point(20, 20)
            });

            marker.on('click', () => {
                trackEvent('click_map_restaurant', {
                    restaurant_name: res.name,
                    recommendation_level: levelLabels[res.parent_friendly_level] || res.parent_friendly_level,
                    location_context: state.searchLocation ? (state.searchLocation.name === '我附近' ? 'nearby' : state.searchLocation.name) : 'none'
                });
            });

            state.markers.push(marker);
            state.markerMap[res.place_id] = marker;
            bounds.push([res.latitude, res.longitude]);
        }
    });

    if (bounds.length > 0) {
        state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (state.searchLocation) {
        state.map.setView([state.searchLocation.lat, state.searchLocation.lng], 15);
    }
}

window.showDetailFromMap = (id) => {
    // Priority: find in current dynamic results first to get personalized level
    const res = state.currentResults.find(r => r.place_id === id) || restaurantData.find(r => r.place_id === id);
    if (res) {
        const level = res.dynamicLevel || res.parent_friendly_level;
        trackEvent('view_restaurant_detail', {
            restaurant_name: res.name,
            source: 'map_card',
            recommendation_level: levelLabels[level] || level,
            location_context: state.searchLocation ? (state.searchLocation.name === '我附近' ? 'nearby' : state.searchLocation.name) : 'none'
        });
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
    }
    state.filters.forEach(f => params.append('f', f));
    if (state.view === 'detail' && state.selectedRestaurant) {
        params.set('r', state.selectedRestaurant.place_id);
    }
    
    // 保持 favorites 在網址中，讓「在瀏覽器中開啟」能順利傳遞考慮清單
    if (state.favorites && state.favorites.size > 0) {
        params.set('favs', Array.from(state.favorites).join(','));
    }
    
    const queryString = params.toString();
    return window.location.origin + window.location.pathname + (queryString ? '?' + queryString : '');
}

function updateUrl() {
    const newUrl = getShareUrl();
    window.history.replaceState({}, '', newUrl);
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    
    // 檢查是否有分享的考慮清單
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
            const sessionKey = 'shortlist_auto_opened_' + favsParam;
            if (!sessionStorage.getItem(sessionKey)) {
                sessionStorage.setItem(sessionKey, 'true');
                
                // 自動開啟考慮清單抽屜，讓使用者立即看到分享的項目
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

    const locName = params.get('loc');
    const lat = params.get('lat');
    const lng = params.get('lng');
    
    // 優先檢查經緯度（分享的位置或「我附近」）
    if (lat && lng) {
        console.log('Detected shared location:', lat, lng);
        
        // 嘗試在已知的地點資料中比對以還原正確的 type (例如「行政區」或「捷運站」)
        let matchedType = '分享位置';
        if (locName && state.locationData && state.locationData.length > 0) {
            const matchedLoc = state.locationData.find(l => l.name === locName);
            if (matchedLoc) {
                matchedType = matchedLoc.type;
            }
        }

        const loc = {
            name: locName || '分享的位置',
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            type: matchedType
        };
        
        // 確保在所有初始化完成後執行
        if (document.readyState === 'complete') {
            selectLocation(loc);
        } else {
            window.addEventListener('load', () => selectLocation(loc));
        }
    } else if (locName && state.locationData.length > 0) {
        const loc = state.locationData.find(l => l.name === locName);
        if (loc) selectLocation(loc);
    }
    
    params.getAll('f').forEach(f => {
        state.filters.add(f);
        const chip = document.querySelector(`.filter-chip[data-filter="${f}"]`);
        if (chip) chip.classList.add('active');
    });

    const resId = params.get('r');
    if (resId && typeof restaurantData !== 'undefined') {
        const res = restaurantData.find(r => r.place_id === resId);
        if (res) {
            trackEvent('view_restaurant_detail', {
                restaurant_name: res.name,
                source: 'direct_link',
                recommendation_level: levelLabels[res.parent_friendly_level] || res.parent_friendly_level,
                location_context: 'none'
            });
            showDetail(res);
        }
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
    return addr
        .replace(/东路/g, '東路')
        .replace(/信义/g, '信義')
        .replace(/万华/g, '萬華')
        .replace(/区/g, '區')
        .replace(/号/g, '號')
        .replace(/楼/g, '樓')
        .replace(/湾/g, '灣')
        .replace(/台/g, '臺')
        .replace(/国/g, '國')
        .replace(/学/g, '學')
        .replace(/发/g, '發')
        .replace(/电/g, '電')
        .replace(/复/g, '復')
        .replace(/关/g, '關')
        .replace(/园/g, '園');
}

function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.zIndex = "9999"; // Ensure it's on top
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Shortlist & Favorite Helpers
function loadFavorites() {
    try {
        const stored = localStorage.getItem('taipei_kids_restaurants_favorites');
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
        localStorage.setItem('taipei_kids_restaurants_favorites', JSON.stringify(arr));
    } catch (e) {
        console.error('Failed to save favorites', e);
    }
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
}

function toggleFavorite(placeId, event) {
    const isNowFav = !state.favorites.has(placeId);
    
    // Find restaurant name for logging
    const res = restaurantData.find(r => r.place_id === placeId);
    const resName = res ? res.name : '';

    if (isNowFav) {
        state.favorites.add(placeId);
        showToast(`已將「${resName}」加入考慮清單`);
        trackEvent('add_to_shortlist', { restaurant_name: resName });
    } else {
        state.favorites.delete(placeId);
        showToast(`已將「${resName}」移出考慮清單`);
        trackEvent('remove_from_shortlist', { restaurant_name: resName });
    }

    saveFavorites();
    updateShortlistUI();

    // 1. Sync card buttons across the app
    document.querySelectorAll(`.card-favorite-btn[data-place-id="${placeId}"]`).forEach(btn => {
        btn.classList.toggle('active', isNowFav);
        btn.innerHTML = isNowFav ? '❤️' : '🤍';
        btn.title = isNowFav ? '移出考慮清單' : '加入考慮清單';
    });

    // 2. Sync detail view button if open
    const detailFavBtn = document.getElementById('btn-detail-fav');
    if (detailFavBtn && detailFavBtn.dataset.placeId === placeId) {
        detailFavBtn.classList.toggle('active', isNowFav);
        detailFavBtn.innerHTML = isNowFav ? '❤️ 已在考慮清單中' : '📋 加入考慮清單';
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
                <span class="drawer-empty-icon">📋</span>
                <h3>你的考慮清單還是空的</h3>
                <p>在餐廳卡片或詳情頁面中點擊「加入考慮」，即可在此比對與挑選心儀的餐廳！</p>
            </div>
        `;
        listView.innerHTML = emptyHtml;
        compareView.innerHTML = emptyHtml;
        return;
    }

    // Get selected restaurant data objects
    const savedRestaurants = Array.from(state.favorites)
        .map(id => {
            const res = restaurantData.find(r => r.place_id === id);
            if (!res) return null;
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
            if (attrs.high_chair_available === 'yes') ams.push('🪑兒童椅');
            if (attrs.kids_menu === 'yes') ams.push('🥘兒童餐');
            if (attrs.spacious_seating === 'yes') ams.push('🛋️空間寬敞');
            if (attrs.kid_noise_tolerant === 'yes') ams.push('🥳不怕吵');
            const amsText = ams.length > 0 ? ams.join(' · ') : '暫無特徵標籤';

            listHtml += `
                <div class="shortlist-card" style="cursor: pointer;" onclick="window.showDetailFromMap('${res.place_id}')">
                    <div class="shortlist-info">
                        <div class="shortlist-name-row">
                            <span class="shortlist-name">${res.name}</span>
                            <span class="match-rate-badge-small">${res.rating} ⭐</span>
                        </div>
                        <div class="shortlist-summary">${res.card_summary || res.ai_summary || '無摘要'}</div>
                        <div class="shortlist-amenities">${amsText}</div>
                    </div>
                    <button class="shortlist-del-btn" data-place-id="${res.place_id}" title="移出清單">🗑️</button>
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
                            <th>評分</th>
                            <th>兒童椅</th>
                            <th>空間寬敞</th>
                            <th>不怕吵</th>
                            <th>兒童餐</th>
                            <th>車程/步行</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        savedRestaurants.forEach(res => {
            const attrs = res.attributes || {};
            
            const checkIcon = '<span class="check-icon">✓ 有</span>';
            const crossIcon = '<span class="cross-icon">✗ 較小</span>';
            const crossGeneralIcon = '<span class="cross-icon">✗ 無</span>';
            const unknownIcon = '<span class="unknown-icon">? 未知</span>';

            const chair = attrs.high_chair_available === 'yes' ? checkIcon : (attrs.high_chair_available === 'no' ? crossGeneralIcon : unknownIcon);
            const spacious = attrs.spacious_seating === 'yes' ? checkIcon : (attrs.spacious_seating === 'no' ? crossIcon : unknownIcon);
            const noise = attrs.kid_noise_tolerant === 'yes' ? checkIcon : (attrs.kid_noise_tolerant === 'no' ? crossGeneralIcon : unknownIcon);
            const menu = attrs.kids_menu === 'yes' ? checkIcon : (attrs.kids_menu === 'no' ? crossGeneralIcon : unknownIcon);

            const times = res.distance ? calculateTravelTimes(res.distance) : null;
            const travelText = times ? `🚗${times.driving}分 / 🚶${times.walking}分` : '未定位';

            tableHtml += `
                <tr>
                    <td>
                        <div class="comparison-table-name-cell">
                            <a href="#" onclick="window.showDetailFromMap('${res.place_id}'); return false;">${res.name}</a>
                        </div>
                    </td>
                    <td style="font-weight: 700; color: var(--primary);">${res.rating} ⭐</td>
                    <td>${chair}</td>
                    <td>${spacious}</td>
                    <td>${noise}</td>
                    <td>${menu}</td>
                    <td style="color: var(--text-muted); font-weight: 600;">${travelText}</td>
                    <td>
                        <span class="comparison-table-del" data-place-id="${res.place_id}">刪除</span>
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
}

// Start the app
init();
