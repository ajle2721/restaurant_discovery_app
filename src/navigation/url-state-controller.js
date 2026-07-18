import { restaurantData } from "../data/restaurant-index.js";
import { state } from "../state/app-state.js";
import { safeSession } from "../state/storage.js";
import { buildShareUrl, urlMatchesState } from "./url-state.js";

export function createUrlStateController({
    renderDetailContent,
    renderShortlistDrawer,
    saveFavorites,
    selectLocation,
    switchView,
    updateCuisineFilterUI,
    updateQuickLinksUI,
    updateShortlistUI,
}) {
    function getShareUrl() {
        return buildShareUrl(state, window.location);
    }

    function updateUrl(push = false) {
        const newUrl = getShareUrl();
        if (push) {
            if (
                window.location.href === newUrl
                && window.history.state
                && window.history.state.view === state.view
            ) {
                return;
            }
            window.history.pushState({ view: state.view }, '', newUrl);
            return;
        }
        window.history.replaceState({ view: state.view }, '', newUrl);
    }

    function openSharedShortlist(favoritesParameter) {
        const sessionKey = `shortlist_auto_opened_${favoritesParameter}`;
        if (safeSession.getItem(sessionKey)) return;
        safeSession.setItem(sessionKey, 'true');

        const openDrawer = () => {
            const drawer = document.getElementById('shortlist-drawer');
            const overlay = document.getElementById('shortlist-drawer-overlay');
            if (!drawer || !overlay) return;
            drawer.classList.add('active');
            overlay.classList.add('active');
            renderShortlistDrawer();
        };

        if (document.readyState === 'complete') {
            openDrawer();
        } else {
            window.addEventListener('load', openDrawer, { once: true });
        }
    }

    function restoreSharedFavorites(params, isInitialLoad) {
        const favoritesParameter = params.get('favs');
        if (!favoritesParameter) return;

        let loadedAny = false;
        favoritesParameter.split(',').forEach(id => {
            if (id && restaurantData.some(restaurant => restaurant.place_id === id)) {
                state.favorites.add(id);
                loadedAny = true;
            }
        });

        if (!loadedAny) return;
        saveFavorites();
        updateShortlistUI();
        if (isInitialLoad) openSharedShortlist(favoritesParameter);
    }

    function restoreFilters(params) {
        state.filters.clear();
        params.getAll('f').forEach(filter => state.filters.add(filter));
        document.querySelectorAll('.filter-chip:not(.price-chip)').forEach(chip => {
            chip.classList.toggle('active', state.filters.has(chip.dataset.filter));
        });

        state.cuisineFilter.clear();
        params.getAll('cuisine').forEach(cuisine => state.cuisineFilter.add(cuisine));
        updateCuisineFilterUI({ expand: false });

        state.priceFilter.clear();
        params.getAll('price').forEach(price => state.priceFilter.add(price));
        document.querySelectorAll('.price-chip').forEach(chip => {
            chip.classList.toggle('active', state.priceFilter.has(chip.dataset.price));
        });
    }

    function restoreMultiLocation(locationName) {
        if (!locationName || !locationName.includes('、')) return;

        const matchedLocations = locationName
            .split('、')
            .map(name => state.locationData.find(location => location.name === name))
            .filter(Boolean);
        if (matchedLocations.length <= 1) return;

        const allDistricts = matchedLocations.every(location => location.type === '行政區');
        const latitude = matchedLocations.reduce((sum, location) => sum + location.lat, 0)
            / matchedLocations.length;
        const longitude = matchedLocations.reduce((sum, location) => sum + location.lng, 0)
            / matchedLocations.length;
        const multiLocation = {
            name: locationName,
            type: allDistricts ? '多行政區' : '多地點',
            locations: matchedLocations,
            districts: allDistricts ? matchedLocations.map(location => location.name) : [],
            lat: latitude,
            lng: longitude,
        };

        if (!state.locationData.some(location => location.name === locationName)) {
            state.locationData.push(multiLocation);
        }
    }

    function selectRestoredLocation(location) {
        if (document.readyState === 'complete') {
            selectLocation(location, 'url_sync', false);
        } else {
            window.addEventListener(
                'load',
                () => selectLocation(location, 'url_sync', false),
                { once: true },
            );
        }
    }

    function restoreLocation(params) {
        const locationName = params.get('loc');
        restoreMultiLocation(locationName);

        const latitude = params.get('lat');
        const longitude = params.get('lng');
        if (latitude && longitude) {
            let locationType = '分享位置';
            const urlLocationType = params.get('locType');
            if (urlLocationType === 'restaurant') {
                locationType = '特定餐廳';
            } else if (urlLocationType === 'keyword') {
                locationType = '關鍵字搜尋';
            }

            const matchedLocation = state.locationData.find(location => location.name === locationName);
            if (matchedLocation) locationType = matchedLocation.type;

            selectRestoredLocation({
                name: locationName || '分享的位置',
                lat: parseFloat(latitude),
                lng: parseFloat(longitude),
                type: locationType,
                isFallback: params.get('isFallback') === '1',
                fallbackName: params.get('fbName'),
                resolvedAddress: params.get('addr'),
                keyword: params.get('keyword') || undefined,
            });
            return true;
        }

        if (locationName) {
            const location = state.locationData.find(item => item.name === locationName);
            if (location) {
                selectRestoredLocation(location);
                return true;
            }
        }
        return false;
    }

    function showLandingPage() {
        state.searchLocation = null;
        state.userLocation = null;
        state.showOthers = false;

        document.getElementById('location-search').value = '';
        document.getElementById('clear-search').classList.add('hidden');
        document.getElementById('search-results-view').classList.add('hidden');
        document.getElementById('float-share')?.classList.add('hidden');
        document.getElementById('clear-all-filters')?.classList.add('hidden');

        state.cuisineFilter.clear();
        updateCuisineFilterUI({ expand: false });
        state.priceFilter.clear();
        document.querySelectorAll('.price-chip').forEach(chip => chip.classList.remove('active'));

        document.querySelector('.trending-section')?.classList.remove('hidden');
        document.querySelector('.features-section')?.classList.remove('hidden');
        document.querySelector('.main-header').style.display = 'block';
        document.getElementById('home-view').classList.remove('search-active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        updateQuickLinksUI();
    }

    function restoreDetail(params, animate) {
        const restaurantId = params.get('r');
        const restaurant = restaurantId
            ? restaurantData.find(item => item.place_id === restaurantId)
            : null;

        if (restaurant) {
            state.selectedRestaurant = restaurant;
            renderDetailContent(restaurant);
            switchView('detail', animate);
            return;
        }
        switchView('home', animate);
    }

    function syncStateFromUrl(isInitialLoad = false, animate = false) {
        const params = new URLSearchParams(window.location.search);
        restoreSharedFavorites(params, isInitialLoad);

        if (!urlMatchesState(params, state)) {
            state.recommendedLimit = 30;
            state.othersLimit = 30;
            restoreFilters(params);
            if (!restoreLocation(params)) showLandingPage();
        }

        restoreDetail(params, animate);
    }

    return {
        getShareUrl,
        syncStateFromUrl,
        updateUrl,
    };
}
