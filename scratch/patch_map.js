const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldBlock = `    // 2. Filter mapRestaurants by zoom level and viewport bounds if count is large (> 60)
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
    });`;

const newBlock = `    // Pre-calculate top 60 viewport-contained markers at zoom >= 14 to prevent OOM / CPU crash
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
    });`;

// Normalize newlines to LF for replacement
content = content.replace(/\r\n/g, '\n');
const cleanOld = oldBlock.replace(/\r\n/g, '\n');
const cleanNew = newBlock.replace(/\r\n/g, '\n');

if (content.includes(cleanOld)) {
    content = content.replace(cleanOld, cleanNew);
    console.log("Successfully patched map rendering logic!");
} else {
    console.error("Could not find match in app.js!");
}

// Restore CRLF
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync('app.js', content, 'utf8');
