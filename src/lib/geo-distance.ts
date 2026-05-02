export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceInMeters(origin: GeoPoint, target: GeoPoint): number {
  const originLat = toRadians(origin.latitude);
  const targetLat = toRadians(target.latitude);
  const deltaLat = toRadians(target.latitude - origin.latitude);
  const deltaLng = toRadians(target.longitude - origin.longitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(deltaLng / 2) ** 2;

  return Math.round(
    EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)),
  );
}

export function isWithinRadius(origin: GeoPoint, target: GeoPoint, radiusMeters: number): boolean {
  return distanceInMeters(origin, target) <= radiusMeters;
}
