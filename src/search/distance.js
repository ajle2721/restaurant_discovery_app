export function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;

    const earthRadiusKm = 6371;
    const latitudeDelta = (lat2 - lat1) * Math.PI / 180;
    const longitudeDelta = (lon2 - lon1) * Math.PI / 180;
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
        * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function calculateTravelTimes(distanceKm) {
    if (distanceKm === Infinity || Number.isNaN(distanceKm)) return null;

    const roadDistanceKm = distanceKm * 1.45;
    return {
        walking: Math.round((roadDistanceKm / 4.5) * 60),
        driving: Math.round((roadDistanceKm / 20) * 60) + 1,
        roadKm: roadDistanceKm.toFixed(1),
    };
}

export function formatDistance(distanceKm) {
    if (distanceKm === Infinity) return "";
    if (distanceKm < 1) return `${(distanceKm * 1000).toFixed(0)}m`;
    return `${distanceKm.toFixed(1)}km`;
}
