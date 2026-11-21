import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelEvidenceCard } from "@/components/ModelEvidenceCard";
import { preferenceIsSeparated } from "@/lib/routing/recommendationSummary";
import type { HybridResult } from "@/lib/routing/hybridRecommendation";

const values = Object.fromEntries(
  ["footpath", "lighting", "shops", "pedestrians"].map((k) => [
    k,
    { low: 0, high: 1, source: "Unknown" },
  ]),
);
function result(low: number, high: number): HybridResult {
  return {
    recommendedId: "a",
    message: "",
    rows: [
      {
        id: "a",
        low,
        high,
        score: (low + high) / 2,
        eligible: true,
        coverage: 1,
        reason: "",
        values,
      },
      { id: "b", low: 0, high: 90, score: 45, eligible: true, coverage: 10, reason: "", values },
    ],
  } as HybridResult;
}
describe("presentation evidence", () => {
  it("does not call overlapping missing-input bounds a separated preference", () => {
    expect(preferenceIsSeparated(result(1, 100))).toBe(false);
    expect(preferenceIsSeparated(result(91, 100))).toBe(true);
    expect(preferenceIsSeparated(result(90, 100))).toBe(false);
    const single = result(91, 100);
    single.rows[1]!.eligible = false;
    expect(preferenceIsSeparated(single)).toBe(false);
    expect(preferenceIsSeparated({ rows: [], message: "" })).toBe(false);
  });
  it("displays the actual model and baseline evaluation without claiming a safety test", () => {
    render(<ModelEvidenceCard />);
    expect(screen.getAllByText("67.3%")).toHaveLength(2);
    expect(screen.getByText("0.638")).toBeInTheDocument();
    expect(screen.getByText("0.645")).toBeInTheDocument();
    expect(screen.getByText(/do not validate real-route safety/)).toBeInTheDocument();
  });
});
