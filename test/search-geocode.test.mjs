import test from "node:test";
import assert from "node:assert/strict";
import {
    geocodeAddress,
    isAddressLikeQuery,
    isConfidentResult,
} from "../src/search/geocode.js";

function createFetch(results, requestedUrls = []) {
    return async (url) => {
        requestedUrls.push(url);
        const result = results.shift();
        return {
            ok: true,
            json: async () => result,
        };
    };
}

test("geocode confidence accepts public locations and rejects restaurant POIs", () => {
    assert.equal(isConfidentResult({ class: "highway", type: "residential" }), true);
    assert.equal(isConfidentResult({ class: "railway", type: "station" }), true);
    assert.equal(isConfidentResult({ class: "amenity", type: "restaurant" }), false);
});

test("geocoding maps a confident result to the app location shape", async () => {
    const fetchImpl = createFetch([[
        {
            class: "railway",
            type: "station",
            lat: "25.0478",
            lon: "121.5170",
            display_name: "台北車站",
        },
    ]]);
    assert.deepEqual(await geocodeAddress("台北車站", fetchImpl), {
        name: "台北車站",
        lat: 25.0478,
        lng: 121.517,
        type: "自訂地點",
        resolvedAddress: "台北車站",
    });
});

test("geocoding retries a missing house number as a road segment", async () => {
    const requestedUrls = [];
    const fetchImpl = createFetch([
        [],
        [{
            class: "highway",
            type: "residential",
            lat: "25.0600",
            lon: "121.5600",
            display_name: "民生東路五段",
        }],
    ], requestedUrls);

    const result = await geocodeAddress("民生東路五段218號", fetchImpl);
    assert.equal(result.isFallback, true);
    assert.equal(result.fallbackName, "民生東路五段");
    assert.equal(requestedUrls.length, 2);
    assert.match(decodeURIComponent(requestedUrls[1]), /民生東路五段/);
});

test("address-like detection separates addresses from restaurant keywords", () => {
    assert.equal(isAddressLikeQuery("台北市信義區松仁路 100 號"), true);
    assert.equal(isAddressLikeQuery("親子火鍋"), false);
});
