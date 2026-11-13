import { describe, expect, it } from "vitest";
import {
  recommendRoutes,
  observationKey,
  attributes,
  liveModel,
} from "@/lib/routing/liveRecommendation";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteEvidence } from "@/lib/routing/routeEvidence";
const routes = [evidenceRoute, { ...evidenceRoute, id: "alternative", durationSeconds: 600 }];
const departure = "2026-11-13T12:00";
function states(): Record<string, EvidenceState> {
  return Object.fromEntries(
    routes.map((r) => [
      r.id,
      { status: "complete", evidence: evidenceFixture(r) as RouteEvidence },
    ]),
  );
}
const ratio = (n: number, d = 10) => ({
  numerator: n,
  denominator: d,
  percent: d ? (n / d) * 100 : null,
});
function allReported(id: number, value: "yes" | "no") {
  return {
    [observationKey(routes[id]!, departure)]: Object.fromEntries(attributes.map((k) => [k, value])),
  };
}
describe("real-route hybrid ML", () => {
  it("uses learned positive weights and abstains on unknown inputs", () => {
    expect(liveModel.coefficients[0]).toBe(0);
    expect(liveModel.coefficients.slice(1).every((w) => w > 0)).toBe(true);
    const result = recommendRoutes(routes, states(), departure);
    expect(result.recommendedId).toBeUndefined();
    expect(result.rows[0]!.values.shops).toMatchObject({ low: 0, high: 1 });
    expect(result.rows[0]!.values.pedestrians).toMatchObject({ low: 0, high: 1 });
  });
  it("can recommend automatically from comparable positive and negative mapped tags", () => {
    const s = states();
    routes.forEach((r, i) => {
      const state = s[r.id]!;
      if (state.status !== "complete") throw new Error();
      const c = state.evidence.route_context!;
      c.sidewalk.presence_proxy = {
        yes: ratio(i ? 10 : 0),
        no: ratio(i ? 0 : 10),
        unknown: ratio(0),
      };
      c.lighting.states.yes.object_availability = ratio(i ? 10 : 0);
      c.lighting.states.no.object_availability = ratio(i ? 0 : 10);
    });
    const result = recommendRoutes(routes, s, departure);
    expect(result.recommendedId).toBe("alternative");
    expect(result.rows[1]!.low).toBeGreaterThan(result.rows[0]!.high);
  });
  it("recalculates schedules for departure and retains unknown hours", () => {
    const s = states();
    for (const state of Object.values(s))
      if (state.status === "complete") {
        const c = state.evidence.route_context!;
        c.categories.shops_and_businesses.count = 2;
        c.facility_hours = {
          schema_version: "SHEPATH.facility_hours.v1",
          records: [
            {
              osm_id: "node/1",
              business: true,
              healthcare: false,
              name: null,
              opening_hours: "09:00-17:00",
            },
            {
              osm_id: "node/2",
              business: true,
              healthcare: false,
              name: null,
              opening_hours: null,
            },
          ],
        };
      }
    expect(recommendRoutes(routes, s, departure).rows[0]!.values.shops).toMatchObject({
      low: 0.5,
      high: 1,
    });
    expect(recommendRoutes(routes, s, "2026-11-13T20:00").rows[0]!.values.shops).toMatchObject({
      low: 0,
      high: 0.5,
    });
  });
  it("distinguishes no mapped records, invalid counts and explicit no", () => {
    const s = states();
    const state = s[routes[0]!.id]!;
    if (state.status !== "complete") throw new Error();
    const c = state.evidence.route_context!;
    c.lighting.states.yes.object_availability = ratio(0, 0);
    c.lighting.states.no.object_availability = ratio(0, 0);
    c.categories.shops_and_businesses.count = 0;
    c.facility_hours = { schema_version: "SHEPATH.facility_hours.v1", records: [] };
    expect(recommendRoutes(routes, s, departure).rows[0]!.values.lighting).toMatchObject({
      low: 0,
      high: 1,
    });
    expect(recommendRoutes(routes, s, departure).rows[0]!.values.shops).toMatchObject({
      low: 0,
      high: 1,
    });
    c.lighting.states.yes.object_availability = ratio(0);
    c.lighting.states.no.object_availability = ratio(10);
    expect(recommendRoutes(routes, s, departure).rows[0]!.values.lighting).toMatchObject({
      low: 0,
      high: 0,
    });
    c.lighting.states.yes.object_availability = ratio(12);
    expect(recommendRoutes(routes, s, departure).rows[0]!.values.lighting).toMatchObject({
      low: 0,
      high: 1,
    });
  });
  it("keys user descriptions to geometry and departure", () => {
    const observations = { ...allReported(0, "no"), ...allReported(1, "yes") };
    expect(recommendRoutes(routes, states(), departure, observations).recommendedId).toBe(
      "alternative",
    );
    expect(
      recommendRoutes(routes, states(), "2026-11-13T13:00", observations).recommendedId,
    ).toBeUndefined();
    const moved = routes.map((r) => ({
      ...r,
      coordinates: [...r.coordinates, [23.36, 85.33] as [number, number]],
    }));
    expect(recommendRoutes(moved, states(), departure, observations).recommendedId).toBeUndefined();
  });
  it("abstains for single, mock, failed, pending, invalid and mismatched evidence", () => {
    expect(recommendRoutes(routes.slice(0, 1), states(), departure).rows).toEqual([]);
    expect(recommendRoutes(routes, states(), departure, {}, 5, true).rows).toEqual([]);
    expect(recommendRoutes(routes, states(), "invalid").rows).toEqual([]);
    expect(recommendRoutes(routes, states(), departure, {}, NaN).rows).toEqual([]);
    for (const state of [
      { status: "loading" },
      { status: "error", message: "failed" },
    ] as EvidenceState[])
      expect(recommendRoutes(routes, { ...states(), alternative: state }, departure).rows).toEqual(
        [],
      );
    for (const mutation of ["coverage", "source", "identity"]) {
      const s = states();
      const state = s["alternative"]!;
      if (state.status !== "complete") throw new Error();
      if (mutation === "coverage") state.evidence.coverage.full_buffer_covered = false;
      if (mutation === "source") state.evidence.source_provenance.manifest_sha256 = "x";
      if (mutation === "identity") state.evidence.route.id = "stale";
      expect(recommendRoutes(routes, s, departure).rows).toEqual([]);
    }
  });
  it("keeps ties and never calls a single eligible option an ML winner", () => {
    expect(
      recommendRoutes(routes, states(), departure, {
        ...allReported(0, "yes"),
        ...allReported(1, "yes"),
      }).recommendedId,
    ).toBeUndefined();
    const result = recommendRoutes(
      routes,
      states(),
      departure,
      { ...allReported(0, "no"), ...allReported(1, "yes") },
      0,
    );
    expect(result.recommendedId).toBeUndefined();
    expect(result.rows[1]!.eligible).toBe(false);
  });
});
