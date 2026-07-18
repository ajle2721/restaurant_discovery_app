import { trackEvent } from "../analytics/events.js";
import { restaurantData } from "../data/restaurant-index.js";
import {
    fixSimplifiedAddress,
    formatRestaurantName,
} from "../restaurants/presentation.js";
import { calculateTravelTimes } from "../search/distance.js";
import { state } from "../state/app-state.js";

export function createLeafletMapController({
    getDynamicStatus,
    getParentFriendlyBaseScore,
    getRestaurantEventParams,
    recordRestaurantDetailView,
    showDetail,
    throttle,
}) {
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
        
        const isWholeCity = state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市' || state.searchLocation.type === '捷運站周邊' || state.searchLocation.type === '多行政區' || state.searchLocation.type === '多地點');
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
        const isWholeCity = state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市' || state.searchLocation.type === '捷運站周邊' || state.searchLocation.type === '多行政區' || state.searchLocation.type === '多地點');
        
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
    
        // Render searched locations if "多地點" is active
        if (state.searchLocation && state.searchLocation.type === '多地點') {
            state.searchLocation.locations.forEach(loc => {
                if (loc.type === '捷運站' || loc.name.endsWith('站')) {
                    const mrtIcon = L.divIcon({
                        html: `<div class="mrt-marker-inner" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.45)); cursor: pointer;" title="${loc.name}">
                                 <svg viewBox="0 0 100 100" width="32" height="32" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                                   <g transform="translate(13, 10) scale(1.3)">
                                     <g stroke="#ffffff" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" fill="#ffffff">
                                       <path d="M0,17.973L2.927,14.258C4.063,12.815 5.74,11.982 7.508,11.982L9.418,11.982C11.186,11.982 12.864,11.149 14,9.706L19.853,2.276C20.989,0.833 22.666,0 24.434,0L44.109,0L41.183,3.715C40.047,5.158 38.369,5.991 36.602,5.991L34.691,5.991C32.923,5.991 31.246,6.824 30.11,8.267L24.257,15.697C23.12,17.14 21.443,17.973 19.675,17.973L0,17.973Z"/>
                                       <path d="M0,17.973L2.927,14.258C4.063,12.815 5.74,11.982 7.508,11.982L9.418,11.982C11.186,11.982 12.864,11.149 14,9.706L19.853,2.276C20.989,0.833 22.666,0 24.434,0L44.109,0L41.183,3.715C40.047,5.158 38.369,5.991 36.602,5.991L34.691,5.991C32.923,5.991 31.246,6.824 30.11,8.267L24.257,15.697C23.12,17.14 21.443,17.973 19.675,17.973L0,17.973Z" transform="translate(13.026, 11.985)"/>
                                     </g>
                                     <path d="M0,17.973L2.927,14.258C4.063,12.815 5.74,11.982 7.508,11.982L9.418,11.982C11.186,11.982 12.864,11.149 14,9.706L19.853,2.276C20.989,0.833 22.666,0 24.434,0L44.109,0L41.183,3.715C40.047,5.158 38.369,5.991 36.602,5.991L34.691,5.991C32.923,5.991 31.246,6.824 30.11,8.267L24.257,15.697C23.12,17.14 21.443,17.973 19.675,17.973L0,17.973Z" fill="#4bb748"/>
                                     <path d="M0,17.973L2.927,14.258C4.063,12.815 5.74,11.982 7.508,11.982L9.418,11.982C11.186,11.982 12.864,11.149 14,9.706L19.853,2.276C20.989,0.833 22.666,0 24.434,0L44.109,0L41.183,3.715C40.047,5.158 38.369,5.991 36.602,5.991L34.691,5.991C32.923,5.991 31.246,6.824 30.11,8.267L24.257,15.697C23.12,17.14 21.443,17.973 19.675,17.973L0,17.973Z" fill="#0079a9" transform="translate(13.026, 11.985)"/>
                                   </g>
                                 </svg>
                               </div>`,
                        className: 'mrt-marker-outer',
                        iconSize: [32, 20],
                        iconAnchor: [16, 10]
                    });
                    const mrtMarker = L.marker([loc.lat, loc.lng], {
                        icon: mrtIcon,
                        interactive: true
                    }).addTo(state.map);
                    mrtMarker.bindPopup(`<strong style="color: #2563eb; font-size: 0.9rem;">🚇 ${loc.name}</strong>`);
                    state.markers.push(mrtMarker);
                } else if (loc.type !== '行政區') {
                    const centerIcon = L.divIcon({
                        html: `<div class="search-center-marker-inner" style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" style="display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                                   <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
                                   <circle cx="12" cy="9" r="3.2" fill="#7A1E1A"/>
                                 </svg>
                               </div>`,
                        className: 'search-center-marker-outer',
                        iconSize: [30, 30],
                        iconAnchor: [15, 27]
                    });
                    const centerMarker = L.marker([loc.lat, loc.lng], {
                        icon: centerIcon,
                        interactive: true
                    }).addTo(state.map);
                    centerMarker.bindPopup(`<strong style="color: var(--primary); font-size: 0.9rem;">📍 ${loc.name}</strong>`);
                    state.markers.push(centerMarker);
                }
            });
        }
    
        // Render MRT Station Markers if "捷運站周邊" is active
        if (state.searchLocation && state.searchLocation.type === '捷運站周邊') {
            const mrtStations = state.locationData.filter(l => l.type === '捷運站' || l.name.endsWith('站'));
            mrtStations.forEach(mrt => {
                const mrtIcon = L.divIcon({
                    html: `<div class="mrt-marker-inner" style="width: 38px; height: 23px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.45)); cursor: pointer;" title="${mrt.name}">
                             <svg viewBox="0 0 100 60" width="38" height="23" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                               <!-- White silhouette backing to ensure contrast on any map background -->
                               <g transform="translate(13, 10) scale(1.3)">
                                 <g stroke="#ffffff" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" fill="#ffffff">
                                   <path d="M0,17.973L2.927,14.258C4.063,12.815 5.74,11.982 7.508,11.982L9.418,11.982C11.186,11.982 12.864,11.149 14,9.706L19.853,2.276C20.989,0.833 22.666,0 24.434,0L44.109,0L41.183,3.715C40.047,5.158 38.369,5.991 36.602,5.991L34.691,5.991C32.923,5.991 31.246,6.824 30.11,8.267L24.257,15.697C23.12,17.14 21.443,17.973 19.675,17.973L0,17.973Z"/>
                                   <path d="M0,17.973L2.927,14.258C4.063,12.815 5.74,11.982 7.508,11.982L9.418,11.982C11.186,11.982 12.864,11.149 14,9.706L19.853,2.276C20.989,0.833 22.666,0 24.434,0L44.109,0L41.183,3.715C40.047,5.158 38.369,5.991 36.602,5.991L34.691,5.991C32.923,5.991 31.246,6.824 30.11,8.267L24.257,15.697C23.12,17.14 21.443,17.973 19.675,17.973L0,17.973Z" transform="translate(13.026, 11.985)"/>
                                 </g>
                                 <!-- Colored TRTC wings: Green (top/left) and Blue (bottom/right) -->
                                 <path d="M0,17.973L2.927,14.258C4.063,12.815 5.74,11.982 7.508,11.982L9.418,11.982C11.186,11.982 12.864,11.149 14,9.706L19.853,2.276C20.989,0.833 22.666,0 24.434,0L44.109,0L41.183,3.715C40.047,5.158 38.369,5.991 36.602,5.991L34.691,5.991C32.923,5.991 31.246,6.824 30.11,8.267L24.257,15.697C23.12,17.14 21.443,17.973 19.675,17.973L0,17.973Z" fill="#4bb748"/>
                                 <path d="M0,17.973L2.927,14.258C4.063,12.815 5.74,11.982 7.508,11.982L9.418,11.982C11.186,11.982 12.864,11.149 14,9.706L19.853,2.276C20.989,0.833 22.666,0 24.434,0L44.109,0L41.183,3.715C40.047,5.158 38.369,5.991 36.602,5.991L34.691,5.991C32.923,5.991 31.246,6.824 30.11,8.267L24.257,15.697C23.12,17.14 21.443,17.973 19.675,17.973L0,17.973Z" fill="#0079a9" transform="translate(13.026, 11.985)"/>
                               </g>
                             </svg>
                           </div>`,
                    className: 'mrt-marker-outer',
                    iconSize: [38, 23],
                    iconAnchor: [19, 11.5]
                });
                const mrtMarker = L.marker([mrt.lat, mrt.lng], {
                    icon: mrtIcon,
                    interactive: true
                }).addTo(state.map);
                mrtMarker.bindPopup(`<strong style="color: #2563eb; font-size: 0.9rem;">🚇 ${mrt.name}</strong>`);
                state.markers.push(mrtMarker);
            });
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
                
                const times = (state.searchLocation && state.searchLocation.type !== '全市' && state.searchLocation.name !== '整個台北市' && state.searchLocation.type !== '多行政區' && res.distance) ? calculateTravelTimes(res.distance) : null;
    
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
            const viewedCount = recordRestaurantDetailView(res);
            trackEvent('view_restaurant_detail', {
                ...getRestaurantEventParams(res, 'map_card'),
                viewed_restaurant_count: viewedCount
            });
            showDetail(res);
        }
    };
    
    return {
        initMap,
        refreshMapMarkers,
        renderMap,
    };
}
