import { expect, it } from "vitest";
import {
  evidenceMatch,
  emptyWeights,
  normalizedWeights,
  sensitivity,
} from "@/lib/routing/evidenceMatch";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteEvidence } from "@/lib/routing/routeEvidence";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import { segmentFixture } from "./segmentFixture";
const routes = [evidenceRoute, { ...evidenceRoute, id: "second" }];
function states(): Record<string, EvidenceState> {
  return Object.fromEntries(
    routes.map((route, i) => {
      const e = evidenceFixture(route);
      return [
        route.id,
        {
          status: "complete",
          evidence: {
            ...e,
            route_context: {
              ...e.route_context,
              segment_evidence: {
                ...segmentFixture(),
                lighting_unknown_percent: i ? 90 : 10,
                sidewalk_unknown_percent: i ? 10 : 90,
              },
            },
          } as RouteEvidence,
        },
      ];
    }),
  );
}
it("reverses order with preferences and explains contributions", () => {
  const light = evidenceMatch(routes, states(), { ...emptyWeights, lighting: 100 });
  const walk = evidenceMatch(routes, states(), { ...emptyWeights, infrastructure: 100 });
  expect(light.rows.map((r) => r.id)).toEqual([routes[0]!.id, "second"]);
  expect(walk.rows.map((r) => r.id)).toEqual(["second", routes[0]!.id]);
  expect(light.rows[0]!.score).toBe(90);
  expect(light.rows[0]!.contributions).toEqual({ lighting: 90, infrastructure: 0, businesses: 0 });
});
it("retains provider order for ties and disables zero or mock matching", () => {
  expect(
    evidenceMatch(routes, states(), { lighting: 50, infrastructure: 50, businesses: 0 }).rows.map(
      (r) => r.id,
    ),
  ).toEqual(routes.map((r) => r.id));
  expect(evidenceMatch(routes, states(), emptyWeights).active).toBe(false);
  expect(evidenceMatch(routes, states(), { ...emptyWeights, lighting: 100 }, true).active).toBe(
    false,
  );
  expect(normalizedWeights({ lighting: NaN, businesses: -1, infrastructure: 0 })).toEqual(
    emptyWeights,
  );
});
it("does not score pending, failed, unsupported or mismatched evidence as zero", () => {
  const weights = { ...emptyWeights, lighting: 100 };
  for (const state of [
    undefined,
    { status: "loading" },
    { status: "error", message: "offline" },
  ] as const) {
    const s = states();
    if (state) s["second"] = state;
    else delete s["second"];
    expect(evidenceMatch(routes, s, weights).active).toBe(false);
  }
  for (const mutation of ["identity", "coverage", "source", "segments"] as const) {
    const s = states();
    const e = (s["second"] as { status: "complete"; evidence: RouteEvidence }).evidence;
    if (mutation === "identity") e.route.id = "wrong";
    if (mutation === "coverage") e.coverage.full_buffer_covered = false;
    if (mutation === "source") e.source_provenance.manifest_sha256 = "d".repeat(64);
    if (mutation === "segments") delete e.route_context!.segment_evidence;
    expect(evidenceMatch(routes, s, weights).active).toBe(false);
  }
});
it("normalizes business records by route length, handles all-zero counts", () => {
  const s = states();
  const e = (s["second"] as { status: "complete"; evidence: RouteEvidence }).evidence;
  e.route_context!.segment_evidence!.route_length_metres *= 2;
  expect(
    evidenceMatch(routes, s, { ...emptyWeights, businesses: 100 }).rows.map((r) => r.score),
  ).toEqual([100, 50]);
  for (const state of Object.values(s))
    if (state.status === "complete")
      state.evidence.route_context!.categories.shops_and_businesses.count = 0;
  expect(
    evidenceMatch(routes, s, { ...emptyWeights, businesses: 100 }).rows.map((r) => r.score),
  ).toEqual([0, 0]);
});
it("returns a sensitivity point that changes the unique winner", () => {
  const weights = { lighting: 80, businesses: 0, infrastructure: 20 };
  const result = evidenceMatch(routes, states(), weights);
  const note = sensitivity(result.rows, weights)!;
  expect(note.id).toBe("second");
  expect(note.criterion).toBe("lighting");
  const trial = { lighting: note.percent, infrastructure: 100 - note.percent, businesses: 0 };
  expect(evidenceMatch(routes, states(), trial).rows[0]!.id).toBe(note.id);
  expect(sensitivity(result.rows.slice(0, 1), weights)).toBeNull();
});
