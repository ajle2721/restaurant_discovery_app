import test from "node:test";
import assert from "node:assert/strict";
import {
    buildShareUrl,
    urlMatchesState,
} from "../src/navigation/url-state.js";

function createState(overrides = {}) {
    return {
        searchLocation: null,
        filters: new Set(),
        cuisineFilter: new Set(),
        priceFilter: new Set(),
        favorites: new Set(),
        selectedRestaurant: null,
        view: 'home',
        ...overrides,
    };
}

test("share URLs retain location, filters, detail, and shortlist state", () => {
    const appState = createState({
        searchLocation: {
            name: '信義區',
            lat: 25.033,
            lng: 121.5654,
            type: '行政區',
        },
        filters: new Set(['high_chair_available']),
        cuisineFilter: new Set(['日式料理']),
        priceFilter: new Set(['PRICE_LEVEL_MODERATE']),
        favorites: new Set(['place-a', 'place-b']),
        selectedRestaurant: { place_id: 'place-a' },
        view: 'detail',
    });

    const url = new URL(buildShareUrl(appState, {
        origin: 'https://example.com',
        pathname: '/restaurants/',
    }));

    assert.equal(url.pathname, '/restaurants/');
    assert.equal(url.searchParams.get('loc'), '信義區');
    assert.equal(url.searchParams.get('lat'), '25.033000');
    assert.deepEqual(url.searchParams.getAll('f'), ['high_chair_available']);
    assert.deepEqual(url.searchParams.getAll('cuisine'), ['日式料理']);
    assert.deepEqual(url.searchParams.getAll('price'), ['PRICE_LEVEL_MODERATE']);
    assert.equal(url.searchParams.get('r'), 'place-a');
    assert.equal(url.searchParams.get('favs'), 'place-a,place-b');
});

test("URL matching compares location coordinates and every filter set", () => {
    const appState = createState({
        searchLocation: { name: '信義區', lat: 25.033, lng: 121.5654 },
        filters: new Set(['high_chair_available']),
        cuisineFilter: new Set(['日式料理']),
        priceFilter: new Set(['PRICE_LEVEL_MODERATE']),
    });
    const matching = new URLSearchParams(
        'loc=信義區&lat=25.033000&lng=121.565400&f=high_chair_available'
        + '&cuisine=日式料理&price=PRICE_LEVEL_MODERATE',
    );
    const missingCuisine = new URLSearchParams(
        'loc=信義區&lat=25.033000&lng=121.565400&f=high_chair_available'
        + '&price=PRICE_LEVEL_MODERATE',
    );

    assert.equal(urlMatchesState(matching, appState), true);
    assert.equal(urlMatchesState(missingCuisine, appState), false);
});
