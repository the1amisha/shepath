import type { LatLng, RouteData, RouteRequest, RoutingService } from "./types";

/**
 * Mock routing provider.
 *
 * Returns fixed illustrative Ranchi routes. These are mock geometries, not
 * verified walking routes. Requests return the same demo data. Replace this class
 * with a real API-backed implementation later — the RoutingService contract
 * and the UI stay unchanged.
 */

export type MockRouteId = "recommended" | "quick" | "calm";

const START: LatLng = [23.3700, 85.3250]; // Approximate Albert Ekka Chowk, Ranchi demo anchor
const END: LatLng = [23.3490, 85.3356]; // Approximate Ranchi Railway Station demo anchor

const mockRoutes: Record<MockRouteId, RouteData> = {
  recommended: {
    id: "recommended",
    distanceMeters: 1700,
    durationSeconds: 22 * 60,
    coordinates: [
      [23.3700, 85.3250],
      [23.3670, 85.3280],
      [23.3610, 85.3310],
      [23.3550, 85.3330],
      [23.3490, 85.3356],
    ],
    startPoint: START,
    endPoint: END,
  },
  quick: {
    id: "quick",
    distanceMeters: 1400,
    durationSeconds: 18 * 60,
    coordinates: [
      [23.3700, 85.3250],
      [23.3630, 85.3260],
      [23.3560, 85.3300],
      [23.3490, 85.3356],
    ],
    startPoint: START,
    endPoint: END,
  },
  calm: {
    id: "calm",
    distanceMeters: 2100,
    durationSeconds: 27 * 60,
    coordinates: [
      [23.3700, 85.3250],
      [23.3680, 85.3320],
      [23.3620, 85.3380],
      [23.3550, 85.3390],
      [23.3490, 85.3356],
    ],
    startPoint: START,
    endPoint: END,
  },
};

export class MockRoutingService implements RoutingService {
  async getRoutes(_request: RouteRequest): Promise<RouteData[]> {
    return Object.values(mockRoutes);
  }
}

/** Fixed data for the explicitly labelled Welcome preview. */
export const mockPreviewRoutes: RouteData[] = Object.values(mockRoutes);
