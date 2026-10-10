export type { LatLng, TravelMode, RouteRequest, RouteData, RoutingService } from "./types";
export { MockRoutingService } from "./mockRoutingService";
export { ApiRoutingService } from "./apiRoutingService";
export type { MockRouteId } from "./mockRoutingService";
import { MockRoutingService } from "./mockRoutingService";
import { ApiRoutingService } from "./apiRoutingService";
import type { RoutingService } from "./types";

export const routingProvider = import.meta.env["VITE_ROUTING_PROVIDER"] || "api";
if (routingProvider !== "mock" && routingProvider !== "api") {
  throw new Error("VITE_ROUTING_PROVIDER must be mock or api.");
}
export const routingService: RoutingService = routingProvider === "mock" ? new MockRoutingService() : new ApiRoutingService();
