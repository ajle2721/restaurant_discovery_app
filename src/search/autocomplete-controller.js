import { trackEvent } from "../analytics/events.js";
import { restaurantData } from "../data/restaurant-index.js";
import { formatRestaurantName } from "../restaurants/presentation.js";
import { state } from "../state/app-state.js";
import { getSearchableText } from "./cuisine-filter.js";
import { geocodeAddress, isAddressLikeQuery } from "./geocode.js";

export function createAutocompleteController({
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
}) {
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
    
        // Support searching multiple locations (districts, MRT stations, or landmarks) at once
        const tokens = query.split(/[\s,、，]+/);
        const matchedLocations = [];
        tokens.forEach(tok => {
            const t = tok.trim().toLowerCase();
            if (!t) return;
            const match = state.locationData.find(loc => {
                const nameLower = loc.name.toLowerCase();
                return nameLower === t || 
                       nameLower.replace('區', '') === t || 
                       nameLower.replace('站', '') === t ||
                       (loc.keywords && loc.keywords.some(k => k.toLowerCase() === t));
            });
            if (match && !matchedLocations.some(l => l.name === match.name)) {
                matchedLocations.push(match);
            }
        });
    
        if (matchedLocations.length > 1) {
            const multiName = matchedLocations.map(l => l.name).join('、');
            let sumLat = 0, sumLng = 0, count = 0;
            matchedLocations.forEach(loc => {
                sumLat += loc.lat;
                sumLng += loc.lng;
                count++;
            });
            const avgLat = count > 0 ? sumLat / count : 25.0374;
            const avgLng = count > 0 ? sumLng / count : 121.5645;
            
            const allDistricts = matchedLocations.every(l => l.type === '行政區');
            const multiLocType = allDistricts ? '多行政區' : '多地點';
    
            const multiLocationObj = {
                name: multiName,
                type: multiLocType,
                locations: matchedLocations,
                districts: allDistricts ? matchedLocations.map(l => l.name) : [],
                lat: avgLat,
                lng: avgLng
            };
            if (!state.locationData.some(l => l.name === multiName)) {
                state.locationData.push(multiLocationObj);
            }
            locationMatches.unshift(multiLocationObj);
        }
    
        // 2. Filter restaurant matches (matching name, cuisine, address, or district)
        let restaurantMatches = [];
        if (typeof restaurantData !== 'undefined') {
            restaurantMatches = restaurantData.filter(res => {
                return (res.name && res.name.toLowerCase().includes(query)) ||
                       (res.cuisine && res.cuisine.toLowerCase().includes(query)) ||
                       (getSearchableText(res.cuisine_group).toLowerCase().includes(query)) ||
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
                            trackSearchLocation('autocomplete_restaurant', res.name);
                            const customLoc = {
                                name: res.name,
                                lat: res.latitude,
                                lng: res.longitude,
                                type: '特定餐廳',
                                place_id: res.place_id
                            };
                            selectLocation(customLoc, 'autocomplete_restaurant');
                            const viewedCount = recordRestaurantDetailView(res);
                            trackEvent('view_restaurant_detail', {
                                ...getRestaurantEventParams(res, 'autocomplete_restaurant'),
                                viewed_restaurant_count: viewedCount
                            });
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
    
    async function executeSearch(query) {
        if (!query) return;
    
        trackSearchLocation('keyword', query);
    
        // Support manual search of multiple locations
        const tokens = query.split(/[\s,、，]+/);
        const matchedLocations = [];
        tokens.forEach(tok => {
            const t = tok.trim().toLowerCase();
            if (!t) return;
            const match = state.locationData.find(loc => {
                const nameLower = loc.name.toLowerCase();
                return nameLower === t || 
                       nameLower.replace('區', '') === t || 
                       nameLower.replace('站', '') === t ||
                       (loc.keywords && loc.keywords.some(k => k.toLowerCase() === t));
            });
            if (match && !matchedLocations.some(l => l.name === match.name)) {
                matchedLocations.push(match);
            }
        });
    
        if (matchedLocations.length > 1) {
            const multiName = matchedLocations.map(l => l.name).join('、');
            let sumLat = 0, sumLng = 0, count = 0;
            matchedLocations.forEach(loc => {
                sumLat += loc.lat;
                sumLng += loc.lng;
                count++;
            });
            const avgLat = count > 0 ? sumLat / count : 25.0374;
            const avgLng = count > 0 ? sumLng / count : 121.5645;
            
            const allDistricts = matchedLocations.every(l => l.type === '行政區');
            const multiLocType = allDistricts ? '多行政區' : '多地點';
    
            const multiLocationObj = {
                name: multiName,
                type: multiLocType,
                locations: matchedLocations,
                districts: allDistricts ? matchedLocations.map(l => l.name) : [],
                lat: avgLat,
                lng: avgLng
            };
            if (!state.locationData.some(l => l.name === multiName)) {
                state.locationData.push(multiLocationObj);
            }
            selectLocation(multiLocationObj, 'manual_input');
            return;
        }
    
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
                (getSearchableText(res.cuisine_group).toLowerCase().includes(q)) ||
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

    return {
        executeSearch,
        handleAutocomplete,
    };
}

