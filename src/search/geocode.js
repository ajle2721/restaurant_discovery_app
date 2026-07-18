export function isConfidentResult(result) {
    if (!result) return false;
    const c = result.class;
    const t = result.type;
    
    // 1. Roads and highways
    if (c === 'highway') return true;
    
    // 2. Administrative boundaries and districts
    if (c === 'boundary' || c === 'place') {
        const adminTypes = ['postcode', 'suburb', 'quarter', 'neighbourhood', 'district', 'city', 'town', 'village', 'county', 'municipality'];
        if (adminTypes.includes(t)) return true;
        
        // Specific house numbers or buildings
        const addressTypes = ['house', 'house_number', 'building', 'address', 'residential'];
        if (addressTypes.includes(t)) return true;
    }
    
    // 3. Public transport (stations)
    if (c === 'railway' && (t === 'station' || t === 'halt' || t === 'subway_entrance')) return true;
    
    // 4. Large public tourist destinations
    if (c === 'tourism' && ['zoo', 'aquarium', 'theme_park', 'museum', 'gallery', 'attraction', 'park'].includes(t)) return true;
    
    // 5. Civic / public amenities
    if (c === 'amenity' && ['park', 'hospital', 'university', 'school', 'college', 'library', 'townhall', 'courthouse', 'place_of_worship'].includes(t)) return true;
    
    // 6. Landuse
    if (c === 'landuse' && ['forest', 'grass', 'cemetery', 'park', 'recreation_ground', 'reservoir'].includes(t)) return true;
    
    return false;
}

// Geocode address via OSM Nominatim API with confidence check and automatic road fallback
export async function geocodeAddress(query, fetchImpl = fetch) {
    // Restrict search bounds to Taipei & New Taipei City
    const viewbox = "121.43,25.21,121.67,24.93";
    const getUrl = (q) => `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&viewbox=${viewbox}&bounded=1&addressdetails=1`;
    
    const fetchGeocode = async (q) => {
        try {
            const response = await fetchImpl(getUrl(q));
            if (!response.ok) {
                throw new Error('OSM Geocoding request failed');
            }
            const data = await response.json();
            if (data && data.length > 0) {
                return data[0];
            }
        } catch (err) {
            console.error('Nominatim Geocoding fetch error:', err);
        }
        return null;
    };

    // 1. Try original query
    let result = await fetchGeocode(query);
    if (result) {
        // Only accept if it is a confident public location/address
        if (isConfidentResult(result)) {
            return {
                name: query,
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                type: '自訂地點',
                resolvedAddress: result.display_name
            };
        } else {
            console.log(`OSM result is not confident (${result.class}/${result.type}). Rejecting to prevent misleading restaurant/POI location.`);
            return null;
        }
    }

    // 2. Fallback: Strip Taiwanese house numbers / floors / lane numbers at the end
    // E.g., "民生東路五段218號" -> "民生東路五段"
    let cleaned = query.replace(/\s*\d+([號樓fF]|之).*$/, '').trim();
    cleaned = cleaned.replace(/\s*\d+$/, '').trim(); // Remove raw trailing numbers

    if (cleaned && cleaned !== query) {
        console.log(`OSM geocoding fallback: retrying with "${cleaned}"`);
        result = await fetchGeocode(cleaned);
        if (result && isConfidentResult(result)) {
            return {
                name: query, // Keep original query for UI display
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                type: '自訂地點',
                isFallback: true,
                fallbackName: cleaned,
                resolvedAddress: result.display_name
            };
        }
    }

    return null;
}

export function isAddressLikeQuery(query) {
    const value = String(query || '').trim();
    if (!value) return false;
    return /[路街巷弄段大道橋區里鄰號樓]|台北|臺北|新北|\d/.test(value);
}

// Main custom search handler

