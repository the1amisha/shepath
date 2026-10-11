import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRoutingService } from "./apiRoutingService";
import { beforeEach } from "vitest";
const route = { id: "heigit-foot-walking-route-1", distanceMeters: 1411.6, durationSeconds: 1016.4, coordinates: [[23.37, 85.32], [23.35, 85.33]], startPoint: [23.37, 85.32], endPoint: [23.35, 85.33] };
const request = { origin: "Albert Ekka Chowk, Ranchi", destination: "Ranchi Railway Station, Ranchi", travelMode: "walk" as const };
beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8011"));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("ApiRoutingService", () => {
  it.each(["cycle", "drive"] as const)("preserves %s routing without calling evidence", async travelMode => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ routes: [route] })));
    vi.stubGlobal("fetch", fetch);
    expect(await new ApiRoutingService("http://localhost:8000").getRoutes({ ...request, travelMode })).toEqual([route]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0]![1].body).travelMode).toBe(travelMode);
    expect(fetch.mock.calls[0]![0]).toBe("http://localhost:8000/route");
  });
  it("posts the unchanged contract and preserves a single arbitrary route ID and lat/lng coordinates", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ routes: [route] })));
    vi.stubGlobal("fetch", fetch);
    expect(await new ApiRoutingService("http://localhost:8000/").getRoutes(request)).toEqual([route]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/route", expect.objectContaining({ method: "POST", body: JSON.stringify(request), headers: { "Content-Type": "application/json" } }));
  });
  it.each([
    [200, { routes: [] }, "No routes"],
    [400, { detail: "Geocoding failed" }, "Geocoding failed"],
    [200, { routes: [{ ...route, coordinates: [[120, 85]] }] }, "invalid route data"],
    [200, { routes: [route, route] }, "invalid route data"],
  ])("rejects failure responses without mock fallback", async (status, body, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
    await expect(new ApiRoutingService().getRoutes(request)).rejects.toThrow(message);
  });
  it("reports unreachable backend and CORS guidance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(new ApiRoutingService().getRoutes(request)).rejects.toThrow("CORS");
  });
});
