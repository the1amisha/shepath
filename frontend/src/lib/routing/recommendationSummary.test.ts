import { describe, expect, it } from "vitest";
import { evidenceFixture, evidenceRoute } from "@/test/evidenceFixture";
import { segmentFixture } from "@/test/segmentFixture";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import { attributes, type Recommendation } from "./liveRecommendation";
import { hybridRecommendation } from "./hybridRecommendation";
import { recommendationSummary } from "./recommendationSummary";
const routes = [evidenceRoute, { ...evidenceRoute, id: "longer", durationSeconds: 700 }];
const priorities = { footpath: 0, lighting: 1, shops: 0, pedestrians: 0 };
function result() {
  return hybridRecommendation(
    {
      message: "",
      rows: routes.map((r, i) => ({
        id: r.id,
        eligible: true,
        low: 0,
        high: 100,
        values: Object.fromEntries(
          attributes.map((key) => [key, { low: i, high: i, source: "Test" }]),
        ) as Recommendation["rows"][number]["values"],
      })),
    },
    priorities,
  );
}
function states(): Record<string, EvidenceState> {
  return Object.fromEntries(
    routes.map((r, i) => {
      const evidence = evidenceFixture(r);
      evidence.route_context.categories.shops_and_businesses.count = i ? 4 : 7;
      const segment = segmentFixture();
      segment.longest_facility_gap.length_metres = i ? 50 : 150;
      return [
        r.id,
        {
          status: "complete",
          evidence: {
            ...evidence,
            route_context: { ...evidence.route_context, segment_evidence: segment },
          },
        } as EvidenceState,
      ];
    }),
  );
}
describe("recommendation summary", () => {
  it("explains the active inputs and separates contextual facts from model reasons", () => {
    const summary = recommendationSummary(routes, result(), states(), priorities)!;
    expect(summary.route.id).toBe("longer");
    expect(summary.extra).toBe("5 min extra");
    expect(summary.reason).toBe(
      "Compared with Route 1, a higher share of nearby roads is tagged as lit.",
    );
    expect(summary.facts).toEqual([
      "3 fewer mapped businesses nearby",
      "100 m shorter gap without mapped shops or healthcare",
    ]);
    expect(summary.custom).toBe(true);
  });
  it("never compares contextual facts across snapshots or failed evidence", () => {
    const input = states();
    const longer = input["longer"]!;
    if (longer.status === "complete")
      longer.evidence.source_provenance.manifest_sha256 = "f".repeat(64);
    expect(recommendationSummary(routes, result(), input, priorities)?.facts).toEqual([]);
    delete input["longer"];
    expect(recommendationSummary(routes, result(), input, priorities)?.facts).toEqual([]);
  });
  it("does not invent a winner when scores tie or are absent", () => {
    const tied = result();
    delete tied.recommendedId;
    expect(recommendationSummary(routes, tied, states())).toBeNull();
    const missing = result();
    delete missing.rows[1]!.score;
    expect(recommendationSummary(routes, missing, states())).toBeNull();
  });
  it("exposes sparse data and a winner caused only by the time limit", () => {
    const sparse = result();
    sparse.rows[1]!.coverage = 1;
    expect(recommendationSummary(routes, sparse, states())?.limited).toBe(true);
    sparse.rows[0]!.eligible = false;
    expect(recommendationSummary(routes, sparse, states())?.reason).toBe(
      "Only this route fits your extra-time limit.",
    );
  });
});
