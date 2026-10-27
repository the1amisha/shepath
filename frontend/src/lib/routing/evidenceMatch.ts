import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteData } from "./types";

export const criteria = ["lighting", "businesses", "infrastructure"] as const;
export type Criterion = (typeof criteria)[number];
export type Weights = Record<Criterion, number>;
export const emptyWeights: Weights = { lighting: 0, businesses: 0, infrastructure: 0 };
export const criterionLabels: Record<Criterion, string> = {
  lighting: "Lighting tag coverage",
  businesses: "Nearby businesses",
  infrastructure: "Walking infrastructure tag coverage",
};
export function normalizedWeights(weights: Weights): Weights {
  const clean = Object.fromEntries(
    criteria.map((k) => [k, Number.isFinite(weights[k]) ? Math.max(0, weights[k]) : 0]),
  ) as Weights;
  const total = criteria.reduce((sum, k) => sum + clean[k], 0);
  return Object.fromEntries(criteria.map((k) => [k, total ? clean[k] / total : 0])) as Weights;
}
export type MatchRow = {
  id: string;
  values: Weights;
  contributions: Weights;
  score: number;
  businessesPerKm: number;
};
export type MatchResult = { rows: MatchRow[]; message: string; active: boolean };

// All routes must have comparable, matched segment evidence before any reranking.
export function evidenceMatch(
  routes: RouteData[],
  states: Record<string, EvidenceState>,
  weights: Weights,
  mock = false,
): MatchResult {
  const unavailable = (message: string): MatchResult => ({ rows: [], message, active: false });
  if (mock) return unavailable("Evidence matching is unavailable for illustrative mock routes.");
  const normalized = normalizedWeights(weights);
  if (!criteria.some((k) => normalized[k] > 0))
    return unavailable("All weights are zero. Routes remain in the routing provider’s order.");
  if (!routes.length) return unavailable("Choose a journey to compare evidence.");
  const raw: MatchRow[] = [];
  let provenance: string | undefined;
  for (const route of routes) {
    const state = states[route.id];
    if (!state || state.status === "queued" || state.status === "loading")
      return unavailable("Waiting for evidence for every route before reordering.");
    if (state.status !== "complete")
      return unavailable(
        "Evidence is unavailable for at least one route. Provider order is retained; no missing route is scored as zero.",
      );
    const e = state.evidence;
    const context = e.route_context;
    const segments = context?.segment_evidence;
    if (
      e.route.id !== route.id ||
      e.status !== "available" ||
      !e.coverage.full_buffer_covered ||
      !context ||
      !segments ||
      segments.route_length_metres <= 0
    )
      return unavailable(
        "Comparable segment evidence is unavailable for at least one route. Provider order is retained.",
      );
    const source = JSON.stringify([
      e.source_provenance.manifest_sha256,
      e.source_provenance.source_pbf_sha256,
      e.source_provenance.source_snapshot_timestamp,
      e.analysis.buffer_metres,
    ]);
    if (provenance !== undefined && source !== provenance)
      return unavailable("Evidence sources differ between routes. Provider order is retained.");
    provenance = source;
    raw.push({
      id: route.id,
      businessesPerKm:
        context.categories.shops_and_businesses.count / (segments.route_length_metres / 1000),
      values: {
        lighting: 100 - segments.lighting_unknown_percent,
        infrastructure: 100 - segments.sidewalk_unknown_percent,
        businesses: 0,
      },
      contributions: { ...emptyWeights },
      score: 0,
    });
  }
  const maxDensity = Math.max(...raw.map((r) => r.businessesPerKm));
  for (const row of raw) {
    row.values.businesses = maxDensity ? (100 * row.businessesPerKm) / maxDensity : 0;
    for (const k of criteria) row.contributions[k] = normalized[k] * row.values[k];
    row.score = criteria.reduce((sum, k) => sum + row.contributions[k], 0);
  }
  // Sort full precision; exact ties preserve the provider order.
  raw.sort((a, b) => b.score - a.score);
  return {
    rows: raw,
    active: true,
    message:
      "Routes are ordered by evidence match. Your selected route stays selected. Equal scores retain provider order.",
  };
}

// Scan whole percentage points, holding other weights in their current ratio.
// Report a tested point, never imply that every larger weight has the same winner.
export function sensitivity(
  rows: MatchRow[],
  weights: Weights,
): { id: string; criterion: Criterion; percent: number } | null {
  if (rows.length < 2) return null;
  const w = normalizedWeights(weights);
  for (const criterion of criteria) {
    const others = criteria.filter((k) => k !== criterion);
    const sum = others.reduce((n, k) => n + w[k], 0);
    if (!sum) continue;
    for (let percent = 0; percent <= 100; percent++) {
      const trial = { ...w, [criterion]: percent / 100 };
      for (const k of others) trial[k] = (w[k] / sum) * (1 - percent / 100);
      const scores = rows
        .map((row) => ({
          id: row.id,
          score: criteria.reduce((n, k) => n + row.values[k] * trial[k], 0),
        }))
        .sort((a, b) => b.score - a.score);
      if (scores[0]!.id !== rows[0]!.id && scores[0]!.score > scores[1]!.score + 1e-8)
        return { id: scores[0]!.id, criterion, percent };
    }
  }
  return null;
}
