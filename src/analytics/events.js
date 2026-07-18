const PRIVATE_LOCATION_FIELDS = new Set(["lat", "lng", "address"]);

export function trackEvent(eventName, params = {}) {
    try {
        if (typeof window.gtag !== "function") return;

        const safeParams = Object.fromEntries(
            Object.entries(params).filter(([key]) => !PRIVATE_LOCATION_FIELDS.has(key)),
        );
        window.gtag("event", eventName, safeParams);
    } catch (error) {
        console.warn("Tracking failed", error);
    }
}
