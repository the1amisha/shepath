import { attributes, liveModel, type Attribute, type Recommendation } from "./liveRecommendation";
import type { RouteData } from "./types";

export type Priorities = Record<Attribute, number>;
export const learnedPriorities = Object.fromEntries(
  attributes.map((key, i) => [key, liveModel.coefficients[i + 1]!]),
) as Priorities;
export const priorityLabels: Record<Attribute, string> = {
  footpath: "Footpath",
  lighting: "Lighting",
  shops: "Open businesses",
  pedestrians: "Pedestrians",
};
export type HybridRow = Recommendation["rows"][number] & {
  score?: number;
  coverage: number;
  reason: string;
};
export type HybridResult = Omit<Recommendation, "rows"> & { rows: HybridRow[] };

/** Midpoint imputation is a product rule, not a learned safety probability. */
export function hybridRecommendation(result: Recommendation, priorities: Priorities): HybridResult {
  const total = attributes.reduce((sum, key) => sum + priorities[key], 0);
  if (
    attributes.some((key) => !Number.isFinite(priorities[key]) || priorities[key] < 0) ||
    total <= 0
  )
    return { rows: [], message: "No active priorities · ordered by travel time." };
  const rows = result.rows.map((row): HybridRow => {
    const low =
      (attributes.reduce((sum, key) => sum + priorities[key] * row.values[key].low, 0) * 100) /
      total;
    const high =
      (attributes.reduce((sum, key) => sum + priorities[key] * row.values[key].high, 0) * 100) /
      total;
    const coverage = Math.max(0, Math.min(100, 100 - (high - low)));
    const positive = attributes
      .filter((key) => priorities[key] > 0 && row.values[key].low > 0)
      .sort((a, b) => priorities[b] * row.values[b].low - priorities[a] * row.values[a].low);
    const reason = positive[0]
      ? priorityLabels[positive[0]] + " inputs contribute most."
      : coverage > 1e-8
        ? "Limited positive inputs; compare coverage."
        : "Inputs unknown; travel-time fallback.";
    return {
      ...row,
      low,
      high,
      coverage,
      reason,
      ...(coverage > 1e-8 ? { score: (low + high) / 2 } : {}),
    };
  });
  const scored = rows.filter((r) => r.eligible && r.score !== undefined);
  const best = Math.max(...scored.map((r) => r.score!));
  const leaders = scored.filter((r) => Math.abs(r.score! - best) < 1e-8);
  const recommendedId = leaders.length === 1 ? leaders[0]!.id : undefined;
  return {
    rows,
    ...(recommendedId ? { recommendedId } : {}),
    message: !rows.length
      ? result.message
      : !scored.length
        ? "Not enough known inputs to score · ordered by travel time."
        : "Ordered by route suitability using survey weights and your priorities. Unknown inputs use a neutral midpoint; low coverage makes the result provisional. Ties use travel time.",
  };
}

export function hybridOrder(routes: RouteData[], result: HybridResult): RouteData[] {
  const rows = new Map(result.rows.map((r) => [r.id, r]));
  return [...routes].sort((a, b) => {
    const x = rows.get(a.id),
      y = rows.get(b.id);
    if (x && y && x.eligible !== y.eligible) return x.eligible ? -1 : 1;
    const xs = x?.score,
      ys = y?.score;
    if (xs !== undefined && ys === undefined) return -1;
    if (ys !== undefined && xs === undefined) return 1;
    const difference = xs !== undefined && ys !== undefined ? ys - xs : 0;
    return (
      (Math.abs(difference) > 1e-8 ? difference : 0) ||
      a.durationSeconds - b.durationSeconds ||
      a.distanceMeters - b.distanceMeters
    );
  });
}
