import { describe, expect, it } from "vitest";
import {
  predictSimulation,
  simulationModel,
  simulationRecommendation,
  simulatedInputs,
} from "./simulationRecommendation";
import { attributes, type Recommendation } from "./liveRecommendation";
import { hybridOrder } from "./hybridRecommendation";
import { evidenceRoute } from "@/test/evidenceFixture";
const routes = [evidenceRoute, { ...evidenceRoute, id: "alternative", durationSeconds: 800 }];
const empty = { rows: [], message: "Waiting for evidence" };
const time = "2026-11-16T12:00";
function bounds(): Recommendation {
  return {
    message: "",
    rows: routes.map((r, i) => ({
      id: r.id,
      eligible: true,
      low: 0,
      high: 100,
      values: Object.fromEntries(
        attributes.map((key) => [key, { low: i, high: i, source: "Test proxy" }]),
      ) as Recommendation["rows"][number]["values"],
    })),
  };
}
describe("fitted simulation model", () => {
  it("matches independent sklearn predictions and rejects malformed inputs", () => {
    for (const vector of simulationModel.test_vectors)
      expect(predictSimulation(vector.inputs)).toBeCloseTo(vector.prediction, 9);
    for (const bad of [[], [1, 1, 1, 1, NaN], [1, 1, 1, 1, 2]])
      expect(() => predictSimulation(bad)).toThrow();
  });
  it("uses a learned night/lighting interaction", () => {
    const dimDay = predictSimulation([0.8, 0.1, 0.6, 0.4, 0]);
    const dimNight = predictSimulation([0.8, 0.1, 0.6, 0.4, 1]);
    expect(dimDay).toBeGreaterThan(dimNight);
    expect(predictSimulation([0.8, 1, 0.6, 0.4, 1])).toBeGreaterThan(dimNight);
  });
  it("is deterministic across route IDs, ordering and equal-distance geometry densification", () => {
    expect(simulatedInputs(routes[0]!)).toEqual(simulatedInputs(routes[1]!));
    const dense = {
      ...evidenceRoute,
      coordinates: [
        evidenceRoute.coordinates[0]!,
        [23.3575, 85.32] as [number, number],
        evidenceRoute.coordinates[1]!,
      ],
    };
    for (const key of attributes)
      expect(simulatedInputs(dense)[key]).toBeCloseTo(simulatedInputs(evidenceRoute)[key], 9);
    const a = simulationRecommendation(routes, empty, time);
    const b = simulationRecommendation([...routes].reverse(), empty, time);
    expect(a.rows[0]!.score).toEqual(b.rows[1]!.score);
    expect(a.recommendedId).toBeUndefined();
    expect(hybridOrder([...routes].reverse(), a)[0]!.id).toBe(evidenceRoute.id);
  });
  it("fills only unknown portions, preserves negatives, and never mutates evidence", () => {
    const source = bounds();
    source.rows[0]!.values.shops = { low: 0.2, high: 0.7, source: "Partial" };
    const before = JSON.stringify(source);
    const result = simulationRecommendation(routes, source, time);
    expect(JSON.stringify(source)).toBe(before);
    expect(result.rows[0]!.inputs.lighting).toBe(0);
    expect(result.rows[1]!.inputs.lighting).toBe(1);
    expect(result.rows[0]!.inputs.shops).toBeCloseTo(0.2 + 0.5 * simulatedInputs(routes[0]!).shops);
    expect(result.rows[0]!.simulated.shops).toBeCloseTo(0.5);
    expect(result.rows[1]!.coverage).toBe(100);
    expect(result.recommendedId).toBe("alternative");
    expect(hybridOrder(routes, result)[0]!.id).toBe("alternative");
  });
  it("can run on fully generated inputs when map evidence is unavailable without calling it observed", () => {
    const result = simulationRecommendation(routes, empty, time);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.coverage).toBe(0);
    expect(result.rows[0]!.simulated).toEqual({
      footpath: 1,
      lighting: 1,
      shops: 1,
      pedestrians: 1,
    });
  });
  it("honors time limits and abstains from a winner with one option", () => {
    const result = simulationRecommendation(routes, bounds(), time, 0);
    expect(result.rows[1]!.eligible).toBe(false);
    expect(hybridOrder(routes, result)[0]!.id).toBe(evidenceRoute.id);
    expect(result.recommendedId).toBeUndefined();
    expect(simulationRecommendation([evidenceRoute], empty, time).recommendedId).toBeUndefined();
  });
  it("rejects invalid geometry, durations, IDs, dates and time budgets", () => {
    expect(simulationRecommendation(routes, empty, "invalid").rows).toEqual([]);
    expect(simulationRecommendation(routes, empty, time, -1).rows).toEqual([]);
    for (const r of [
      { ...evidenceRoute, durationSeconds: NaN },
      { ...evidenceRoute, coordinates: [] },
      { ...evidenceRoute, durationSeconds: 172801 },
    ])
      expect(simulationRecommendation([r], empty, time).rows).toEqual([]);
    expect(simulationRecommendation([evidenceRoute, evidenceRoute], empty, time).rows).toEqual([]);
  });
});
