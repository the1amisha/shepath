import model from "../livePreferenceModel.json";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteData } from "./types";
import { parseDeparture } from "./departureTime";
import { openingState } from "./facilityHours";

export { model as liveModel };
export const attributes = ["footpath", "lighting", "shops", "pedestrians"] as const;
export type Attribute = (typeof attributes)[number];
export const attributeLabels: Record<Attribute, string> = {
  footpath: "Usable footpath throughout",
  lighting: "Working lighting throughout",
  shops: "Open shops along the route",
  pedestrians: "Other pedestrians along most stretches",
};
export type Observations = Record<string, Partial<Record<Attribute, "yes" | "no">>>;
export type Estimate = { low: number; high: number; source: string };
export type RecommendationRow = {
  id: string;
  low: number;
  high: number;
  eligible: boolean;
  values: Record<Attribute, Estimate>;
};
export type Recommendation = { rows: RecommendationRow[]; recommendedId?: string; message: string };
const unknown = (): Estimate => ({ low: 0, high: 1, source: "Unknown" });
// Missing-input bounds, NOT confidence intervals or real-world safety bounds.
function partition(yes: number, no: number, total: number, source: string): Estimate {
  if (
    ![yes, no, total].every(Number.isFinite) ||
    total <= 0 ||
    yes < 0 ||
    no < 0 ||
    yes + no > total
  )
    return unknown();
  return { low: yes / total, high: 1 - no / total, source };
}
export function observationKey(route: RouteData, departure: string) {
  return JSON.stringify([route.id, route.coordinates, route.durationSeconds, departure]);
}
export function recommendRoutes(
  routes: RouteData[],
  states: Record<string, EvidenceState>,
  departure: string,
  observations: Observations = {},
  maxExtraMinutes = Infinity,
  mock = false,
): Recommendation {
  const stop = (message: string): Recommendation => ({ rows: [], message });
  if (mock) return stop("ML recommendations require real walking routes.");
  if (routes.length < 2)
    return stop(
      routes.length
        ? "Only one route was returned. ML needs alternatives to compare."
        : "Choose a journey first.",
    );
  if (
    new Set(routes.map((r) => r.id)).size !== routes.length ||
    routes.some((r) => !Number.isFinite(r.durationSeconds) || r.durationSeconds <= 0)
  )
    return stop("Route durations or identities are invalid; no recommendation.");
  const instant = parseDeparture(departure);
  if (!instant) return stop("Set a valid departure time to compare routes.");
  if (
    maxExtraMinutes !== Infinity &&
    (!Number.isFinite(maxExtraMinutes) || maxExtraMinutes < 0 || maxExtraMinutes > 30)
  )
    return stop("Extra walking time must be between 0 and 30 minutes.");
  // This version deliberately uses a zero learned time coefficient and a separate
  // user budget. Refuse a changed artifact rather than silently ignoring time.
  if (
    model.coefficients[0] !== 0 ||
    model.coefficients.slice(1).some((w) => !Number.isFinite(w) || w < 0)
  )
    return stop("The model artifact is incompatible with this recommendation version.");
  let provenance: string | undefined;
  for (const route of routes) {
    const state = states[route.id];
    if (!state || state.status === "loading" || state.status === "queued")
      return stop("Waiting for mapped evidence for every route before recommending.");
    if (
      state.status !== "complete" ||
      state.evidence.route.id !== route.id ||
      state.evidence.status !== "available" ||
      !state.evidence.coverage.full_buffer_covered ||
      !state.evidence.route_context
    )
      return stop(
        "Comparable evidence is unavailable for at least one route. No ML recommendation; routes are shown by walking time.",
      );
    const e = state.evidence;
    const source = JSON.stringify([
      e.source_provenance.manifest_sha256,
      e.source_provenance.source_pbf_sha256,
      e.source_provenance.source_snapshot_timestamp,
      e.analysis.buffer_metres,
    ]);
    if (provenance !== undefined && source !== provenance)
      return stop("Evidence snapshots differ between routes. No ML recommendation.");
    provenance = source;
  }
  const fastest = Math.min(...routes.map((r) => r.durationSeconds));
  const weights = model.coefficients.slice(1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return stop("No usable learned attribute weights.");
  const rows = routes.map((route) => {
    const state = states[route.id]!;
    if (state.status !== "complete") throw new Error("Unreachable evidence state");
    const context = state.evidence.route_context!;
    const lit = context.lighting.states;
    const yes = lit.yes.object_availability,
      no = lit.no.object_availability;
    const sidewalk = context.sidewalk.presence_proxy;
    const businesses = context.facility_hours?.records.filter((r) => r.business);
    const hours = businesses?.map((r) => openingState(r.opening_hours, instant));
    const values: Record<Attribute, Estimate> = {
      footpath:
        sidewalk && sidewalk.yes.denominator === sidewalk.no.denominator
          ? partition(
              sidewalk.yes.numerator,
              sidewalk.no.numerator,
              sidewalk.yes.denominator,
              "Nearby sidewalk presence tags; continuity and usability unverified",
            )
          : unknown(),
      lighting:
        yes.denominator === no.denominator
          ? partition(
              yes.numerator,
              no.numerator,
              yes.denominator,
              "Nearby lit=yes/no tags; working lights on this street unverified",
            )
          : unknown(),
      shops:
        hours && hours.length === context.categories.shops_and_businesses.count
          ? partition(
              hours.filter((h) => h === "likely_open").length,
              hours.filter((h) => h === "likely_closed").length,
              hours.length,
              "Historical schedules for mapped businesses at departure; operation unverified",
            )
          : unknown(),
      pedestrians: unknown(),
    };
    const reported = observations[observationKey(route, departure)];
    for (const key of attributes) {
      const value = reported?.[key];
      if (value === "yes" || value === "no")
        values[key] = {
          low: Number(value === "yes"),
          high: Number(value === "yes"),
          source: "Your route description; not independently verified",
        };
    }
    return {
      id: route.id,
      values,
      eligible: route.durationSeconds <= fastest + maxExtraMinutes * 60,
      low:
        (100 * attributes.reduce((sum, key, i) => sum + weights[i]! * values[key].low, 0)) /
        totalWeight,
      high:
        (100 * attributes.reduce((sum, key, i) => sum + weights[i]! * values[key].high, 0)) /
        totalWeight,
    };
  });
  const eligible = rows.filter((r) => r.eligible);
  if (eligible.length < 2)
    return {
      rows,
      message:
        "Only one route fits your extra-time limit. It appears first because of your time limit, not an ML preference.",
    };
  const winner = eligible.find((r) =>
    eligible.every((other) => other.id === r.id || r.low > other.high + 1e-8),
  );
  return {
    rows,
    ...(winner ? { recommendedId: winner.id } : {}),
    message: winner
      ? "The model found a stronger preference match. It appears first; you can choose any route."
      : "There is not enough evidence to identify a clear ML preference. Unresolved alternatives are ordered by walking time, not safety.",
  };
}

/** Remove non-dominated tiers in order; overlapping fits are not a proven rank. */
export function automaticRouteOrder(routes: RouteData[], result: Recommendation): RouteData[] {
  const fastestFirst = (a: RouteData, b: RouteData) =>
    a.durationSeconds - b.durationSeconds || a.distanceMeters - b.distanceMeters;
  const pending = [...routes].sort(fastestFirst);
  const ordered: RouteData[] = [];
  const row = (id: string) => result.rows.find((r) => r.id === id);
  while (pending.length) {
    const tier = pending.filter(
      (route) =>
        !pending.some((other) => {
          const a = row(other.id),
            b = row(route.id);
          if (!a || !b || other.id === route.id) return false;
          if (a.eligible !== b.eligible) return a.eligible;
          return a.eligible && a.low > b.high + 1e-8;
        }),
    );
    ordered.push(...tier);
    for (const route of tier) pending.splice(pending.indexOf(route), 1);
  }
  return ordered;
}
export function routeExplanation(
  route: RouteData,
  routes: RouteData[],
  result: Recommendation,
): string {
  const shortest = Math.min(...routes.map((r) => r.distanceMeters));
  const fastest = Math.min(...routes.map((r) => r.durationSeconds));
  const distance = Math.round(route.distanceMeters);
  const travel = `${distance} m; about ${Math.round(route.durationSeconds / 60)} min. `;
  const comparison =
    routes.length === 1
      ? "Only one route was returned; no alternatives to compare."
      : `${route.distanceMeters === shortest ? "Shortest distance among returned routes" : `${Math.round(route.distanceMeters - shortest)} m longer than the shortest returned route`}; ${route.durationSeconds === fastest ? "fastest estimated walk" : `about ${Math.round((route.durationSeconds - fastest) / 60)} min longer than the fastest`}.`;
  const row = result.rows.find((r) => r.id === route.id);
  if (!row) return travel + comparison;
  const labels = {
    footpath: "nearby sidewalk tags",
    lighting: "nearby lighting tags",
    shops: "mapped business schedules",
    pedestrians: "pedestrian descriptions",
  };
  const known = attributes.filter((key) => row.values[key].high - row.values[key].low < 1);
  const evidence = known.length
    ? ` Available inputs: ${known.map((key) => labels[key]).join(", ")}.`
    : " Walking-condition inputs are unknown.";
  const reason =
    result.recommendedId === route.id
      ? " Recommended because its survey-weighted preference fit stays higher than the other eligible routes even across the missing-input ranges."
      : "";
  return travel + comparison + reason + evidence;
}
