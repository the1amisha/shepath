import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchRouteEvidence } from "./routeEvidence";
import { evidenceFixture, evidenceRoute as route } from "@/test/evidenceFixture";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RouteData } from "./types";
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Retry-After": "5" } });
beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "https://configured.example/api/"));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("Dynamic evidence client", () => {
  it("accepts all three pinned Stage 1 responses and retains a compact presentation", async () => {
    const measurements = [];
    for (const index of [1, 2, 3]) {
      const full = JSON.parse(readFileSync(resolve(process.cwd(), `../data/ranchi_safety/dynamic_validation/heigit-foot-walking-route-${index}.json`), "utf8"));
      const coordinates = full.route.coordinates;
      const input: RouteData = { id: full.route.id, coordinates, distanceMeters: full.route.supplied_distance_metres,
        durationSeconds: full.route.supplied_duration_seconds, startPoint: coordinates[0], endPoint: coordinates.at(-1) };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(full)));
      const compact = await fetchRouteEvidence(input, new AbortController().signal);
      expect(compact.route.geometry_sha256).toBe(full.route.geometry_sha256);
      expect(compact.evidence_identity_sha256).toBe(full.evidence_identity_sha256);
      expect(compact.route_context?.categories.shops_and_businesses.count).toBe(full.route_context.categories.shops_and_businesses.count);
      expect(compact.route_context?.lighting.usable_tag_availability).toEqual({
        numerator: full.route_context.lighting.usable_tag_availability.numerator,
        denominator: full.route_context.lighting.usable_tag_availability.denominator,
        percent: full.route_context.lighting.usable_tag_availability.percent,
      });
      expect(compact.source_provenance.source_snapshot_timestamp).toBe("2026-10-08T20:21:06Z");
      const fullBytes = new TextEncoder().encode(JSON.stringify(full)).length;
      const retainedBytes = new TextEncoder().encode(JSON.stringify(compact)).length;
      expect(retainedBytes).toBeLessThan(fullBytes / 20);
      measurements.push({ route: index, fullBytes, retainedBytes });
    }
    console.log("Phase 5D compact payload audit", measurements);
  });
  it("cancels busy backoff without retrying or blocking subsequent work", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementationOnce(async () => response({ detail: { code: "analysis_busy" } }, 503))
      .mockImplementationOnce(async () => response(evidenceFixture()));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const first = expect(fetchRouteEvidence(route, controller.signal)).rejects.toBeDefined();
    await vi.advanceTimersByTimeAsync(1); controller.abort(); await first;
    await fetchRouteEvidence(route, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("sends exact lat/lon geometry to configured backend and retains compact verified fields", async () => {
    const fetch = vi.fn().mockResolvedValue(response(evidenceFixture())); vi.stubGlobal("fetch", fetch);
    const result = await fetchRouteEvidence(route, new AbortController().signal);
    expect(fetch.mock.calls[0]![0]).toBe("https://configured.example/api/pilot/ranchi/route-evidence");
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ route_id: route.id, coordinates: route.coordinates,
      distance_metres: route.distanceMeters, duration_seconds: route.durationSeconds });
    expect(result.route).not.toHaveProperty("coordinates");
    expect(result.route_context).not.toHaveProperty("source_features");
    expect(result.route.geometry_sha256).toBe("a".repeat(64));
  });
  it("preserves unsupported coverage without counts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ...evidenceFixture(), status: "coverage_unavailable",
      coverage: { full_buffer_covered: false, reason: "centerline_outside_pilot" }, route_context: null })));
    expect((await fetchRouteEvidence(route, new AbortController().signal)).route_context).toBeNull();
  });
  it.each([[422, "invalid_route_geometry", "invalid"], [503, "dataset_unavailable", "dataset"], [504, "analysis_timeout", "timeout"], [503, "analysis_failed", "service"]])(
    "handles %s/%s without automatic retries", async (status, code, expected) => {
      const fetch = vi.fn().mockResolvedValue(response({ detail: { code } }, Number(status))); vi.stubGlobal("fetch", fetch);
      await expect(fetchRouteEvidence(route, new AbortController().signal)).rejects.toMatchObject({ code: expected });
      expect(fetch).toHaveBeenCalledOnce();
    });
  it("reports network and CORS failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(fetchRouteEvidence(route, new AbortController().signal)).rejects.toMatchObject({ code: "network" });
  });
  it("bounds a stalled response with a client deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const pending = expect(fetchRouteEvidence(route, new AbortController().signal)).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(75001); await pending;
  });
  it("rejects mismatched geometry even when the route ID matches", async () => {
    const fixture = evidenceFixture(); fixture.route.coordinates = [...route.coordinates].reverse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(fixture)));
    await expect(fetchRouteEvidence(route, new AbortController().signal)).rejects.toMatchObject({ code: "response" });
  });
  it("retries busy only twice and never overlaps requests", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementation(async () => response({ detail: { code: "analysis_busy" } }, 503)); vi.stubGlobal("fetch", fetch);
    const pending = expect(fetchRouteEvidence(route, new AbortController().signal)).rejects.toMatchObject({ code: "busy" });
    await vi.advanceTimersByTimeAsync(10001); await pending;
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("serializes calls across consumers", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }))
      .mockImplementationOnce(async () => response(evidenceFixture())); vi.stubGlobal("fetch", fetch);
    const first = fetchRouteEvidence(route, new AbortController().signal);
    const second = fetchRouteEvidence(route, new AbortController().signal);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    finish(response(evidenceFixture())); await first; await second;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not submit missing geometry or already cancelled work", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(fetchRouteEvidence({ ...route, coordinates: [] }, new AbortController().signal)).rejects.toMatchObject({ code: "invalid" });
    const controller = new AbortController(); controller.abort();
    await expect(fetchRouteEvidence(route, controller.signal)).rejects.toBeDefined(); expect(fetch).not.toHaveBeenCalled();
  });
});
