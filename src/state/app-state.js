import { safeSession } from "./storage.js";

export const state = {
    filters: new Set(),
    cuisineFilter: new Set(),
    priceFilter: new Set(),
    searchLocation: null,
    userLocation: null,
    lastGeographicLocation: null,
    selectedRestaurant: null,
    view: "home",
    map: null,
    markers: [],
    markerMap: {},
    locationData: [],
    showOthers: false,
    get hideLowQualityMarkers() {
        return !this.showOthers;
    },
    set hideLowQualityMarkers(value) {
        this.showOthers = !value;
    },
    currentResults: [],
    favorites: new Set(),
    viewTransitionTimeoutId: null,
    isUiNavigation: false,
    expandedRadius: false,
    recommendedLimit: 30,
    othersLimit: 30,
    viewedRestaurantIdsInSearch: new Set(),
    detailViews: new Set(JSON.parse(safeSession.getItem("pwa_detail_views") || "[]")),
};
