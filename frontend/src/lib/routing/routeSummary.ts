import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteEvidence } from "./routeEvidence";
import type { RouteData } from "./types";

type AvailableEvidence = RouteEvidence & {
  route_context: NonNullable<RouteEvidence["route_context"]>;
};
export type RouteSummary = {
  name: string;
  comparisonId: string | null;
  travel: string;
  mapped: string;
  comparison: string | null;
  context: string[];
};

// Evidence has already passed exact-coordinate validation in fetchRouteEvidence;
// useRouteEvidence additionally isolates state by route-array and journey identity.
function available(route: RouteData, state: EvidenceState | undefined): AvailableEvidence | null {
  if (state?.status !== "complete") return null;
  const e = state.evidence;
  return e.route.id === route.id &&
    e.status === "available" &&
    e.coverage.full_buffer_covered &&
    e.route_context &&
    e.analysis.buffer_metres === 100
    ? (e as AvailableEvidence)
    : null;
}
function distanceText(metres: number): string {
  if (metres === 0) return "0 m";
  if (metres < 1) return "less than 1 m";
  return metres < 1000 ? `about ${Math.round(metres)} m` : `about ${(metres / 1000).toFixed(1)} km`;
}
function minutes(seconds: number): string {
  if (seconds === 0) return "0 min";
  return seconds < 60 ? "less than 1 min" : `${Math.round(seconds / 60)} min`;
}
function recordCount(n: number, category: string): string {
  return `${n} mapped ${category} record${n === 1 ? "" : "s"}`;
}
function difference(n: number, category: string): string {
  return `${Math.abs(n)} ${n > 0 ? "more" : "fewer"} mapped ${category} record${Math.abs(n) === 1 ? "" : "s"}`;
}
function sameSource(a: AvailableEvidence, b: AvailableEvidence): boolean {
  return (
    a.source_provenance.manifest_sha256 === b.source_provenance.manifest_sha256 &&
    a.source_provenance.source_pbf_sha256 === b.source_provenance.source_pbf_sha256 &&
    a.source_provenance.source_snapshot_timestamp ===
      b.source_provenance.source_snapshot_timestamp &&
    a.analysis.buffer_metres === b.analysis.buffer_metres
  );
}
function unavailableText(routeId: string, state: EvidenceState | undefined): string {
  if (!state || state.status === "queued" || state.status === "loading")
    return "Mapped evidence is still loading for this route. Facility counts and stretches are not summarized yet.";
  if (
    state.status === "complete" &&
    state.evidence.route.id === routeId &&
    state.evidence.status === "coverage_unavailable"
  )
    return "This route is outside the supported evidence coverage. Its mapped facilities and stretches are unknown.";
  return "Matching mapped evidence is unavailable for this route. Its facility counts and stretches are unknown.";
}

/** Deterministic presentation only: no ranking, imputation, network or model calls. */
export function summarizeRoute(
  routes: RouteData[],
  selectedId: string,
  states: Record<string, EvidenceState>,
  requestedComparisonId = "",
  mock = false,
): RouteSummary | null {
  const selected = routes.find((r) => r.id === selectedId);
  if (mock || !selected) return null;
  const nameOf = (route: RouteData) => `Route ${routes.indexOf(route) + 1}`;
  const name = nameOf(selected);
  const others = routes.filter((r) => r.id !== selectedId);
  // Default to the fastest other estimate without cherry-picking for mapped coverage.
  // The caller always supplies provider order, never the evidence-ranked card order.
  const reference =
    others.find((r) => r.id === requestedComparisonId) ??
    others.reduce<RouteData | undefined>(
      (best, r) => (!best || r.durationSeconds < best.durationSeconds ? r : best),
      undefined,
    );
  let travel = `${name} is ${distanceText(selected.distanceMeters)} with an estimated walk of ${minutes(selected.durationSeconds)}.`;
  if (reference) {
    const delta = selected.durationSeconds - reference.durationSeconds;
    travel +=
      delta === 0
        ? ` It has the same estimated walking time as ${nameOf(reference)}.`
        : ` It is ${Math.abs(delta) < 60 ? "" : "about "}${minutes(Math.abs(delta))} ${delta > 0 ? "slower" : "faster"} than ${nameOf(reference)}.`;
  }
  const result: RouteSummary = {
    name,
    comparisonId: reference?.id ?? null,
    travel,
    mapped: unavailableText(selectedId, states[selectedId]),
    comparison: null,
    context: [],
  };
  const e = available(selected, states[selectedId]);
  if (!e) return result;
  const c = e.route_context;
  result.mapped = `Within 100 m of this route, there are ${recordCount(c.categories.shops_and_businesses.count, "business")} and ${recordCount(c.categories.healthcare_facilities.count, "healthcare")}.`;
  const segments = c.segment_evidence;
  if (segments) {
    const gap = segments.longest_facility_gap.length_metres;
    result.mapped +=
      gap === 0
        ? " A mapped business or healthcare record lies within 100 m along the whole route."
        : ` Its longest stretch with no mapped business or healthcare record within 100 m is ${distanceText(gap)}.`;
    result.context.push(
      `Usable tags on nearby roads are missing along ${segments.lighting_unknown_percent.toFixed(1)}% of the route for lighting and ${segments.sidewalk_unknown_percent.toFixed(1)}% for sidewalks. These tags are not verified conditions on the walked street.`,
    );
  } else {
    result.mapped += " Stretch-level evidence is unavailable, so a longest gap cannot be reported.";
  }
  result.context.push(
    `Source snapshot: ${e.source_provenance.source_snapshot_timestamp}. Counts describe OSM objects, not verified operating facilities; categories can overlap and duplicate establishments may remain.`,
  );
  if (reference) {
    const other = available(reference, states[reference.id]);
    if (!other)
      result.comparison = `Mapped counts are not compared with ${nameOf(reference)} because matching evidence for that route is not available.`;
    else if (!sameSource(e, other))
      result.comparison = `Mapped counts are not compared with ${nameOf(reference)} because the evidence sources differ.`;
    else {
      const business =
        c.categories.shops_and_businesses.count -
        other.route_context.categories.shops_and_businesses.count;
      const healthcare =
        c.categories.healthcare_facilities.count -
        other.route_context.categories.healthcare_facilities.count;
      const differences = [
        business ? difference(business, "business") : null,
        healthcare ? difference(healthcare, "healthcare") : null,
      ].filter(Boolean);
      result.comparison = differences.length
        ? `${name} has ${differences.join(" and ")} than ${nameOf(reference)} in their 100 m buffers.`
        : `${name} and ${nameOf(reference)} have the same mapped business and healthcare counts.`;
    }
  }
  return result;
}
