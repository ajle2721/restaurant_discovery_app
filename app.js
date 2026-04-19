// State Management
const state = {
    filters: new Set(),
    locations: new Set(), // Empty means "全區"
    selectedRestaurant: null,
    view: 'home',
    viewMode: 'list', // 'list' or 'map'
    map: null,
    markers: [],
    userMarker: null,
    askedForLocation: false,
    lastFilteredResults: { section1: [], section2: [] }
};

const attributeIcons = {
    high_chair_available: '🪑',
    kids_menu: '🥘',
    spacious_seating: '🛋️',
    kid_noise_tolerant: '🥳'
};

const attributeLabels = {
    high_chair_available: '嬰兒椅',
    kids_menu: '兒童餐',
    spacious_seating: '寬敞座位',
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

// Modal Elements
const openLocationModalBtn = document.getElementById('open-location-modal');
const locationModal = document.getElementById('location-modal');
const closeLocationModalBtn = document.getElementById('close-location-modal');
const confirmLocationBtn = document.getElementById('confirm-location');
const locAllBtn = document.getElementById('loc-all');
const locChips = document.querySelectorAll('.loc-chip');

// Filter parameter mapping
const paramToAttr = {
    'high_chair': 'high_chair_available',
    'kids_menu': 'kids_menu',
    'spacious_seating': 'spacious_seating',
    'kid_noise_tolerant': 'kid_noise_tolerant'
};
const attrToParam = {
    'high_chair_available': 'high_chair',
    'kids_menu': 'kids_menu',
    'spacious_seating': 'spacious_seating',
    'kid_noise_tolerant': 'kid_noise_tolerant'
};

// Initialization
function init() {
    initMap();
    renderList();
    checkUrlParams();
    setupEventListeners();
}

function setupEventListeners() {
    // Filter Chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const filterAttr = chip.dataset.filter;
            if (state.filters.has(filterAttr)) {
                state.filters.delete(filterAttr);
                chip.classList.remove('active');
            } else {
                state.filters.add(filterAttr);
                chip.classList.add('active');
            }
            renderList();
            updateUrl();
        });
    });

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
    shareResultsBtn.addEventListener('click', shareCurrentFilters);
    detailShareBtn.addEventListener('click', () => {
        if (state.selectedRestaurant) {
            shareRestaurant(state.selectedRestaurant);
        }
    });

    // View Toggle
    const toggleListBtn = document.getElementById('toggle-list');
    const toggleMapBtn = document.getElementById('toggle-map');
    
    if (toggleListBtn && toggleMapBtn) {
        toggleListBtn.addEventListener('click', () => switchViewMode('list'));
        toggleMapBtn.addEventListener('click', () => switchViewMode('map'));
    }
}

function renderList() {
    restaurantList.innerHTML = '';
    resultsCount.textContent = '';
    resultsCount.style.display = 'none';

    if (state.filters.size === 0) {
        return;
    }

    resultsCount.style.display = 'block';
    const selectedFilters = Array.from(state.filters);

    // 1. Filter out restaurants based on global exclusions and initial filtering
    const eligibleData = restaurantData.filter(res => {
        // District filter
        if (state.locations.size > 0) {
            const hasMatch = Array.from(state.locations).some(loc => res.address.includes(loc));
            if (!hasMatch) return false;
        }

        // Exclude: any selected filter = No
        const hasNo = selectedFilters.some(f => res.attributes[f] === 'no');
        if (hasNo) return false;

        // Exclude: ALL tags are Unknown (no information at all)
        const allTagsUnknown = Object.values(res.attributes).every(val => val === 'unknown');
        if (allTagsUnknown) return false;

        return true;
    });

    // 2. Group into two sections
    // [Section 1] 符合條件的餐廳: ALL selected filters = Yes
    const section1Data = eligibleData.filter(res => 
        selectedFilters.every(f => res.attributes[f] === 'yes')
    );

    // [Section 2] 可能符合條件（評論資訊較少）: All selected filters are Unknown
    // AND none are No (already handled by eligibleData filter)
    const section2Data = eligibleData.filter(res => 
        selectedFilters.every(f => res.attributes[f] === 'unknown')
    );

    if (section1Data.length === 0 && section2Data.length === 0) {
        renderEmptyState();
        return;
    }

    resultsCount.textContent = `找到 ${section1Data.length + section2Data.length} 間餐廳`;

    // Render Section 1
    if (section1Data.length > 0) {
        const header = document.createElement('div');
        header.className = 'results-section-header';
        header.textContent = '符合條件的餐廳';
        restaurantList.appendChild(header);

        section1Data.forEach(res => renderCard(res));
    }

    // Render Section 2
    if (section2Data.length > 0) {
        const header = document.createElement('div');
        header.className = 'results-section-header';
        header.textContent = '可能符合條件（評論資訊較少）';
        restaurantList.appendChild(header);

        const helper = document.createElement('div');
        helper.className = 'results-section-helper';
        helper.textContent = '這些餐廳未在評論中找到明確證據，但也未出現不符合的描述';
        restaurantList.appendChild(helper);

        section2Data.forEach(res => renderCard(res));
    }

    updateFilterSummary(section1Data.length + section2Data.length);
    
    // Store results for map persistence
    state.lastFilteredResults = { section1: section1Data, section2: section2Data };
    renderMap(section1Data, section2Data);
}

function updateFilterSummary(totalCount) {
    const summaryDistrict = document.getElementById('summary-district');
    const summaryFilters = document.getElementById('summary-filters');
    const summaryCount = document.getElementById('summary-count');

    if (!summaryDistrict || !summaryFilters || !summaryCount) return;

    // District
    if (state.locations.size === 0) {
        summaryDistrict.textContent = '台北市 · 全區';
    } else {
        summaryDistrict.textContent = Array.from(state.locations).join('、');
    }

    // Filters
    if (state.filters.size === 0) {
        summaryFilters.textContent = '全部';
    } else {
        const labels = Array.from(state.filters).map(f => attributeLabels[f]);
        summaryFilters.textContent = labels.join('、');
    }

    // Count
    summaryCount.textContent = totalCount;
}

function renderCard(res) {
    const card = document.createElement('div');
    card.className = 'restaurant-card';

    let tagsHtml = '';
    Object.keys(res.attributes).forEach(attr => {
        if (res.attributes[attr] === 'yes') {
            tagsHtml += `<span class="tag"><span>${attributeIcons[attr]}</span> ${attributeLabels[attr]}</span>`;
        }
    });

    const summary = getDecisionSummary(res);

    card.innerHTML = `
        <div class="restaurant-name">${res.name}</div>
        <div class="restaurant-rating">⭐ ${res.rating}</div>
        <div class="decision-summary">${summary}</div>
        <div class="restaurant-address">${res.address}</div>
        <div class="tag-container">
            ${tagsHtml}
        </div>
        <div class="card-actions">
            <button class="btn btn-primary btn-detail">查看詳情</button>
            <button class="btn btn-outline btn-maps">Google 地圖</button>
        </div>
    `;

    card.querySelector('.btn-detail').addEventListener('click', (e) => {
        e.stopPropagation();
        showDetail(res);
    });

    card.querySelector('.btn-maps').addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(getGoogleMapsUrl(res), '_blank');
    });

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
        locationText.textContent = '台北市 · 全區';
    } else if (state.locations.size === 1) {
        locationText.textContent = Array.from(state.locations)[0];
    } else if (state.locations.size === 2) {
        locationText.textContent = Array.from(state.locations).join('、');
    } else {
        const first = Array.from(state.locations)[0];
        locationText.textContent = `${first}等 ${state.locations.size} 區`;
    }
}

window.clearFilters = () => {
    state.filters.clear();
    state.locations.clear();
    updateModalUI();
    updateLocationText();
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    renderList();
    updateUrl();
};

function showDetail(restaurant) {
    state.selectedRestaurant = restaurant;

    let tagsHtml = '';
    Object.keys(restaurant.attributes).forEach(attr => {
        if (restaurant.attributes[attr] === 'yes') {
            tagsHtml += `<span class="tag" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;"><span>${attributeIcons[attr]}</span> ${attributeLabels[attr]}</span>`;
        }
    });

    let signalsHtml = '';
    if (restaurant.signals && restaurant.signals.length > 0) {
        signalsHtml = `
            <div style="font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-muted);">評論線索（來自最多5則評論）</div>
            <ul style="list-style: none; padding-left: 0; margin-bottom: 1.5rem;">
                ${restaurant.signals.map(s => `<li style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem;">● ${s}</li>`).join('')}
            </ul>
        `;
    }

    detailContent.innerHTML = `
        <h1 style="margin-bottom: 0.5rem; color: var(--text-main);">${restaurant.name}</h1>
        <div class="restaurant-rating" style="font-size: 1.1rem; margin-bottom: 0.5rem;">⭐ ${restaurant.rating}</div>
        <div class="restaurant-address" style="font-size: 0.9rem; margin-bottom: 1.5rem;">📍 ${restaurant.address}</div>
        
        <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">育兒友善標籤</div>
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
    } else {
        homeView.classList.remove('active');
        detailView.classList.add('active');
        window.scrollTo(0, 0);
    }
}

function updateUrl() {
    const params = new URLSearchParams();

    // Use legacy 'f' param for backwards compatibility or new specific params
    state.filters.forEach(attr => {
        const param = attrToParam[attr];
        if (param) params.set(param, '1');
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
    Object.keys(paramToAttr).forEach(param => {
        if (params.get(param) === '1') {
            const attr = paramToAttr[param];
            state.filters.add(attr);
            const chip = document.querySelector(`.filter-chip[data-filter="${attr}"]`);
            if (chip) chip.classList.add('active');
        }
    });

    // Support legacy 'f' param
    const filtersParam = params.get('f');
    if (filtersParam) {
        filtersParam.split(',').forEach(f => {
            state.filters.add(f);
            const chip = document.querySelector(`.filter-chip[data-filter="${f}"]`);
            if (chip) chip.classList.add('active');
        });
    }

    // Support location param
    const locParam = params.get('loc');
    if (locParam) {
        locParam.split(',').forEach(loc => {
            if (loc) state.locations.add(loc.trim());
        });
        updateModalUI();
        updateLocationText();
    }

    renderList();

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

function getDecisionSummary(res) {
    const activeTags = Object.keys(res.attributes)
        .filter(attr => res.attributes[attr] === 'yes');

    if (activeTags.length >= 3) {
        return `適合帶小孩`;
    } else if (activeTags.length >= 1) {
        return `親子相對友善`;
    } else {
        return `親子相關資訊較少`;
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

function switchViewMode(mode) {
    state.viewMode = mode;
    const listContainer = document.getElementById('restaurant-list');
    const mapContainer = document.getElementById('map-container');
    const toggleListBtn = document.getElementById('toggle-list');
    const toggleMapBtn = document.getElementById('toggle-map');

    if (mode === 'map') {
        listContainer.classList.add('hidden');
        mapContainer.classList.remove('hidden');
        toggleMapBtn.classList.add('active');
        toggleListBtn.classList.remove('active');
        
        // Fix Leaflet sizing issue when container becomes visible
        setTimeout(() => {
            state.map.invalidateSize();
            
            // Re-render markers to ensure fitBounds works with visible container
            renderMap(state.lastFilteredResults.section1, state.lastFilteredResults.section2);

            if (!state.askedForLocation) {
                handleGeolocation();
            }
        }, 100);
    } else {
        listContainer.classList.remove('hidden');
        mapContainer.classList.add('hidden');
        toggleListBtn.classList.add('active');
        toggleMapBtn.classList.remove('active');
    }
}

function renderMap(section1, section2) {
    if (!state.map) return;

    // Clear existing markers
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];

    const allResults = [...section1.map(r => ({...r, type: 'confirmed'})), 
                        ...section2.map(r => ({...r, type: 'potential'}))];

    const markersToFit = [];

    allResults.forEach(res => {
        if (res.latitude && res.longitude) {
            const color = res.type === 'confirmed' ? '#4FB3AA' : '#FFB347';
            const marker = createMarker(res, color);
            marker.addTo(state.map);
            state.markers.push(marker);
            markersToFit.push([res.latitude, res.longitude]);
        }
    });

    // Auto-fit bounds if we have markers
    if (markersToFit.length > 0) {
        state.map.fitBounds(markersToFit, { padding: [50, 50], maxZoom: 15 });
    }
}

function createMarker(res, color) {
    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const marker = L.marker([res.latitude, res.longitude], { icon: icon });

    // Popup Content
    const popupContent = document.createElement('div');
    popupContent.className = 'map-popup-card';
    
    let tagsHtml = '';
    Object.keys(res.attributes).forEach(attr => {
        if (res.attributes[attr] === 'yes') {
            tagsHtml += `<span class="map-popup-tag">${attributeIcons[attr]}</span>`;
        }
    });

    popupContent.innerHTML = `
        <div class="map-popup-title">${res.name}</div>
        <div class="map-popup-rating">⭐ ${res.rating}</div>
        <div class="map-popup-tags">${tagsHtml}</div>
        <button class="map-popup-btn" id="popup-btn-${res.place_id}">查看詳情</button>
        <a href="${getGoogleMapsUrl(res)}" target="_blank" class="map-popup-link">在 Google 地圖開啟</a>
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
    state.askedForLocation = true;
    if (confirm('要顯示你目前所在位置嗎？這樣可以更方便比較附近餐廳的位置')) {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Remove old user marker
                if (state.userMarker) {
                    state.map.removeLayer(state.userMarker);
                }

                const userIcon = L.divIcon({
                    className: 'user-marker',
                    html: `<div style="background-color: #4285F4; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(66,133,244,0.5);"></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });

                state.userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(state.map);
                state.userMarker.bindPopup("你在這裡");
                
                // Optionally center on user
                // state.map.setView([lat, lng], 15);
            }, (error) => {
                console.warn("Geolocation denied or error:", error);
            });
        }
    }
}

init();
