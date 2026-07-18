import { trackEvent } from "../analytics/events.js";
import { restaurantData } from "../data/restaurant-index.js";
import {
    formatRestaurantName,
    getDisplaySummary,
    patchAiSummary,
} from "../restaurants/presentation.js";
import { calculateDistance, calculateTravelTimes } from "../search/distance.js";
import { state } from "../state/app-state.js";
import { safeLocal } from "../state/storage.js";

export function createShortlistController({ getDynamicStatus, showToast, updateUrl }) {
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
        trackEvent('open_shortlist_compare_modal', {
            shortlist_count: state.favorites.size
        });
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
                    res.ai_summary = patchAiSummary(res, res.ai_summary, { maxSentences: 4, maxChars: 360 });
                    res._ai_summary_patched = true;
                }
                if (res.card_summary && !res._card_summary_patched) {
                    res.card_summary = patchAiSummary(res, res.card_summary, { maxSentences: 3, maxChars: 220 });
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
                const roomVal = attrs.has_private_room;
                if (roomVal === 'yes' || roomVal === 'room' || roomVal === 'venue' || roomVal === 'likely' || roomVal === 'likely_room' || roomVal === 'likely_venue') {
                    const isLikely = roomVal.startsWith('likely');
                    ams.push('🚪包廂或可包場' + (isLikely ? '(估)' : ''));
                }
                const amsText = ams.length > 0 ? ams.join(' · ') : '暫無特徵標籤';

                listHtml += `
                    <div class="shortlist-card" style="cursor: pointer;" onclick="window.showDetailFromMap('${res.place_id}')">
                        <div class="shortlist-info">
                            <div class="shortlist-name-row">
                                <span class="shortlist-name">${formatRestaurantName(res.name)}</span>
                            </div>
                            <div class="shortlist-summary">${getDisplaySummary(res, res.card_summary || res.ai_summary, { maxSentences: 3, maxChars: 180 })}</div>
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
                const isRoomPositive = ['yes', 'room', 'venue'].includes(attrs.has_private_room);
                const isRoomLikely = ['likely', 'likely_room', 'likely_venue'].includes(attrs.has_private_room);
                const room = isRoomPositive ? checkIcon : (isRoomLikely ? checkLikelyIcon : (attrs.has_private_room === 'no' ? crossGeneralIcon : unknownIcon));

                const isWholeCity = state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市' || state.searchLocation.type === '多行政區');
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

    return {
        closeComparisonModal,
        loadFavorites,
        openComparisonModal,
        renderShortlistDrawer,
        saveFavorites,
        syncComparisonExpandButton,
        toggleFavorite,
        updateShortlistUI,
    };
}
