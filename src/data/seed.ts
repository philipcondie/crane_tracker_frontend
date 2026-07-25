/**
 * Fallback map view used before we know anything about the user: no deep-link
 * coords and geolocation hasn't resolved (or was denied/unavailable). Users live
 * all over, so any single city would be wrong for most of them — a continental
 * US overview is never "wrong", just neutral, and geolocation flies in from here.
 */
export const US_OVERVIEW_CENTER: [number, number] = [39.8, -98.6]
export const US_OVERVIEW_ZOOM = 4
