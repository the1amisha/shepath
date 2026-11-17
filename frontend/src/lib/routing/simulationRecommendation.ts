import model from "../simulationModel.json";
import { attributes, type Attribute, type Recommendation } from "./liveRecommendation";
import { priorityLabels, type HybridResult, type HybridRow } from "./hybridRecommendation";
import { daylightEstimate, parseDeparture } from "./departureTime";
import type { RouteData } from "./types";

export { model as simulationModel };
export type SimulationRow = HybridRow & {
  inputs: Record<Attribute, number>;
  simulated: Record<Attribute, number>;
  nightFraction: number;
};
export type SimulationResult = Omit<HybridResult, "rows"> & { rows: SimulationRow[] };

/** Portable inference for the fitted sklearn trees. No hand-written ranking formula here. */
export function predictSimulation(inputs: number[]): number {
  if (inputs.length !== 5 || inputs.some((x) => !Number.isFinite(x) || x < 0 || x > 1))
    throw new Error("Simulation inputs must be five finite values between zero and one.");
  let prediction = model.initial;
  for (const tree of model.trees) {
    let node = 0;
    while (tree.left[node]! >= 0) {
      // sklearn casts prediction features to float32 before tree traversal.
      node =
        Math.fround(inputs[tree.feature[node]!]!) <= tree.threshold[node]!
          ? tree.left[node]!
          : tree.right[node]!;
    }
    prediction += model.learning_rate * tree.value[node]!;
  }
  return Math.max(0, Math.min(100, prediction));
}
function hash(value: string) {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967295;
}
/** Equal-distance samples, deterministic ~500m cells; shared cells share invented inputs. */
export function simulatedInputs(route: RouteData): Record<Attribute, number> {
  const points = route.coordinates;
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot((p[0] - points[i]![0]) * 111320, (p[1] - points[i]![1]) * 102000));
  const total = lengths.reduce((sum, x) => sum + x, 0);
  const count = Math.min(200, Math.max(1, Math.ceil(total / 50)));
  const values = Object.fromEntries(attributes.map((key) => [key, 0])) as Record<Attribute, number>;
  let segment = 0,
    before = 0;
  for (let sample = 0; sample < count; sample++) {
    const target = (total * (sample + 0.5)) / count;
    while (segment < lengths.length - 1 && before + lengths[segment]! < target) {
      before += lengths[segment]!;
      segment++;
    }
    const a = points[segment]!,
      b = points[segment + 1]!;
    const t = lengths[segment]! > 0 ? (target - before) / lengths[segment]! : 0;
    const cell = [
      Math.floor((a[0] + (b[0] - a[0]) * t) / 0.005),
      Math.floor((a[1] + (b[1] - a[1]) * t) / 0.005),
    ].join(":");
    for (const key of attributes) values[key] += hash(`${model.seed}:${cell}:${key}`) / count;
  }
  return values;
}
export function simulationRecommendation(
  routes: RouteData[],
  evidenceBounds: Recommendation,
  departure: string,
  maxExtra = Infinity,
): SimulationResult {
  const stop = (message: string): SimulationResult => ({ rows: [], message });
  const instant = parseDeparture(departure);
  if (!instant) return stop("Set a valid departure time for the ML demo.");
  if (!routes.length) return stop("Choose a journey to run the ML demo.");
  if (maxExtra !== Infinity && (!Number.isFinite(maxExtra) || maxExtra < 0 || maxExtra > 30))
    return stop("Extra walking time must be between 0 and 30 minutes.");
  if (
    new Set(routes.map((r) => r.id)).size !== routes.length ||
    routes.some(
      (r) =>
        !Number.isFinite(r.durationSeconds) ||
        r.durationSeconds <= 0 ||
        r.durationSeconds > 172800 ||
        !Number.isFinite(r.distanceMeters) ||
        r.distanceMeters < 0 ||
        r.coordinates.length < 2 ||
        r.coordinates.some(
          (p) =>
            p.length !== 2 ||
            !Number.isFinite(p[0]) ||
            !Number.isFinite(p[1]) ||
            Math.abs(p[0]) > 90 ||
            Math.abs(p[1]) > 180,
        ),
    )
  )
    return stop("Valid routes are needed for the ML demo.");
  const fastest = Math.min(...routes.map((r) => r.durationSeconds));
  const rows = routes.map((route): SimulationRow => {
    const generated = simulatedInputs(route);
    const mapped = evidenceBounds.rows.find((r) => r.id === route.id);
    const inputs = {} as Record<Attribute, number>;
    const simulated = {} as Record<Attribute, number>;
    const values = {} as SimulationRow["values"];
    for (const key of attributes) {
      const candidate = mapped?.values[key];
      const valid =
        candidate &&
        Number.isFinite(candidate.low) &&
        Number.isFinite(candidate.high) &&
        candidate.low >= 0 &&
        candidate.high <= 1 &&
        candidate.low <= candidate.high;
      const bound = valid ? candidate : { low: 0, high: 1, source: "No comparable map input" };
      simulated[key] = bound.high - bound.low;
      inputs[key] = Math.max(0, Math.min(1, bound.low + simulated[key] * generated[key]));
      values[key] = { ...bound };
    }
    const nightFraction = Math.min(
      1,
      (daylightEstimate(instant, route.durationSeconds)!.nightMinutes * 60) / route.durationSeconds,
    );
    const features = [...attributes.map((key) => inputs[key]), nightFraction];
    const score = Math.round(predictSimulation(features) * 10) / 10;
    const effects = attributes
      .map((key, i) => {
        const neutral = [...features];
        neutral[i] = 0.5;
        return { key, effect: score - predictSimulation(neutral) };
      })
      .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
    const strongest = effects[0]!;
    return {
      id: route.id,
      eligible: route.durationSeconds <= fastest + maxExtra * 60,
      low: score,
      high: score,
      score,
      coverage: 100 * (1 - attributes.reduce((sum, key) => sum + simulated[key], 0) / 4),
      reason:
        Math.abs(strongest.effect) < 0.1
          ? "Inputs are close to the model's neutral scenario."
          : `${priorityLabels[strongest.key]} input ${strongest.effect > 0 ? "raises" : "lowers"} this simulated rating most.`,
      inputs,
      simulated,
      values,
      nightFraction,
    };
  });
  const eligible = rows.filter((r) => r.eligible);
  const best = Math.max(...eligible.map((r) => r.score!));
  // Treat displayed one-decimal ties as ties, not a meaningful winning distinction.
  const leaders = eligible.filter((r) => r.score!.toFixed(1) === best.toFixed(1));
  const recommendedId = eligible.length > 1 && leaders.length === 1 ? leaders[0]!.id : undefined;
  return {
    rows,
    ...(recommendedId ? { recommendedId } : {}),
    message:
      routes.length === 1
        ? "Only one route returned; no comparison is possible."
        : eligible.length === 1
          ? "Only one route fits your time limit."
          : recommendedId
            ? "Highest model-predicted rating in this simulation."
            : "The model ratings are tied; walking time breaks the tie.",
  };
}
