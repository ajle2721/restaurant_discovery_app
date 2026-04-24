// State Management
const state = {
    filters: new Set(),
    locations: new Set(), // Empty means "全區"
    selectedRestaurant: null,
    view: 'home',
    map: null,
    markers: [],
    userMarker: null,
    userCircle: null,
    userLocation: null, // {lat, lng}
    showLowLevel: false,
    lastFilteredResults: []
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
    kid_noise_tolerant: '不怕小孩吵'
};

// DOM Elements
const restaurantList = document.getElementById('restaurant-list');
const homeView = document.getElementById('home-view');
const detailView = document.getElementById('detail-view');
const detailContent = document.getElementById('detail-content');
const backHomeBtn = document.getElementById('back-home');
const floatShareBtn = document.getElementById('float-share');
const detailShareBtn = document.getElementById('share-detail');
const shareResultsBtn = document.getElementById('share-results');
const toast = document.getElementById('toast');
const locationText = document.getElementById('location-text');
const resultsCount = document.getElementById('results-count');
const btnNearby = document.getElementById('btn-nearby');
const btnShowLow = document.getElementById('btn-show-low');
const btnHideLow = document.getElementById('btn-hide-low');
const moreOptionsContainer = document.getElementById('more-options-container');

// Modal Elements
const openLocationModalBtn = document.getElementById('open-location-modal');
const locationModal = document.getElementById('location-modal');
const closeLocationModalBtn = document.getElementById('close-location-modal');
const confirmLocationBtn = document.getElementById('confirm-location');
const locAllBtn = document.getElementById('loc-all');
const locChips = document.querySelectorAll('.loc-chip');

// Initialization
function init() {
    initMap();
    checkUrlParams();
    renderList();
    setupEventListeners();
}

function setupEventListeners() {
    // Quick Filter Chips
    document.querySelectorAll('.quick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const filterAttr = chip.dataset.filter;
            toggleFilter(filterAttr);
            chip.classList.toggle('active', state.filters.has(filterAttr));
        });
    });

    // Main Filter Chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const filterAttr = chip.dataset.filter;
            toggleFilter(filterAttr);
        });
    });

    // Nearby Button
    if (btnNearby) {
        btnNearby.addEventListener('click', () => {
            handleGeolocation();
            btnNearby.innerHTML = '<span class="loader"></span> 定位中...';
        });
    }
    
    // Show Low Button
    if (btnShowLow) {
        btnShowLow.addEventListener('click', () => {
            state.showLowLevel = true;
            renderList();
        });
    }

    // Hide Low Button
    if (btnHideLow) {
        btnHideLow.addEventListener('click', () => {
            state.showLowLevel = false;
            renderList();
            if (resultsCount) {
                resultsCount.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    // Location Modal Events
    if (openLocationModalBtn) {
        openLocationModalBtn.addEventListener('click', () => {
            locationModal.classList.add('active');
        });
    }

    const closeModal = () => {
        locationModal.classList.remove('active');
        updateLocationText();
        renderList();
        updateUrl();
    };

    if (closeLocationModalBtn) closeLocationModalBtn.addEventListener('click', closeModal);
    if (confirmLocationBtn) confirmLocationBtn.addEventListener('click', closeModal);
    if (locationModal) {
        locationModal.addEventListener('click', (e) => {
            if (e.target === locationModal) closeModal();
        });
    }

    // Location Selection Logic
    if (locAllBtn) {
        locAllBtn.addEventListener('click', () => {
            state.locations.clear();
            clearUserLocation();
            updateModalUI();
        });
    }

    locChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const loc = chip.dataset.loc;
            if (state.locations.has(loc)) {
                state.locations.delete(loc);
            } else {
                state.locations.add(loc);
            }
            clearUserLocation();
            updateModalUI();
        });
    });

    // Navigation
    backHomeBtn.addEventListener('click', () => switchView('home'));

    // Filter Toggle
    const collapseBtn = document.getElementById('collapse-filters');
    const expandBtn = document.getElementById('expand-filters');
    const filterExpanded = document.getElementById('filter-expanded');
    const filterCollapsed = document.getElementById('filter-collapsed');

    if (collapseBtn && expandBtn) {
        collapseBtn.addEventListener('click', () => {
            filterExpanded.classList.add('hidden');
            filterCollapsed.classList.remove('hidden');
        });
        expandBtn.addEventListener('click', () => {
            filterExpanded.classList.remove('hidden');
            filterCollapsed.classList.add('hidden');
        });
    }

    // Sharing
    floatShareBtn.addEventListener('click', shareCurrentFilters);
    if (shareResultsBtn) shareResultsBtn.addEventListener('click', shareCurrentFilters);
    detailShareBtn.addEventListener('click', () => {
        if (state.selectedRestaurant) {
            shareRestaurant(state.selectedRestaurant);
        }
    });
}

function toggleFilter(filterAttr) {
    if (state.filters.has(filterAttr)) {
        state.filters.delete(filterAttr);
    } else {
        state.filters.add(filterAttr);
    }
    
    // Sync all chip styles
    document.querySelectorAll(`[data-filter="${filterAttr}"]`).forEach(el => {
        el.classList.toggle('active', state.filters.has(filterAttr));
    });
    
    renderList();
    updateUrl();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function formatDistance(km) {
    if (km === Infinity) return '';
    if (km < 1) return (km * 1000).toFixed(0) + 'm';
    return km.toFixed(1) + 'km';
}

function renderList() {
    restaurantList.innerHTML = '';
    resultsCount.style.display = 'block';

    const selectedFilters = Array.from(state.filters);

    // 1. Calculate distances if user location exists
    let dataWithDistance = restaurantData.map(res => {
        let dist = Infinity;
        if (state.userLocation && res.latitude && res.longitude) {
            dist = calculateDistance(state.userLocation.lat, state.userLocation.lng, res.latitude, res.longitude);
        }
        return { ...res, distance: dist };
    });

    // 2. Filter out based on global exclusions and initial filtering
    let eligibleData = dataWithDistance.filter(res => {
        // District filter
        if (state.locations.size > 0) {
            const hasMatch = Array.from(state.locations).some(loc => res.address.includes(loc));
            if (!hasMatch) return false;
        }

        // Distance filter (only show restaurants within 3km if nearby is active)
        if (state.userLocation && res.distance > 3) {
            return false;
        }

        // Exclude: ALL tags are Unknown (no information at all) -> Wait, we want to allow them if showLowLevel is true
        // But for explicit filters:
        const meetsFilters = selectedFilters.every(f => res.attributes[f] === 'yes');
        if (selectedFilters.length > 0 && !meetsFilters) return false;

        return true;
    });

    // Sort by distance (nearest first), or if no distance, just by parent_friendly_score desc
    eligibleData.sort((a, b) => {
        if (state.userLocation) {
            return a.distance - b.distance;
        }
        return (b.parent_friendly_score || 0) - (a.parent_friendly_score || 0);
    });

    // Group into Primary (高+中) and Secondary (資訊不足)
    const primaryData = eligibleData.filter(r => r.parent_friendly_level === '高' || r.parent_friendly_level === '中');
    const secondaryData = eligibleData.filter(r => r.parent_friendly_level === '資訊不足');

    if (primaryData.length === 0 && secondaryData.length === 0) {
        renderEmptyState();
        resultsCount.innerHTML = `
            <div style="background: var(--card-bg); padding: 1rem; border-radius: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 0.5rem; font-weight: 600; line-height: 1.6;">
                <div style="display: flex; align-items: center;"><div style="display:flex; align-items:center; margin-right:0.5rem;"><span style="display:inline-block; width:10px; height:10px; background:#4FB3AA; border-radius:50%; border: 1.5px solid var(--card-bg); z-index: 2;"></span><span style="display:inline-block; width:10px; height:10px; background:#FFB347; border-radius:50%; margin-left:-4px; border: 1.5px solid var(--card-bg); z-index: 1;"></span></div>適合帶小孩：0 間</div>
                <div><span style="display:inline-block; width:10px; height:10px; background:#CBD5E1; border-radius:50%; margin-right:0.5rem;"></span>其他選項：0 間</div>
            </div>
        `;
        moreOptionsContainer.style.display = 'none';
        renderMap([]);
        return;
    }

    // Fallback logic
    let fallbackTriggered = false;
    if (state.userLocation && primaryData.length < 5 && secondaryData.length > 0 && !state.showLowLevel) {
        fallbackTriggered = true;
    }

    resultsCount.innerHTML = `
        <div style="background: var(--card-bg); padding: 1rem; border-radius: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 0.5rem; font-weight: 600; line-height: 1.6;">
            <div style="display: flex; align-items: center;"><div style="display:flex; align-items:center; margin-right:0.5rem;"><span style="display:inline-block; width:10px; height:10px; background:#4FB3AA; border-radius:50%; border: 1.5px solid var(--card-bg); z-index: 2;"></span><span style="display:inline-block; width:10px; height:10px; background:#FFB347; border-radius:50%; margin-left:-4px; border: 1.5px solid var(--card-bg); z-index: 1;"></span></div>適合帶小孩：${primaryData.length} 間</div>
            <div><span style="display:inline-block; width:10px; height:10px; background:#CBD5E1; border-radius:50%; margin-right:0.5rem;"></span>其他選項：${secondaryData.length} 間</div>
        </div>
    `;

    // Render Primary Data
    if (primaryData.length > 0) {
        primaryData.forEach(res => renderCard(res));
    } else if (!state.showLowLevel && secondaryData.length > 0) {
        const helper = document.createElement('div');
        helper.className = 'results-section-helper';
        helper.textContent = '附近的高評價選擇較少，您可以展開查看其他選項👇';
        helper.style.textAlign = 'center';
        helper.style.marginTop = '2rem';
        restaurantList.appendChild(helper);
    }

    // Render Secondary Data if flag is true
    if (state.showLowLevel) {
        if (secondaryData.length > 0) {
            const header = document.createElement('div');
            header.className = 'results-section-header';
            header.textContent = '其他選項 (資訊較少)';
            restaurantList.appendChild(header);

            secondaryData.forEach(res => renderCard(res));
            
            moreOptionsContainer.style.display = 'block';
            if (btnShowLow) btnShowLow.style.display = 'none';
            if (btnHideLow) btnHideLow.style.display = 'block';
        } else {
            moreOptionsContainer.style.display = 'none';
        }
    } else {
        if (secondaryData.length > 0) {
            moreOptionsContainer.style.display = 'block';
            if (btnShowLow) btnShowLow.style.display = 'flex';
            if (btnHideLow) btnHideLow.style.display = 'none';
            
            if (fallbackTriggered) {
                btnShowLow.innerHTML = `<div style="font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--text-muted); font-weight: 500;">附近選擇較少，還有 ${secondaryData.length} 間餐廳可參考（資訊較少）</div><div style="font-size: 1rem; font-weight: 700;">顯示全部餐廳</div>`;
                btnShowLow.style.borderColor = 'var(--primary)';
                btnShowLow.style.color = 'var(--primary)';
                btnShowLow.style.padding = '0.75rem';
                btnShowLow.style.flexDirection = 'column';
            } else {
                btnShowLow.innerHTML = `<div style="font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--text-muted); font-weight: 500;">還有 ${secondaryData.length} 間餐廳可參考（資訊較少）</div><div style="font-size: 1rem; font-weight: 700;">顯示全部餐廳</div>`;
                btnShowLow.style.borderColor = '#CBD5E1';
                btnShowLow.style.color = 'var(--text-muted)';
                btnShowLow.style.padding = '0.75rem';
                btnShowLow.style.flexDirection = 'column';
            }
        } else {
            moreOptionsContainer.style.display = 'none';
        }
    }

    updateFilterSummary(eligibleData.length);
    
    // Store results for map persistence
    state.lastFilteredResults = state.showLowLevel ? eligibleData : primaryData;
    renderMap(state.lastFilteredResults);
}

function updateFilterSummary(totalCount) {
    const summaryDistrict = document.getElementById('summary-district');
    const summaryFilters = document.getElementById('summary-filters');
    const summaryCount = document.getElementById('summary-count');

    if (!summaryDistrict || !summaryFilters || !summaryCount) return;

    if (state.locations.size === 0) {
        summaryDistrict.textContent = state.userLocation ? '我的附近' : '台北市全區';
    } else {
        summaryDistrict.textContent = Array.from(state.locations).join('、');
    }

    if (state.filters.size === 0) {
        summaryFilters.textContent = '全部';
    } else {
        const labels = Array.from(state.filters).map(f => attributeLabels[f]);
        summaryFilters.textContent = labels.join('、');
    }

    summaryCount.textContent = totalCount;
}

function renderCard(res) {
    const card = document.createElement('div');
    card.className = 'restaurant-card';

    let distHtml = '';
    if (res.distance && res.distance !== Infinity) {
        distHtml = `<span class="distance-badge">🚶 ${formatDistance(res.distance)}</span>`;
    }

    const level = res.parent_friendly_level || '資訊不足';
    const levelClass = level === '高' ? 'level-high' : (level === '中' ? 'level-mid' : 'level-low');
    
    let positiveAttributes = [];
    Object.keys(res.attributes || {}).forEach(attr => {
        if (res.attributes[attr] === 'yes' && attributeLabels[attr]) {
            positiveAttributes.push(attributeLabels[attr]);
        }
    });
    const reasonText = positiveAttributes.length > 0 ? positiveAttributes.join('、') : '目前缺乏明確的親子友善資訊';

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="restaurant-name">${res.name}</div>
            ${distHtml}
        </div>
        <div class="restaurant-rating" style="margin-bottom: 0.75rem;">⭐ ${res.rating}</div>
        
        <div class="decision-reason">
            <span class="level-badge ${levelClass}">${level}</span>
            <span class="reason-text">${reasonText}</span>
        </div>
        
        <div class="restaurant-address">📍 ${res.address}</div>
    `;

    card.addEventListener('click', () => showDetail(res));
    restaurantList.appendChild(card);
}

function renderEmptyState() {
    restaurantList.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">🔍</span>
            <h3>哎呀！找不到了</h3>
            <p>目前沒有餐廳完全符合這些標籤，<br>試試減少一些條件吧！</p>
            <button class="btn btn-primary" style="margin-top: 1.5rem;" onclick="clearFilters()">清除所有篩選</button>
        </div>
    `;
}

function updateModalUI() {
    if (state.locations.size === 0) {
        locAllBtn.classList.add('active');
        locChips.forEach(c => c.classList.remove('active'));
    } else {
        locAllBtn.classList.remove('active');
        locChips.forEach(c => {
            if (state.locations.has(c.dataset.loc)) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
    }
}

function updateLocationText() {
    if (!locationText) return;
    
    if (state.locations.size === 0) {
        locationText.textContent = state.userLocation ? '我的附近' : '台北市 · 全區';
    } else if (state.locations.size === 1) {
        locationText.textContent = Array.from(state.locations)[0];
    } else if (state.locations.size === 2) {
        locationText.textContent = Array.from(state.locations).join('、');
    } else {
        const first = Array.from(state.locations)[0];
        locationText.textContent = `${first}等 ${state.locations.size} 區`;
    }
}

function clearUserLocation() {
    state.userLocation = null;
    if (state.userMarker && state.map) {
        state.map.removeLayer(state.userMarker);
        state.userMarker = null;
    }
    if (btnNearby) {
        btnNearby.innerHTML = '<span style="font-size: 1.25rem;">📍</span> 看我附近的餐廳';
        btnNearby.style.backgroundColor = '';
        btnNearby.style.color = '';
        btnNearby.disabled = false;
    }
}

window.clearFilters = () => {
    state.filters.clear();
    state.locations.clear();
    clearUserLocation();
    updateModalUI();
    updateLocationText();
    document.querySelectorAll('.filter-chip, .quick-chip').forEach(c => c.classList.remove('active'));
    renderList();
    updateUrl();
};

function showDetail(restaurant) {
    state.selectedRestaurant = restaurant;

    let tagsHtml = '';
    Object.keys(restaurant.attributes || {}).forEach(attr => {
        if (restaurant.attributes[attr] === 'yes' && attributeLabels[attr]) {
            tagsHtml += `<span class="tag" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;"><span>${attributeIcons[attr]}</span> ${attributeLabels[attr]}</span>`;
        }
    });

    let signalsHtml = '';
    let signals = Array.isArray(restaurant.signals) ? restaurant.signals : (typeof restaurant.signals === 'string' ? [restaurant.signals] : []);
    if (signals.length > 0) {
        signalsHtml = `
            <div style="font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-muted);">評論線索（來自最多5則評論）</div>
            <ul style="list-style: none; padding-left: 0; margin-bottom: 1.5rem;">
                ${signals.map(s => `<li style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem;">● ${s}</li>`).join('')}
            </ul>
        `;
    }

    const level = restaurant.parent_friendly_level || '資訊不足';
    const levelClass = level === '高' ? 'level-high' : (level === '中' ? 'level-mid' : 'level-low');

    detailContent.innerHTML = `
        <h1 style="margin-bottom: 0.5rem; color: var(--text-main);">${restaurant.name}</h1>
        <div class="restaurant-rating" style="font-size: 1.1rem; margin-bottom: 0.5rem;">⭐ ${restaurant.rating}</div>
        <div class="restaurant-address" style="font-size: 0.9rem; margin-bottom: 1.5rem;">📍 ${restaurant.address}</div>
        
        <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">親子友善評價</div>
        <div class="decision-reason" style="margin-bottom: 1.5rem; font-size: 1.1rem;">
            <span class="level-badge ${levelClass}" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;">${level}</span>
        </div>
        
        <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">符合項目</div>
        <div class="tag-container" style="gap: 0.75rem; margin-bottom: 1.5rem;">
            ${tagsHtml}
        </div>

        <div class="ai-summary" style="margin-bottom: 1.5rem;">
            <div class="ai-summary-title">
                AI整理的親子用餐資訊
                <span class="info-icon" onclick="toggleDisclaimer(event)">ⓘ</span>
            </div>
            <div class="disclaimer-expandable" id="ai-disclaimer">
                本資訊由系統根據評論自動整理（每間約 5 則），可能與實際情況略有差異，建議搭配現場資訊判斷。
            </div>
            <div class="ai-summary-text">${restaurant.ai_summary}</div>
        </div>

        ${signalsHtml}

        <button class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 1.125rem; font-size: 1rem;" onclick="window.open('${getGoogleMapsUrl(restaurant)}', '_blank')">
            在 Google 地圖中開啟
        </button>
    `;

    switchView('detail');
    updateUrl();
}

function switchView(viewName) {
    state.view = viewName;
    if (viewName === 'home') {
        homeView.classList.add('active');
        detailView.classList.remove('active');
        window.scrollTo(0, 0);
        
        // Fix Leaflet sizing issue when returning
        setTimeout(() => {
            if (state.map) state.map.invalidateSize();
        }, 100);
    } else {
        homeView.classList.remove('active');
        detailView.classList.add('active');
        window.scrollTo(0, 0);
    }
}

function updateUrl() {
    const params = new URLSearchParams();

    // Use specific params
    state.filters.forEach(attr => {
        params.set(attr, '1');
    });

    if (state.locations.size > 0) {
        params.set('loc', Array.from(state.locations).join(','));
    }

    if (state.view === 'detail' && state.selectedRestaurant) {
        params.set('r', state.selectedRestaurant.name);
    }

    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);

    // Check for specific attribute params
    Object.keys(attributeLabels).forEach(attr => {
        if (params.get(attr) === '1') {
            state.filters.add(attr);
            document.querySelectorAll(`[data-filter="${attr}"]`).forEach(el => el.classList.add('active'));
        }
    });

    // Support location param
    const locParam = params.get('loc');
    if (locParam) {
        locParam.split(',').forEach(loc => {
            if (loc) state.locations.add(loc.trim());
        });
        updateModalUI();
        updateLocationText();
    }

    const restaurantParam = params.get('r');
    if (restaurantParam) {
        const res = restaurantData.find(r => r.name === restaurantParam);
        if (res) showDetail(res);
    }
}

function shareCurrentFilters() {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({
            title: '小手找食 - 台北親子餐廳建議',
            text: '這是一些適合帶孩子去的餐廳清單，給你參考！',
            url: url
        }).catch(() => copyToClipboard(url));
    } else {
        copyToClipboard(url);
    }
}

function shareRestaurant(res) {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({
            title: `${res.name} - 小手找食建議`,
            text: `這家餐廳評價不錯，環境對孩子很友善，推薦給你！`,
            url: url
        }).catch(() => copyToClipboard(url));
    } else {
        copyToClipboard(url);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('連結已複製到剪貼簿！');
    });
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function toggleDisclaimer(e) {
    e.stopPropagation();
    const disclaimer = document.getElementById('ai-disclaimer');
    if (disclaimer) {
        disclaimer.classList.toggle('active');
    }
}

function getGoogleMapsUrl(restaurant) {
    if (restaurant.google_maps_url) return restaurant.google_maps_url;
    const query = encodeURIComponent(restaurant.name + ' ' + restaurant.address);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// Map Functions
function initMap() {
    if (state.map) return;
    
    // Initialize map centered on Taipei
    state.map = L.map('map').setView([25.0330, 121.5654], 13);
    
    // Use Google-like tiles (Voyager is a good clean alternative)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(state.map);
}

function renderMap(restaurants) {
    if (!state.map) return;

    // Clear existing markers
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];
    
    if (state.userCircle) {
        state.map.removeLayer(state.userCircle);
        state.userCircle = null;
    }

    const markersToFit = [];

    restaurants.forEach(res => {
        if (res.latitude && res.longitude) {
            // High=Green, Mid=Yellow, Low=Gray
            let color = '#CBD5E1'; // Default Low
            if (res.parent_friendly_level === '高') color = '#4FB3AA';
            if (res.parent_friendly_level === '中') color = '#FFB347';
            
            const marker = createMarker(res, color);
            marker.addTo(state.map);
            state.markers.push(marker);
            markersToFit.push([res.latitude, res.longitude]);
        }
    });

    if (state.userLocation) {
        markersToFit.push([state.userLocation.lat, state.userLocation.lng]);
        state.userCircle = L.circle([state.userLocation.lat, state.userLocation.lng], {
            radius: 3000,
            color: '#4285F4',
            fillColor: '#4285F4',
            fillOpacity: 0.1,
            weight: 1
        }).addTo(state.map);
    }

    // Auto-fit bounds
    if (state.userLocation && state.userCircle) {
        state.map.fitBounds(state.userCircle.getBounds(), { padding: [10, 10] });
    } else if (markersToFit.length > 0) {
        state.map.fitBounds(markersToFit, { padding: [30, 30], maxZoom: 16 });
    }
}

function createMarker(res, color) {
    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const marker = L.marker([res.latitude, res.longitude], { icon: icon });

    // Popup Content
    const popupContent = document.createElement('div');
    popupContent.className = 'map-popup-card';
    
    const levelClass = res.parent_friendly_level === '高' ? 'level-high' : (res.parent_friendly_level === '中' ? 'level-mid' : 'level-low');

    popupContent.innerHTML = `
        <div class="map-popup-title">${res.name}</div>
        <div style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <span class="level-badge ${levelClass}" style="padding: 0.1rem 0.4rem; font-size: 0.7rem;">${res.parent_friendly_level || '資訊不足'}</span>
            <span style="font-size: 0.8rem;">⭐ ${res.rating}</span>
        </div>
        <button class="map-popup-btn" id="popup-btn-${res.place_id}">查看詳情</button>
    `;

    // Handle click on "View Detail" button in popup
    marker.bindPopup(popupContent);
    marker.on('popupopen', () => {
        const btn = document.getElementById(`popup-btn-${res.place_id}`);
        if (btn) {
            btn.addEventListener('click', () => {
                showDetail(res);
            });
        }
    });

    return marker;
}

function handleGeolocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            state.userLocation = { lat, lng };
            
            // Remove old user marker
            if (state.userMarker) {
                state.map.removeLayer(state.userMarker);
            }

            const userIcon = L.divIcon({
                className: 'user-marker',
                html: `<div style="background-color: #4285F4; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(66,133,244,0.5);"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });

            state.userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(state.map);
            state.userMarker.bindPopup("你的位置");
            
            state.showLowLevel = true; // Show all restaurants within 3km immediately
            
            btnNearby.innerHTML = '<span style="font-size: 1.25rem;">📍</span> 已套用附近餐廳';
            btnNearby.style.backgroundColor = '#E2E8F0';
            btnNearby.style.color = '#475569';
            btnNearby.disabled = true;

            // Clear selected regions when using geolocation
            state.locations.clear();
            updateModalUI();
            updateLocationText();
            
            renderList();
        }, (error) => {
            console.warn("Geolocation denied or error:", error);
            alert("無法取得位置，請確認是否開啟定位權限。");
            btnNearby.innerHTML = '<span style="font-size: 1.25rem;">📍</span> 看我附近的餐廳';
        });
    } else {
        alert("你的瀏覽器不支援定位功能。");
    }
}

init();
