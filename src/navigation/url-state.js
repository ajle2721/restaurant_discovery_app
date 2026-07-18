export function buildShareUrl(appState, location) {
    const params = new URLSearchParams();
    const searchLocation = appState.searchLocation;

    if (searchLocation) {
        params.set('loc', searchLocation.name);
        if (searchLocation.lat && searchLocation.lng) {
            params.set('lat', searchLocation.lat.toFixed(6));
            params.set('lng', searchLocation.lng.toFixed(6));
        }
        if (searchLocation.isFallback) {
            params.set('isFallback', '1');
            params.set('fbName', searchLocation.fallbackName);
        }
        if (searchLocation.resolvedAddress) {
            params.set('addr', searchLocation.resolvedAddress);
        }
        if (searchLocation.type === '特定餐廳' || searchLocation.place_id) {
            params.set('locType', 'restaurant');
        } else if (searchLocation.type === '關鍵字搜尋') {
            params.set('locType', 'keyword');
            if (searchLocation.keyword) params.set('keyword', searchLocation.keyword);
        }
    }

    appState.filters.forEach(filter => params.append('f', filter));
    appState.cuisineFilter.forEach(cuisine => params.append('cuisine', cuisine));
    appState.priceFilter.forEach(price => params.append('price', price));

    if (appState.view === 'detail' && appState.selectedRestaurant) {
        params.set('r', appState.selectedRestaurant.place_id);
    }
    if (appState.favorites && appState.favorites.size > 0) {
        params.set('favs', Array.from(appState.favorites).join(','));
    }

    const queryString = params.toString();
    return `${location.origin}${location.pathname}${queryString ? `?${queryString}` : ''}`;
}

export function urlMatchesState(params, appState) {
    const locationName = params.get('loc');
    const latitude = params.get('lat');
    const longitude = params.get('lng');
    const hasUrlLocation = Boolean(locationName);
    const hasStateLocation = Boolean(appState.searchLocation);

    if (hasUrlLocation !== hasStateLocation) return false;
    if (hasUrlLocation) {
        if (appState.searchLocation.name !== locationName) return false;
        if (latitude && appState.searchLocation.lat) {
            if (Math.abs(appState.searchLocation.lat - parseFloat(latitude)) > 0.0001) return false;
        }
        if (longitude && appState.searchLocation.lng) {
            if (Math.abs(appState.searchLocation.lng - parseFloat(longitude)) > 0.0001) return false;
        }
    }

    const setParametersMatch = (parameterName, values) => {
        const urlValues = params.getAll(parameterName);
        return urlValues.length === values.size && urlValues.every(value => values.has(value));
    };

    return setParametersMatch('f', appState.filters)
        && setParametersMatch('cuisine', appState.cuisineFilter)
        && setParametersMatch('price', appState.priceFilter);
}
