// State Management
const state = {
    filters: new Set(),
    selectedRestaurant: null,
    view: 'home'
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
    kid_noise_tolerant: '童噪友善'
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

    // Navigation
    backHomeBtn.addEventListener('click', () => switchView('home'));

    // Sharing
    floatShareBtn.addEventListener('click', shareCurrentFilters);
    shareResultsBtn.addEventListener('click', shareCurrentFilters);
    detailShareBtn.addEventListener('click', () => {
        if (state.selectedRestaurant) {
            shareRestaurant(state.selectedRestaurant);
        }
    });
}

function renderList() {
    restaurantList.innerHTML = '';

    const filteredData = restaurantData.filter(res => {
        if (state.filters.size === 0) return true;
        return Array.from(state.filters).every(f => res.attributes[f] === true);
    });

    if (filteredData.length === 0) {
        renderEmptyState();
        return;
    }

    filteredData.forEach(res => {
        const card = document.createElement('div');
        card.className = 'restaurant-card';

        let tagsHtml = '';
        Object.keys(res.attributes).forEach(attr => {
            if (res.attributes[attr]) {
                tagsHtml += `<span class="tag"><span>${attributeIcons[attr]}</span> ${attributeLabels[attr]}</span>`;
            }
        });

        card.innerHTML = `
            <div class="restaurant-name">${res.name}</div>
            <div class="restaurant-rating">⭐ ${res.rating}</div>
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
            window.open(res.url, '_blank');
        });

        card.addEventListener('click', () => showDetail(res));

        restaurantList.appendChild(card);
    });
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

window.clearFilters = () => {
    state.filters.clear();
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    renderList();
    updateUrl();
};

function showDetail(restaurant) {
    state.selectedRestaurant = restaurant;

    let tagsHtml = '';
    Object.keys(restaurant.attributes).forEach(attr => {
        if (restaurant.attributes[attr]) {
            tagsHtml += `<span class="tag" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;"><span>${attributeIcons[attr]}</span> ${attributeLabels[attr]}</span>`;
        }
    });

    let signalsHtml = '';
    if (restaurant.signals && restaurant.signals.length > 0) {
        signalsHtml = `
            <div style="font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-muted);">根據評論提及：</div>
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
            <div class="ai-summary-title">✨ 小手 AI 評價摘要</div>
            <div class="ai-summary-text">${restaurant.ai_summary}</div>
        </div>

        ${signalsHtml}

        <button class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 1.125rem; font-size: 1rem;" onclick="window.open('${restaurant.url}', '_blank')">
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

init();
