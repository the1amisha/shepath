import { afterEach, expect, it, vi } from "vitest";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import { fetchRouteEvidence } from "@/lib/routing/routeEvidence";
import { recommendRoutes } from "@/lib/routing/liveRecommendation";
import { hybridRecommendation, hybridOrder } from "@/lib/routing/hybridRecommendation";
import { recommendationFallback } from "@/lib/routing/recommendationSummary";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
const priorities = { lighting: 1, footpath: 0, shops: 0, pedestrians: 0 };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("preserves evidence through parsing and distinguishes missing inputs from equal scores", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "https://example.test");
  const routes = [evidenceRoute, { ...evidenceRoute, id: "second", durationSeconds: 600 }];
  const states: Record<string, EvidenceState> = {};
  for (const [i, route] of routes.entries()) {
    const body = evidenceFixture(route);
    body.route_context.lighting.states.yes.object_availability = {
      numerator: i ? 8 : 2,
      denominator: 10,
      percent: i ? 80 : 20,
    };
    body.route_context.lighting.states.no.object_availability = {
      numerator: 0,
      denominator: 10,
      percent: 0,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    states[route.id] = {
      status: "complete",
      evidence: await fetchRouteEvidence(route, new AbortController().signal),
    };
  }
  const bounds = recommendRoutes(routes, states, "2026-11-18T12:00");
  expect(bounds.rows[1]!.values.lighting).toMatchObject({ low: 0.8, high: 1 });
  const ranked = hybridRecommendation(bounds, priorities);
  expect(ranked.recommendedId).toBe("second");
  expect(hybridOrder(routes, ranked)[0]!.id).toBe("second");
  for (const row of bounds.rows) row.values.lighting = { low: 0, high: 1, source: "Unknown" };
  const absent = hybridRecommendation(bounds, priorities);
  expect(absent.rows.every((row) => row.score === undefined)).toBe(true);
  expect(recommendationFallback(absent)).toBe("Insufficient data for ML comparison");
  expect(hybridOrder(routes, absent)[0]!.id).toBe(evidenceRoute.id);
  for (const row of bounds.rows) row.values.lighting = { low: 0, high: 0, source: "lit=no" };
  const tied = hybridRecommendation(bounds, priorities);
  expect(tied.rows.every((row) => row.score === 0)).toBe(true);
  expect(recommendationFallback(tied)).toBe("Equal top preference scores · compare routes");
  expect(recommendationFallback({ rows: [], message: "Failed" })).toBe("ML comparison unavailable");
});
