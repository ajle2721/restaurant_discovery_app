$appJsPath = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\app.js"
$content = [System.IO.File]::ReadAllText($appJsPath, [System.Text.Encoding]::UTF8)

# Normalize CRLF to LF
$contentLf = $content.Replace("`r`n", "`n")

# Use single-quoted here-strings for literal matching (no escaping required!)
$old_block = @'
function refreshMapMarkers() {
    if (!state.map || !state.mapRestaurants) return;

    // Clear existing markers
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];
    state.markerMap = {};

    const colorMap = {
        'High': '#059669', '高': '#059669',
        'Medium': '#84cc16', '中': '#84cc16',
        'Needs Attention': '#dc2626', '需留意': '#dc2626',
        'Insufficient Info': '#94a3b8', '資訊不足': '#94a3b8',
        'Low Match': '#0284c7'
    };

    const isWholeCity = state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市');
    const zoom = state.map.getZoom();
    const mapBounds = state.map.getBounds();
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

    const usedCoords = new Map();

    const prominenceRanks = new Map();
    if (totalCount > 60) {
        // Sort restaurants by prominence score: reviews * rating + rating
        const sorted = [...state.mapRestaurants].sort((a, b) => {
            const scoreA = (a.user_ratings_total || 0) * (parseFloat(a.rating) || 0) + (parseFloat(a.rating) || 0);
            const scoreB = (b.user_ratings_total || 0) * (parseFloat(b.rating) || 0) + (parseFloat(b.rating) || 0);
            return scoreB - scoreA;
        });
        sorted.forEach((res, index) => {
            prominenceRanks.set(res.place_id, index);
        });
    }

    // 2. Filter mapRestaurants by zoom level and viewport bounds if count is large (> 60)
    const filteredRestaurants = state.mapRestaurants.filter(res => {
        if (!res.latitude || !res.longitude) return false;

        const status = getDynamicStatus(res, state.filters);
        const level = status.level;
        const isLowQuality = (level === 'Insufficient Info' || level === 'Needs Attention');

        // Apply global hideLowQualityMarkers toggle
        if (state.hideLowQualityMarkers && isLowQuality) return false;

        // Progressive filtering logic based on zoom levels (Google Maps style - prominence-based)
        if (totalCount > 60) {
            const rank = prominenceRanks.get(res.place_id);
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
                // Show all categories, but ONLY if they are within current map viewport bounds
                return mapBounds.contains([res.latitude, res.longitude]);
            }
        }
        return true;
    });
'@

$new_block = @'
function refreshMapMarkers() {
    if (!state.map || !state.mapRestaurants) return;

    // Clear existing markers
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];
    state.markerMap = {};

    const colorMap = {
        'High': '#059669', '高': '#059669',
        'Medium': '#84cc16', '中': '#84cc16',
        'Needs Attention': '#dc2626', '需留意': '#dc2626',
        'Insufficient Info': '#94a3b8', '資訊不足': '#94a3b8',
        'Low Match': '#0284c7'
    };

    const isWholeCity = state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市');
    const zoom = state.map.getZoom();
    const mapBounds = state.map.getBounds();
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

    const usedCoords = new Map();

    const prominenceRanks = new Map();
    if (totalCount > 60) {
        // Sort restaurants by prominence score: reviews * rating + rating
        const sorted = [...state.mapRestaurants].sort((a, b) => {
            const scoreA = (a.user_ratings_total || 0) * (parseFloat(a.rating) || 0) + (parseFloat(a.rating) || 0);
            const scoreB = (b.user_ratings_total || 0) * (parseFloat(b.rating) || 0) + (parseFloat(b.rating) || 0);
            return scoreB - scoreA;
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
'@

# Replace content
$cleanOld = $old_block.Replace("`r`n", "`n")
$cleanNew = $new_block.Replace("`r`n", "`n")

if ($contentLf.Contains($cleanOld)) {
    $contentLf = $contentLf.Replace($cleanOld, $cleanNew)
    Write-Output "Successfully matched and replaced map rendering logic!"
} else {
    Write-Warning "Could not find match for map rendering logic!"
}

# Restore CRLF
if ($contentLf.Contains("`n")) {
    $contentFinal = $contentLf.Replace("`n", "`r`n")
} else {
    $contentFinal = $contentLf
}

[System.IO.File]::WriteAllText($appJsPath, $contentFinal, [System.Text.Encoding]::UTF8)
Write-Host "Done!"
