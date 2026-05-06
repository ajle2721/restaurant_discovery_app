// State Management
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
    currentResults: []
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

function getPFSummaryTags(res) {
    const level = res.parent_friendly_level;
    const isPositive = (level === 'High' || level === '高' || level === 'Medium' || level === '中');
    const isWarning = (level === 'Needs Attention' || level === '需留意');
    
    let tags = [];
    if (res.attributes) {
        if (isPositive) {
            if (res.attributes.spacious_seating === 'yes') tags.push('空間寬敞');
            if (res.attributes.kid_noise_tolerant === 'yes') tags.push('不怕吵');
            if (res.attributes.high_chair_available === 'yes') tags.push('兒童椅');
            if (res.attributes.kids_menu === 'yes') tags.push('兒童餐');
        } else if (isWarning) {
            if (res.attributes.spacious_seating === 'no') tags.push('空間可能較擁擠');
            if (res.attributes.kid_noise_tolerant === 'no') tags.push('環境可能偏安靜');
            if (res.attributes.high_chair_available === 'no') tags.push('可能無兒童椅');
            if (res.attributes.kids_menu === 'no') tags.push('可能無兒童餐');
        }
    }
    
    if (isWarning && tags.length === 0) {
        if (res.ai_summary && (res.ai_summary.includes('擠') || res.ai_summary.includes('狹窄'))) {
            tags.push('空間可能較擁擠');
        } else {
            tags.push('建議先確認環境');
        }
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
    setupEventListeners();
    checkUrlParams();
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
    btnNearby.addEventListener('click', handleNearby);

    // Quick Links
    document.querySelectorAll('.quick-link-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const locName = btn.dataset.loc;
            const locObj = state.locationData.find(l => l.name === locName);
            if (locObj) selectLocation(locObj);
        });
    });

    // Filter Chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const filter = chip.dataset.filter;
            if (state.filters.has(filter)) {
                state.filters.delete(filter);
                chip.classList.remove('active');
            } else {
                state.filters.add(filter);
                chip.classList.add('active');
            }
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
            renderResults();
        });
    }

    // Toggle Others
    toggleOthersBtn.addEventListener('click', () => {
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
        
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        searchResultsView.classList.add('hidden');
        floatShareBtn.classList.add('hidden');
        
        // Update checkbox UI
        const hideMarkersToggle = document.getElementById('hide-others-markers');
        if (hideMarkersToggle) hideMarkersToggle.checked = true;
        
        document.querySelector('.trending-section').classList.remove('hidden');
        document.querySelector('.main-header').style.display = 'block';
        updateUrl();
    });

    // Navigation
    backHomeBtn.addEventListener('click', () => switchView('home'));

    // Sharing
    floatShareBtn.addEventListener('click', shareCurrentFilters);
    detailShareBtn.addEventListener('click', () => {
        if (state.selectedRestaurant) shareRestaurant(state.selectedRestaurant);
    });

    // Trending Items
    document.querySelectorAll('.trending-item').forEach(item => {
        item.addEventListener('click', () => {
            const locName = item.dataset.loc;
            const filter = item.dataset.filter;
            
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
            if (locObj) selectLocation(locObj);
        });
    });
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
                selectLocation(locObj);
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
            selectLocation(loc);
            btnNearby.innerHTML = '<span class="icon">📍</span> <span class="btn-text-desktop">看我附近適合帶小孩的餐廳</span><span class="btn-text-mobile">找我附近適合小孩的餐廳</span>';
        },
        (err) => {
            console.error(err);
            showToast('定位失敗，請手動輸入地點');
            btnNearby.innerHTML = '<span class="icon">📍</span> <span class="btn-text-desktop">看我附近適合帶小孩的餐廳</span><span class="btn-text-mobile">找我附近適合小孩的餐廳</span>';
        }
    );
}

function selectLocation(loc) {
    state.searchLocation = loc;
    state.showOthers = false; // Reset to only show High+Medium results on new search
    searchInput.value = loc.name;
    autocompleteDropdown.classList.add('hidden');
    clearSearchBtn.classList.remove('hidden');
    
    // Switch UI to results mode
    document.querySelector('.main-header').style.display = 'block'; 
    document.querySelector('.trending-section').classList.add('hidden');
    searchResultsView.classList.remove('hidden');
    floatShareBtn.classList.remove('hidden');
    currentSearchLocText.textContent = loc.name;
    
    // CRITICAL: Leaflet needs to know the size changed after being unhidden
    if (state.map) {
        setTimeout(() => {
            state.map.invalidateSize();
            renderResults();
            updateUrl();
            // Scroll to results
            searchResultsView.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    } else {
        renderResults();
        updateUrl();
        searchResultsView.scrollIntoView({ behavior: 'smooth' });
    }
}

function renderResults() {
    try {
        recommendedList.innerHTML = '';
        othersList.innerHTML = '';
        fallbackHint.classList.add('hidden');
        noResultsState.classList.add('hidden');

        // Update Clear Filters button visibility
        const clearAllFiltersBtn = document.getElementById('clear-all-filters');
        if (clearAllFiltersBtn) {
            clearAllFiltersBtn.classList.toggle('hidden', state.filters.size === 0);
        }

        const hideMarkersToggle = document.getElementById('hide-others-markers');
        if (hideMarkersToggle) {
            hideMarkersToggle.checked = state.hideLowQualityMarkers;
        }
        
        if (!state.searchLocation) {
            console.warn('No search location selected');
            return;
        }

        const center = state.searchLocation;
        console.log('Rendering results for:', center.name);
        
        // Ensure restaurantData exists
        if (typeof restaurantData === 'undefined') {
            throw new Error('restaurantData is not loaded');
        }
    let data = restaurantData.map(res => {
        const dist = calculateDistance(center.lat, center.lng, res.latitude, res.longitude);
        return { ...res, distance: dist };
    });

    // 2. Filter by distance (Adaptive: 1.5km for points, 2.5km for districts)
    const maxRadius = (center.type === '行政區') ? 2.5 : 1.5;
    let filtered = data.filter(res => {
        if (res.distance > maxRadius) return false;
        
        if (state.filters.size > 0) {
            return Array.from(state.filters).every(f => res.attributes[f] === 'yes');
        }
        return true;
    });

    // 3. Sort
    const levelWeight = { 'High': 4, 'Medium': 3, 'Insufficient Info': 2, 'Needs Attention': 1, '高': 4, '中': 3, '資訊不足': 2, '需留意': 1 };
    filtered.sort((a, b) => {
        const weightA = levelWeight[a.parent_friendly_level] || 0;
        const weightB = levelWeight[b.parent_friendly_level] || 0;
        if (weightA !== weightB) return weightB - weightA;
        return a.distance - b.distance;
    });

    // 4. Check for No Results (Try wider radius if empty for fallback)
    if (filtered.length === 0) {
        handleNoResults(center);
        return;
    }

    // 5. Split and Render
    const recommended = filtered.filter(r => r.parent_friendly_level === 'High' || r.parent_friendly_level === 'Medium' || r.parent_friendly_level === '高' || r.parent_friendly_level === '中');
    const others = filtered.filter(r => r.parent_friendly_level === 'Insufficient Info' || r.parent_friendly_level === 'Needs Attention' || r.parent_friendly_level === '資訊不足' || r.parent_friendly_level === '需留意');

    recommended.forEach(res => renderCard(res, recommendedList));
    others.forEach(res => renderCard(res, othersList));
    
    // Update Toggle Button UI
    othersList.classList.toggle('hidden', !state.showOthers);
    toggleOthersBtn.classList.toggle('active', state.showOthers);
    toggleOthersBtn.querySelector('span').textContent = state.showOthers ? '收合額外選項' : '查看更多 (含資訊不足或需留意)';
    document.getElementById('others-section').classList.toggle('hidden', others.length === 0);

    // If showOthers is true, show ALL on map. Otherwise, only recommended.
    // However, for the "Map" button to work even when collapsed, we need markers for all.
    // User's request: "僅顯示...high+medium餐廳位置" (previous)
    // New request: "地圖上無法顯示...即使我按了餐廳卡片右上角的地圖也一樣"
    // To satisfy both: 
    // 1. If showOthers is false, only show High/Medium markers by default.
    // 2. If showOthers is true, show ALL markers.
    // 3. When clicking "Map" button on an "Others" card, we should show that specific marker even if collapsed.
    
    const mapData = state.showOthers ? filtered : recommended;
    renderMap(mapData);
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
    if (km === Infinity) return null;
    
    // Heuristic: Real road distance is approx 1.3x straight-line distance in Taipei
    const roadKm = km * 1.3;
    
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

function renderCard(res, container) {
    const card = document.createElement('div');
    card.className = 'restaurant-card';
    card.id = `card-${res.place_id}`;

    const level = res.parent_friendly_level;
    let levelClass = '';
    if (level === 'High' || level === '高') levelClass = 'high';
    else if (level === 'Medium' || level === '中') levelClass = 'medium';
    else if (level === 'Needs Attention' || level === '需留意') levelClass = 'attention';
    else levelClass = 'info';

    // Collect tags/warnings for quick viewing
    const summaryTags = getPFSummaryTags(res);
    let extraInfoHtml = '';
    if (summaryTags) {
        const color = (level === 'Needs Attention' || level === '需留意') ? '#ef4444' : 'var(--secondary)';
        extraInfoHtml = `<span style="font-size: 0.8rem; color: ${color}; font-weight: 700; opacity: 0.9;">${summaryTags}</span>`;
    }

    const times = calculateTravelTimes(res.distance);
    let timePillHtml = '';
    if (times) {
        timePillHtml = `
            <button class="time-pill-btn" onclick="focusOnMap(event, '${res.place_id}')" title="在地圖上查看">
                <span class="pin">📍</span> 🚶${times.walking}分 | 🚗${times.driving}分 <span class="arrow">›</span>
            </button>
        `;
    }

    card.innerHTML = `
        <div class="card-header-row">
            <div class="restaurant-name">${res.name}</div>
            ${timePillHtml}
        </div>
        <div style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <span class="decision-summary ${levelClass}">${levelLabels[level] || level}</span>
            ${extraInfoHtml}
        </div>
        <div class="card-summary">${res.card_summary || res.ai_summary || '目前親子友善資訊較有限。'}</div>
        <div style="display: flex; align-items: center; gap: 0.8rem; font-size: 0.75rem; color: #64748b;">
            <span>⭐ ${res.rating}</span>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📍 ${res.address}</span>
        </div>
    `;

    card.addEventListener('click', (e) => {
        if (!e.target.closest('.view-on-map-btn')) {
            showDetail(res);
        }
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

        const marker = state.markerMap[placeId];
        if (marker) {
            state.map.setView([res.latitude, res.longitude], 17);
            marker.openPopup();
            // Scroll map into view if needed
            document.getElementById('map-container').scrollIntoView({ behavior: 'smooth' });
        }
    }
}

window.focusRestaurantOnMap = focusOnMap; // For backward compatibility if any

function showDetail(restaurant) {
    state.selectedRestaurant = restaurant;

    let tagsHtml = '';
    Object.keys(restaurant.attributes || {}).forEach(attr => {
        if (restaurant.attributes[attr] === 'yes' && attributeLabels[attr]) {
            tagsHtml += `<span class="tag"><span>${attributeIcons[attr]}</span> ${attributeLabels[attr]}</span>`;
        }
    });

    if (!tagsHtml) {
        tagsHtml = '<div style="color: var(--text-muted); font-size: 0.9rem; font-style: italic;">未看到明確的親子友善資訊</div>';
    }

    let signalsHtml = '';
    let signals = Array.isArray(restaurant.signals) ? restaurant.signals : (typeof restaurant.signals === 'string' ? [restaurant.signals] : []);
    if (signals.length > 0) {
        signalsHtml = `
            <div style="font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-muted);">評論線索</div>
            <ul style="list-style: none; padding-left: 0; margin-bottom: 1.5rem;">
                ${signals.map(s => `<li style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem;">● ${s}</li>`).join('')}
            </ul>
        `;
    }

    const level = restaurant.parent_friendly_level || 'Insufficient Info';
    
    detailContent.innerHTML = `
        <h1 style="margin-bottom: 0.5rem; color: var(--text-main);">${restaurant.name}</h1>
        <div class="restaurant-rating" style="font-size: 1.1rem; margin-bottom: 0.5rem;">⭐ ${restaurant.rating}</div>
        <div class="restaurant-address" style="font-size: 0.9rem; margin-bottom: 1.5rem;">📍 ${restaurant.address}</div>
        
        <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">親子友善建議</div>
        <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <span style="padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.9rem; 
                ${(level === 'High' || level === '高' || level === 'Medium' || level === '中') ? 'background: #f0fdf4; color: #15803d;' : ''}
                ${(level === 'Needs Attention' || level === '需留意') ? 'background: #fef2f2; color: #ef4444; border: 1px solid #fecaca;' : ''}
                ${(level === 'Insufficient Info' || level === '資訊不足') ? 'background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0;' : ''}
            ">${levelLabels[level] || level}</span>
            ${(level === 'Needs Attention' || level === '需留意') ? `<span style="font-size: 0.9rem; font-weight: 700; color: #ef4444;">${getPFSummaryTags(restaurant)}</span>` : ''}
        </div>
        
        <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">親子友善條件</div>
        <div class="tag-container" style="gap: 0.75rem; margin-bottom: 1.5rem;">
            ${tagsHtml}
        </div>

        <div class="ai-summary" style="margin-bottom: 1.5rem;">
            <div class="ai-summary-title">親子用餐摘要</div>
            <div class="ai-summary-text">${restaurant.ai_summary}</div>
        </div>
        ${signalsHtml}

        <button id="btn-open-google-maps" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 1.125rem;">
            在 Google 地圖中開啟
        </button>
    `;

    // Add event listener after setting innerHTML to avoid quote issues in onclick attributes
    document.getElementById('btn-open-google-maps').addEventListener('click', () => {
        const query = encodeURIComponent(restaurant.name + ' ' + restaurant.address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    });

    switchView('detail');
    updateUrl();
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
    state.map = L.map('map', { zoomControl: false }).setView([25.033, 121.565], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(state.map);
    L.control.zoom({ position: 'bottomright' }).addTo(state.map);
}

function renderMap(restaurants) {
    if (!state.map) return;
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];
    state.markerMap = {};

    const colorMap = {
        'High': '#15803d', '高': '#15803d',
        'Medium': '#86efac', '中': '#86efac',
        'Needs Attention': '#ef4444', '需留意': '#ef4444',
        'Insufficient Info': '#94a3b8', '資訊不足': '#94a3b8'
    };

    const bounds = [];
    
    // Add Search Center Marker
    if (state.searchLocation) {
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
            zIndexOffset: 1000
        }).addTo(state.map);
        
        centerMarker.bindPopup(`<b>搜尋中心</b><br>${state.searchLocation.name}`);
        state.markers.push(centerMarker);
        bounds.push([state.searchLocation.lat, state.searchLocation.lng]);
    }

    restaurants.forEach(res => {
        if (res.latitude && res.longitude) {
            const level = res.parent_friendly_level;
            const isLowQuality = (level === 'Insufficient Info' || level === 'Needs Attention' || level === '資訊不足' || level === '需留意');
            
            // Skip if user wants to hide low quality markers
            if (state.hideLowQualityMarkers && isLowQuality) return;

            const color = colorMap[level] || '#94a3b8';
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

            const marker = L.marker([res.latitude, res.longitude], {
                icon: pinIcon
            }).addTo(state.map);
            
            const times = calculateTravelTimes(res.distance);
            const timeInfo = times ? `<div class="map-popup-time">🚶${times.walking}分 | 🚗${times.driving}分</div>` : '';

            marker.bindPopup(`<div class="map-popup-card">
                <div class="map-popup-header">
                    <div class="map-popup-title">${res.name}</div>
                    ${timeInfo}
                </div>
                <div class="map-popup-rating">⭐ ${res.rating}</div>
                <div style="margin-bottom: 8px;"><span class="decision-summary" style="background: ${color}; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${levelLabels[res.parent_friendly_level] || res.parent_friendly_level}</span></div>
                <button class="map-popup-btn" onclick="showDetailById('${res.place_id}')">查看詳情</button>
            </div>`);
            
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

window.showDetailById = (id) => {
    const res = restaurantData.find(r => r.place_id === id);
    if (res) showDetail(res);
};

function updateUrl() {
    const params = new URLSearchParams();
    if (state.searchLocation) params.set('loc', state.searchLocation.name);
    state.filters.forEach(f => params.append('f', f));
    if (state.view === 'detail' && state.selectedRestaurant) params.set('r', state.selectedRestaurant.place_id);
    
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const locName = params.get('loc');
    
    if (locName && state.locationData.length > 0) {
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
        if (res) showDetail(res);
    }
}

function shareCurrentFilters() {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({ title: '小手找食', url: url });
    } else {
        navigator.clipboard.writeText(url);
        showToast('連結已複製');
    }
}

function shareRestaurant(res) {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({ title: res.name, url: url });
    } else {
        navigator.clipboard.writeText(url);
        showToast('連結已複製');
    }
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// Start the app
init();
