import { describe, expect, it } from "vitest";
import { evidenceFixture, evidenceRoute } from "@/test/evidenceFixture";
import { segmentFixture } from "@/test/segmentFixture";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import { attributes, type Recommendation } from "./liveRecommendation";
import { hybridRecommendation } from "./hybridRecommendation";
import { timeFallbackSummary, recommendationSummary } from "./recommendationSummary";
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

describe("time fallback card summaries", () => {
  const a = { ...evidenceRoute, id: "a", durationSeconds: 10860, distanceMeters: 15100 };
  const b = { ...a, id: "b", durationSeconds: 10920, distanceMeters: 15200 };
  const empty = { rows: [], message: "" };
  it("explains fastest and slower ranks from travel time", () => {
    expect(timeFallbackSummary(a, [a, b], empty)).toBe(
      "Fastest estimated walk; ranked by travel time.",
    );
    expect(timeFallbackSummary(b, [a, b], empty)).toContain(
      "About 1 minute longer than the fastest",
    );
  });
  it("does not round a sub-minute difference to zero", () => {
    expect(timeFallbackSummary({ ...b, durationSeconds: 10880 }, [a, b], empty)).toContain(
      "Less than 1 minute",
    );
  });
  it("explains distance and stable-order ties", () => {
    const tied = { ...b, durationSeconds: a.durationSeconds };
    expect(timeFallbackSummary(a, [a, tied], empty)).toContain("shorter routes are listed first");
    expect(timeFallbackSummary(a, [a, { ...a, id: "b" }], empty)).toContain(
      "original route order retained",
    );
  });
  it("distinguishes preference ordering and the time limit from fastest overall", () => {
    const { score: _score, ...template } = result().rows[0]!;
    void _score;
    const mixed = {
      rows: [
        { ...template, id: "b", score: 60 },
        { ...template, id: "a" },
      ],
      message: "",
    };
    expect(timeFallbackSummary(a, [a, b], mixed)).toContain(
      "Placed after routes with a preference match",
    );
    expect(
      timeFallbackSummary(a, [a, b], {
        ...mixed,
        rows: mixed.rows.map((r) => (r.id === "a" ? { ...r, eligible: false } : r)),
      }),
    ).toContain("Outside your extra-time limit");
  });
  it("does not imply a comparison when only one route was returned", () => {
    expect(timeFallbackSummary(a, [a], empty)).toBe("Only route returned for this journey.");
  });
});
