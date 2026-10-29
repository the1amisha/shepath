import { expect, it } from "vitest";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteEvidence } from "@/lib/routing/routeEvidence";
import { summarizeRoute } from "@/lib/routing/routeSummary";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import { segmentFixture } from "./segmentFixture";

const routes = [
  { ...evidenceRoute, id: "first", durationSeconds: 3840, distanceMeters: 5300 },
  { ...evidenceRoute, id: "second", durationSeconds: 3780, distanceMeters: 5300 },
  { ...evidenceRoute, id: "third", durationSeconds: 4740, distanceMeters: 6600 },
];
function states(): Record<string, EvidenceState> {
  return Object.fromEntries(
    routes.map((route, i) => {
      const e = evidenceFixture(route) as RouteEvidence;
      e.route_context!.categories.shops_and_businesses.count = [19, 54, 25][i]!;
      e.route_context!.categories.healthcare_facilities.count = [4, 9, 4][i]!;
      e.route_context!.segment_evidence = segmentFixture();
      return [route.id, { status: "complete", evidence: e }];
    }),
  );
}
function edit(s: Record<string, EvidenceState>, id = "first"): RouteEvidence {
  return (s[id] as { status: "complete"; evidence: RouteEvidence }).evidence;
}

it("gives exact count differences and a rounded gap using the fastest other route", () => {
  const s = states();
  const e = edit(s);
  e.route_context!.segment_evidence!.longest_facility_gap.length_metres = 3668.2;
  const summary = summarizeRoute(routes, "first", s)!;
  expect(summary.name).toBe("Route 1");
  expect(summary.comparisonId).toBe("second");
  expect(summary.travel).toBe(
    "Route 1 is about 5.3 km with an estimated walk of 64 min. It is about 1 min slower than Route 2.",
  );
  expect(summary.mapped).toContain("19 mapped business records and 4 mapped healthcare records");
  expect(summary.mapped).toContain(
    "longest stretch with no mapped business or healthcare record within 100 m is about 3.7 km",
  );
  expect(summary.comparison).toContain(
    "35 fewer mapped business records and 5 fewer mapped healthcare records than Route 2",
  );
  expect(summary.context.join(" ")).toContain(
    "50.0% of the route for lighting and 100.0% for sidewalks",
  );
  const reverse = summarizeRoute(routes, "second", s)!;
  expect(reverse.travel).toContain("1 min faster than Route 1");
  expect(reverse.comparison).toContain(
    "35 more mapped business records and 5 more mapped healthcare records than Route 1",
  );
});
it("honors an explicit comparator, handles equal counts and never mutates routes", () => {
  const s = states();
  const before = JSON.stringify(routes);
  expect(summarizeRoute(routes, "first", s, "third")!.travel).toContain(
    "15 min faster than Route 3",
  );
  expect(summarizeRoute(routes, "first", s, "first")!.comparisonId).toBe("second");
  expect(summarizeRoute(routes, "first", s, "removed")!.comparisonId).toBe("second");
  edit(s, "second").route_context!.categories = structuredClone(edit(s).route_context!.categories);
  expect(summarizeRoute(routes, "first", s)!.comparison).toBe(
    "Route 1 and Route 2 have the same mapped business and healthcare counts.",
  );
  expect(JSON.stringify(routes)).toBe(before);
});
it("handles time ties, sub-minute differences, one route and singular counts", () => {
  const s = states();
  const pair = [routes[0]!, { ...routes[1]!, durationSeconds: 3801 }];
  expect(summarizeRoute(pair, "first", s)!.travel).toContain("less than 1 min slower");
  pair[1]!.durationSeconds = 3840;
  expect(summarizeRoute(pair, "first", s)!.travel).toContain(
    "same estimated walking time as Route 2",
  );
  const e = edit(s);
  e.route_context!.categories.shops_and_businesses.count = 1;
  e.route_context!.categories.healthcare_facilities.count = 1;
  const single = summarizeRoute([routes[0]!], "first", s)!;
  expect(single.mapped).toContain("1 mapped business record and 1 mapped healthcare record.");
  expect(single.comparisonId).toBeNull();
  expect(single.comparison).toBeNull();
});
it("distinguishes a measured zero gap/count from missing segment data", () => {
  const s = states(),
    e = edit(s);
  e.route_context!.segment_evidence!.longest_facility_gap.length_metres = 0;
  expect(summarizeRoute(routes, "first", s)!.mapped).toContain("along the whole route");
  e.route_context!.segment_evidence!.longest_facility_gap.length_metres = 0.2;
  expect(summarizeRoute(routes, "first", s)!.mapped).toContain("less than 1 m");
  delete e.route_context!.segment_evidence;
  e.route_context!.categories.shops_and_businesses.count = 0;
  expect(summarizeRoute(routes, "first", s)!.mapped).toContain("0 mapped business records");
  expect(summarizeRoute(routes, "first", s)!.mapped).toContain("a longest gap cannot be reported");
  expect(summarizeRoute(routes, "first", s)!.context.join(" ")).not.toContain("% of the route");
});
it.each([
  "absent",
  "queued",
  "loading",
  "error",
  "coverage",
  "identity",
  "null-context",
  "coverage-flag",
  "identity-outside",
])("does not invent counts for %s selected evidence", (kind) => {
  const s = states();
  if (kind === "absent") delete s["first"];
  if (kind === "queued" || kind === "loading") s["first"] = { status: kind };
  if (kind === "error") s["first"] = { status: "error", message: "Offline" };
  if (kind === "coverage") {
    edit(s).status = "coverage_unavailable";
    edit(s).coverage.full_buffer_covered = false;
  }
  if (kind === "identity") edit(s).route.id = "stale";
  if (kind === "coverage-flag") edit(s).coverage.full_buffer_covered = false;
  if (kind === "identity-outside") {
    edit(s).route.id = "stale";
    edit(s).status = "coverage_unavailable";
  }
  if (kind === "null-context") edit(s).route_context = null;
  const result = summarizeRoute(routes, "first", s)!;
  expect(result.travel).toContain("64 min");
  expect(result.mapped).not.toMatch(/19 mapped|0 mapped|about 150 m/);
  expect(result.comparison).toBeNull();
  if (kind === "identity-outside") expect(result.mapped).not.toContain("outside");
  expect(result.context).toEqual([]);
});
it("does not compare missing alternative evidence or mismatched sources", () => {
  for (const field of [
    "manifest_sha256",
    "source_pbf_sha256",
    "source_snapshot_timestamp",
  ] as const) {
    const s = states();
    edit(s, "second").source_provenance[field] = "different";
    const result = summarizeRoute(routes, "first", s)!;
    expect(result.travel).toContain("1 min slower");
    expect(result.comparison).toContain("evidence sources differ");
    expect(result.comparison).not.toContain("fewer");
  }
  const s = states();
  s["second"] = { status: "error", message: "Unavailable" };
  expect(summarizeRoute(routes, "first", s)!.comparison).toContain("not available");
});
it("suppresses live summaries for mock routes or absent selection", () => {
  expect(summarizeRoute(routes, "first", states(), "", true)).toBeNull();
  expect(summarizeRoute(routes, "gone", states())).toBeNull();
  expect(summarizeRoute([], "", {})).toBeNull();
});
