import test from "node:test";
import assert from "node:assert/strict";
import { calculateDistance, calculateTravelTimes, formatDistance } from "../src/search/distance.js";

test("calculateDistance returns a stable Taipei-scale distance", () => {
    const distance = calculateDistance(25.0478, 121.5170, 25.0330, 121.5654);
    assert.ok(distance > 5 && distance < 6);
});

test("distance helpers handle missing and display values", () => {
    assert.equal(calculateDistance(null, 121, 25, 121), Infinity);
    assert.equal(formatDistance(0.42), "420m");
    assert.equal(formatDistance(1.25), "1.3km");
    assert.equal(calculateTravelTimes(Infinity), null);
    assert.deepEqual(calculateTravelTimes(1), { walking: 19, driving: 5, roadKm: "1.4" });
});
