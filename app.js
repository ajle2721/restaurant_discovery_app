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
    showMore: false,
    lastFilteredResults: [],
    markerMap: {}
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

const icons = {
    mapPin: `<svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="currentColor" style="display: inline-block; vertical-align: middle;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
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

// DOM Elements
const restaurantList = document.getElementById('restaurant-list');
const homeView = document.getElementById('home-view');
const detailView = document.getElementById('detail-view');
const detailContent = document.getElementById('detail-content');
const backHomeBtn = document.getElementById('back-home');
const floatShareBtn = document.getElementById('float-share');
const detailShareBtn = document.getElementById('share-detail');
const toast = document.getElementById('toast');
const locationText = document.getElementById('location-text');
const resultsCount = document.getElementById('results-count');
const btnNearby = document.getElementById('btn-nearby');

// Modal Elements
const openLocationModalBtn = document.getElementById('open-location-modal');
const locationModal = document.getElementById('location-modal');
const closeLocationModalBtn = document.getElementById('close-location-modal');
const confirmLocationBtn = document.getElementById('confirm-location');
const locAllBtn = document.getElementById('loc-all');
const locChips = document.querySelectorAll('.loc-chip');


function resetViewState() {
    state.showMore = false;
    const mapStatus = document.getElementById('map-status');
    if (mapStatus) {
        mapStatus.textContent = '目前顯示較適合帶小孩的餐廳';
    }
}

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
            resetViewState();
            state.locations.clear();
            clearUserLocation();
            updateModalUI();
        });
    }

    locChips.forEach(chip => {
        chip.addEventListener('click', () => {
            resetViewState();
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
    detailShareBtn.addEventListener('click', () => {
        if (state.selectedRestaurant) {
            shareRestaurant(state.selectedRestaurant);
        }
    });
}

function toggleFilter(filterAttr) {
    resetViewState();
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
    resultsCount.innerHTML = '';
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

    // 2. Filter data
    let eligibleData = dataWithDistance.filter(res => {
        if (state.locations.size > 0) {
            const hasMatch = Array.from(state.locations).some(loc => res.address.includes(loc));
            if (!hasMatch) return false;
        }
        if (state.userLocation && res.distance > 3) return false;
        
        const meetsFilters = selectedFilters.every(f => res.attributes[f] === 'yes');
        if (selectedFilters.length > 0 && !meetsFilters) return false;

        return true;
    });

    // Sort
    const levelWeight = { 
        'High': 4, 'Medium': 3, 'Needs Attention': 2, 'Insufficient Info': 1,
        '高': 4, '中': 3, '需留意': 2, '資訊不足': 1 
    };
    eligibleData.sort((a, b) => {
        if (state.userLocation && a.distance !== b.distance) {
            return a.distance - b.distance;
        }
        const weightA = levelWeight[a.parent_friendly_level] || 0;
        const weightB = levelWeight[b.parent_friendly_level] || 0;
        if (weightA !== weightB) return weightB - weightA;
        return (b.parent_friendly_score || 0) - (a.parent_friendly_score || 0);
    });

    // Split into Groups
    // Recommended: High/Medium or 高/中
    const recommended = eligibleData.filter(r => 
        r.parent_friendly_level === 'High' || r.parent_friendly_level === 'Medium' ||
        r.parent_friendly_level === '高' || r.parent_friendly_level === '中'
    );
    // Others: Insufficient Info/Needs Attention or 資訊不足/需留意
    const others = eligibleData.filter(r => 
        r.parent_friendly_level === 'Insufficient Info' || r.parent_friendly_level === 'Needs Attention' ||
        r.parent_friendly_level === '資訊不足' || r.parent_friendly_level === '需留意'
    );

    if (recommended.length === 0 && others.length === 0) {
        renderEmptyState();
        renderMap([]);
        return;
    }

    // Update Result Count
    resultsCount.innerHTML = `
        <div style="font-weight: 800; font-size: 1.1rem; color: var(--text-main); margin-bottom: 0.5rem;">
            找到 ${recommended.length} 間適合帶小孩的餐廳
        </div>
    `;

    // Render Recommended Section
    if (recommended.length > 0) {
        const recSection = document.createElement('div');
        recSection.className = 'results-section';
        recSection.innerHTML = `<div class="section-header">推薦給你</div>`;
        const recList = document.createElement('div');
        recommended.forEach(res => renderCard(res, recList));
        recSection.appendChild(recList);
        restaurantList.appendChild(recSection);
    }

    // Render Others Section (Hidden by default)
    if (others.length > 0) {
        const othersSection = document.createElement('div');
        othersSection.className = 'results-section';
        
        const showMoreBtn = document.createElement('button');
        showMoreBtn.className = 'show-more-btn';
        showMoreBtn.id = 'show-more-others';
        showMoreBtn.innerHTML = `
            <span>👉 顯示更多選項 (含資訊較少或需留意)</span>
            <span class="arrow-icon">▼</span>
        `;
        
        const othersContainer = document.createElement('div');
        othersContainer.className = 'collapsible-content';
        othersContainer.id = 'others-list-container';
        
        othersSection.appendChild(showMoreBtn);
        othersSection.appendChild(othersContainer);
        
        if (state.showMore) {
            othersContainer.classList.add('expanded');
            showMoreBtn.classList.add('active');
            showMoreBtn.querySelector('span').textContent = '收合額外選項';
        }
        
        others.forEach(res => renderCard(res, othersContainer));
        restaurantList.appendChild(othersSection);

        showMoreBtn.addEventListener('click', () => {
            state.showMore = !state.showMore;
            othersContainer.classList.toggle('expanded', state.showMore);
            showMoreBtn.classList.toggle('active', state.showMore);
            
            const mapStatus = document.getElementById('map-status');
            if (mapStatus) {
                mapStatus.textContent = state.showMore ? '目前顯示所有搜尋結果' : '目前顯示較適合帶小孩的餐廳';
            }
            showMoreBtn.querySelector('span').textContent = state.showMore ? '收合額外選項' : '👉 顯示更多選項 (含資訊較少或需留意)';
            
            renderMap(state.lastFilteredResults);
        });
    }

    updateFilterSummary(eligibleData.length);
    state.lastFilteredResults = eligibleData;
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

function renderCard(res, container) {
    const card = document.createElement('div');
    card.className = 'restaurant-card';
    card.id = `card-${res.place_id}`;

    const isNeedsAttention = res.parent_friendly_level === 'Needs Attention' || res.parent_friendly_level === '需留意';

    let distHtml = '';
    if (res.distance && res.distance !== Infinity) {
        distHtml = `<span class="distance-badge">🚶 ${formatDistance(res.distance)}</span>`;
    }

    // Identify Positive Tags and Negative Warnings
    let positiveTags = [];
    let warnings = [];
    
    Object.keys(res.attributes || {}).forEach(attr => {
        if (res.attributes[attr] === 'yes') {
            positiveTags.push({ id: attr, label: attributeLabels[attr], icon: attributeIcons[attr] });
        } else if (res.attributes[attr] === 'no') {
            const warningLabel = attr === 'high_chair_available' ? '未提供兒童椅' : 
                                 attr === 'spacious_seating' ? '空間可能較擁擠' : 
                                 attr === 'kids_menu' ? '未提供兒童餐' : 
                                 attr === 'kid_noise_tolerant' ? '環境偏安靜' : '';
            if (warningLabel) {
                warnings.push(warningLabel);
            }
        }
    });

    const warningsHtml = warnings.length > 0 ? `<div class="warning-item">${warnings.join('、')}</div>` : '';

    card.innerHTML = `
        <!-- 1. Name Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div class="restaurant-name" style="font-size: 1.1rem; margin-bottom: 0; line-height: 1.3;">${res.name}</div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                ${distHtml}
                <button class="view-on-map-btn" title="在地圖上查看" onclick="focusRestaurantOnMap(event, '${res.place_id}')">${icons.mapPin}</button>
            </div>
        </div>

        <!-- 2. Decision Group (Recommendation + Warnings/Tags) -->
        <div style="margin-bottom: 0.65rem; display: flex; align-items: center; gap: 0.6rem;">
            <!-- Badge -->
            <div style="flex-shrink: 0;">
                ${(() => {
                    const level = res.parent_friendly_level;
                    if (!levelLabels[level]) return '';
                    let color = '#15803d';
                    let bg = '#f0fdf4';
                    let borderColor = 'transparent';
                    if (level === 'Medium' || level === '中') { color = '#16a34a'; bg = '#f0fdf4'; }
                    if (level === 'Needs Attention' || level === '需留意') { color = '#ef4444'; bg = '#fef2f2'; borderColor = '#FECACA'; }
                    if (level === 'Insufficient Info' || level === '資訊不足') { color = '#64748b'; bg = '#f8fafc'; borderColor = '#E2E8F0'; }
                    return `<span class="decision-summary" style="color: ${color}; background: ${bg}; border: 1px solid ${borderColor};">${levelLabels[level]}</span>`;
                })()}
            </div>

            <!-- Main Info (Warnings for NeedsAttention, Tags for others) -->
            <div style="grid-row: 1; font-size: 0.85rem; font-weight: 700;">
                ${isNeedsAttention ? warningsHtml : `
                    <span style="color: #5fb3ad;">
                        ${positiveTags.map(t => t.label).join('、')}
                    </span>
                `}
            </div>
        </div>

        <!-- 3. Explanation Section (Summary) -->
        <div class="card-summary" style="margin-bottom: 0.5rem; padding: 0.6rem 0.75rem;">
            ${res.card_summary || '目前親子友善資訊較有限，建議前往前可先向店家確認。'}
        </div>

        <!-- 4. Bottom Info Section (Rating & Address) -->
        <div style="display: flex; align-items: center; gap: 0.8rem; font-size: 0.75rem; font-weight: 500; color: #64748b; opacity: 0.6;">
            <div style="display: flex; align-items: center; gap: 0.2rem;">
                <span style="color: #FFB800;">⭐</span> ${res.rating}
            </div>
            <div style="display: flex; align-items: center; gap: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <span style="color: var(--primary);">${icons.mapPin}</span> ${res.address}
            </div>
        </div>
    `;

    card.addEventListener('click', (e) => {
        // Highlight this card
        document.querySelectorAll('.restaurant-card').forEach(c => c.classList.remove('highlighted'));
        card.classList.add('highlighted');
        
        showDetail(res);
    });

    container.appendChild(card);
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
    resetViewState();
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

    const level = restaurant.parent_friendly_level || 'Insufficient Info';
    const isRecommended = (level === 'High' || level === 'Medium' || level === '高' || level === '中');
    
    let warningsHtml = '';
    Object.keys(restaurant.attributes || {}).forEach(attr => {
        if (restaurant.attributes[attr] === 'no') {
            const warningLabel = attr === 'high_chair_available' ? '未提供兒童椅' : 
                                 attr === 'spacious_seating' ? '空間可能較擁擠' : 
                                 attr === 'kids_menu' ? '未提供兒童餐' : 
                                 attr === 'kid_noise_tolerant' ? '環境偏安靜' : '';
            if (warningLabel) {
                warningsHtml += `<div class="warning-item">⚠️ ${warningLabel}</div>`;
            }
        }
    });

    detailContent.innerHTML = `
        <h1 style="margin-bottom: 0.5rem; color: var(--text-main);">${restaurant.name}</h1>
        <div class="restaurant-rating" style="font-size: 1.1rem; margin-bottom: 0.5rem;">⭐ ${restaurant.rating}</div>
        <div class="restaurant-address" style="font-size: 0.9rem; margin-bottom: 1.5rem;">
            <span style="color: var(--primary);">${icons.mapPin}</span> ${restaurant.address}
        </div>
        
        <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">親子友善建議</div>
        <div style="margin-bottom: 1.5rem;">
            ${(() => {
                const label = levelLabels[level];
                if (!label) return '';
                let color = '#15803d';
                let bg = '#f0fdf4';
                if (level === 'Medium' || level === '中') { color = '#16a34a'; bg = '#f0fdf4'; }
                if (level === 'Needs Attention' || level === '需留意') { color = '#ef4444'; bg = '#fef2f2'; }
                if (level === 'Insufficient Info' || level === '資訊不足') { color = '#64748b'; bg = '#f8fafc'; }
                return `<span style="padding: 0.4rem 0.8rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.9rem; background: ${bg}; color: ${color};">${label}</span>`;
            })()}
        </div>
        
        ${warningsHtml ? `
            <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">需留意事項</div>
            <div class="warning-container" style="margin-bottom: 1.5rem;">${warningsHtml}</div>
        ` : ''}

        <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">親子友善條件</div>
        <div class="tag-container" style="gap: 0.75rem; margin-bottom: 1.5rem;">
            ${tagsHtml}
        </div>

        <div class="ai-summary" style="margin-bottom: 1.5rem;">
            <div class="ai-summary-title">
                親子用餐摘要
                <span class="info-icon" onclick="toggleDisclaimer(event)">ⓘ</span>
            </div>
            <div class="disclaimer-expandable" id="ai-disclaimer">
                本摘要為系統整理結果，建議搭配現場資訊判斷。
            </div>
            <div class="ai-summary-text" style="font-size: 1rem; line-height: 1.7; color: var(--text-main);">${restaurant.ai_summary}</div>
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

    state.markers = [];
    state.markerMap = {};
    const markersToFit = [];

    restaurants.forEach(res => {
        if (res.latitude && res.longitude) {
            // Only show High/Medium by default
            const level = res.parent_friendly_level || 'Insufficient Info';
            if (!state.showMore && level !== 'High' && level !== 'Medium' && level !== '高' && level !== '中') {
                return;
            }

            // High=Dark Green, Mid=Light Green, Attention=Red, Info=Grey
            let color = '#94a3b8'; // Default Grey (Insufficient Info)
            if (level === 'High' || level === '高') color = '#15803d'; // Dark Green
            if (level === 'Medium' || level === '中') color = '#86efac'; // Light Green
            if (level === 'Needs Attention' || level === '需留意') color = '#ef4444'; // Red
            
            const marker = createMarker(res, color);
            marker.addTo(state.map);
            state.markers.push(marker);
            state.markerMap[res.place_id] = marker;
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

function focusRestaurantOnMap(event, placeId) {
    if (event) event.stopPropagation();

    const marker = state.markerMap[placeId];
    if (marker) {
        // 1. Scroll map into view
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // 2. Center and Zoom map
        state.map.setView(marker.getLatLng(), 16, { animate: true });

        // 3. Open Popup
        setTimeout(() => {
            marker.openPopup();
        }, 300);

        // 4. Highlight Pin
        const el = marker.getElement();
        if (el) {
            el.classList.add('marker-highlight');
            setTimeout(() => {
                el.classList.remove('marker-highlight');
            }, 3000);
        }
    } else {
        // If marker is not visible (e.g. filtered out but in list)
        // Try to show more if possible
        if (!state.showMore) {
            state.showMore = true;
            renderList();
            setTimeout(() => focusRestaurantOnMap(null, placeId), 600);
        }
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
    
    const level = res.parent_friendly_level || 'Insufficient Info';
    const isRecommended = (level === 'High' || level === 'Medium' || level === '高' || level === '中');

    popupContent.innerHTML = `
        <div class="map-popup-title">${res.name}</div>
        <div style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
            ${(() => {
                const label = levelLabels[level];
                if (!label) return '';
                let color = '#15803d';
                let bg = '#f0fdf4';
                if (level === 'Medium' || level === '中') { color = '#16a34a'; bg = '#f0fdf4'; }
                if (level === 'Needs Attention' || level === '需留意') { color = '#ef4444'; bg = '#fef2f2'; }
                if (level === 'Insufficient Info' || level === '資訊不足') { color = '#64748b'; bg = '#f8fafc'; }
                return `<span style="font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 0.4rem; background: ${bg}; color: ${color};">${label}</span>`;
            })()}
            <span style="font-size: 0.8rem; font-weight: 600; color: #64748b;">⭐ ${res.rating}</span>
        </div>
        <button class="map-popup-btn" id="popup-btn-${res.place_id}">查看評價詳情</button>
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
    resetViewState();
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
            
            state.showHighLevel = true;
            state.showMidLevel = true;
            state.showLowLevel = true; // Show all restaurants within 3km immediately
            
            btnNearby.innerHTML = `<span style="font-size: 1.25rem; display: inline-flex; align-items: center; margin-right: 4px;">${icons.mapPin}</span> 已套用附近餐廳`;
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
            btnNearby.innerHTML = `<span style="font-size: 1.25rem; display: inline-flex; align-items: center; margin-right: 4px;">${icons.mapPin}</span> 看我附近的餐廳`;
        });
    } else {
        alert("你的瀏覽器不支援定位功能。");
    }
}

init();
