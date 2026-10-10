/**
 * Typed routing domain model.
 *
 * These types are the stable contract between the UI and any routing
 * provider. The current implementation is mock data; a real routing API
 * (e.g. OSRM, Valhalla, OpenRouteService) can later be swapped in behind
 * the same interface without touching the UI.
 */

/** Geographic coordinate as [latitude, longitude]. */
export type LatLng = [number, number];

export type TravelMode = "walk" | "cycle" | "drive";

export interface RouteRequest {
  origin: string;
  destination: string;
  travelMode: TravelMode;
}

export interface RouteData {
  /** Stable identifier for the route option. */
  id: string;
  /** Total distance in meters. */
  distanceMeters: number;
  /** Total travel duration in seconds. */
  durationSeconds: number;
  /** Ordered path coordinates (polyline) for map rendering. */
  coordinates: LatLng[];
  /** Start point of the route. */
  startPoint: LatLng;
  /** End point of the route. */
  endPoint: LatLng;
}

/**
 * Routing provider contract. Implementations must be pure data sources:
 * they receive a request and return typed routes. UI code depends only on
 * this interface, never on a concrete provider.
 */
export interface RoutingService {
  getRoutes(request: RouteRequest): Promise<RouteData[]>;
}
