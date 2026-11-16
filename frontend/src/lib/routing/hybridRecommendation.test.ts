import { describe, expect, it } from "vitest";
import { hybridRecommendation, hybridOrder } from "./hybridRecommendation";
import { attributes, type Recommendation } from "./liveRecommendation";
import type { RouteData } from "./types";
const weights = { footpath: 1, lighting: 1, shops: 0, pedestrians: 0 };
function input(values: number[][]): Recommendation {
  return {
    message: "Pending",
    rows: values.map((v, i) => ({
      id: String(i),
      eligible: true,
      low: 0,
      high: 100,
      values: Object.fromEntries(
        attributes.map((key, j) => [
          key,
          {
            low: v[j] ?? 0,
            high: v[j] ?? 1,
            source: "Test",
          },
        ]),
      ) as Recommendation["rows"][number]["values"],
    })),
  };
}
describe("hybrid scoring", () => {
  it("ranks by active weights and reranks when priorities change", () => {
    const source = input([
      [1, 0],
      [0, 1],
    ]);
    expect(hybridRecommendation(source, { ...weights, footpath: 2 }).recommendedId).toBe("0");
    expect(hybridRecommendation(source, { ...weights, lighting: 2 }).recommendedId).toBe("1");
  });
  it("distinguishes unknown from negative and reports weighted coverage", () => {
    expect(hybridRecommendation(input([[]]), weights).rows[0]?.score).toBeUndefined();
    const partial = hybridRecommendation(input([[0]]), weights).rows[0]!;
    expect(partial.score).toBe(25);
    expect(partial.coverage).toBe(50);
    expect(hybridRecommendation(input([[0, 0]]), weights).rows[0]?.score).toBe(0);
  });
  it("keeps unavailable evidence unavailable and rejects invalid weights", () => {
    expect(hybridRecommendation({ rows: [], message: "Snapshots differ" }, weights).message).toBe(
      "Snapshots differ",
    );
    expect(hybridRecommendation(input([[1, 1]]), { ...weights, footpath: NaN }).rows).toEqual([]);
    expect(
      hybridRecommendation(input([[1, 1]]), { footpath: 0, lighting: 0, shops: 0, pedestrians: 0 })
        .rows,
    ).toEqual([]);
  });
  it("honors time eligibility and resolves score ties by time", () => {
    const source = input([
      [1, 1],
      [0, 0],
    ]);
    source.rows[0]!.eligible = false;
    const result = hybridRecommendation(source, weights);
    expect(result.recommendedId).toBe("1");
    const routes = [
      { id: "0", durationSeconds: 120, distanceMeters: 20 },
      { id: "1", durationSeconds: 60, distanceMeters: 10 },
    ] as RouteData[];
    expect(hybridOrder(routes, result).map((r) => r.id)).toEqual(["1", "0"]);
    const tied = hybridRecommendation(
      input([
        [1, 1],
        [1, 1],
      ]),
      weights,
    );
    expect(tied.recommendedId).toBeUndefined();
    expect(hybridOrder(routes, tied).map((r) => r.id)).toEqual(["1", "0"]);
  });
});
