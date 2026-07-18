import { trackEvent } from "../analytics/events.js";
import { getPriceSymbolForLevels } from "./pricing.js";
import {
    fixSimplifiedAddress,
    formatAddressForCard,
    formatRestaurantName,
    formatStreetAddressForCard,
    getCardDistrict,
    getDisplaySummary,
    patchAiSummary,
} from "./presentation.js";
import { calculateDistance, calculateTravelTimes } from "../search/distance.js";
import {
    getDisplayPriceLevels,
    inferPriceLevel,
} from "../search/price-filter.js";
import { getDynamicStatus } from "../search/scoring.js";
import { state } from "../state/app-state.js";

export function createRestaurantCardRenderer({
    focusOnMap,
    getPFSummaryTags,
    getRestaurantEventParams,
    recordRestaurantDetailView,
    showDetail,
    toggleFavorite,
}) {
    function renderCard(res, container) {
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

    return { renderCard };
}
