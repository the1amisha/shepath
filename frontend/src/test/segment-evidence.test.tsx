import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SegmentEvidencePanel } from "@/components/SegmentEvidencePanel";
import { segmentEvidenceSchema } from "@/lib/routing/segmentEvidence";
import { fetchRouteEvidence } from "@/lib/routing/routeEvidence";
import { segmentFixture } from "./segmentFixture";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("explains the gap, missing tags and per-stretch counts without relying on colors", () => {
  render(<SegmentEvidencePanel evidence={segmentFixture()} />);
  expect(screen.getByText("150 m")).toBeVisible();
  expect(screen.getByText("50.0%")).toBeVisible();
  expect(
    within(screen.getByText("Read evidence for each stretch").closest("details")!).getByText(
      /Stretch 2: 150–300 m/,
    ),
  ).toBeInTheDocument();
  expect(screen.getByText(/not the conditions on the street/)).toBeVisible();
  expect(screen.getByText(/do not add these counts together/)).toBeInTheDocument();
});

it("rejects overlapping segment ranges and out-of-range percentages", () => {
  const value = segmentFixture();
  value.segments[1]!.start_metres = 100;
  expect(segmentEvidenceSchema.safeParse(value).success).toBe(false);
  const other = segmentFixture();
  other.lighting_unknown_percent = 101;
  expect(segmentEvidenceSchema.safeParse(other).success).toBe(false);
});

it("retains segment geometry only inside the matched route evidence response", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8011");
  const body = evidenceFixture();
  const full = {
    ...body,
    route_context: { ...body.route_context, segment_evidence: segmentFixture() },
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(full))));
  const evidence = await fetchRouteEvidence(evidenceRoute, new AbortController().signal);
  expect(evidence.route_context?.segment_evidence?.segments).toHaveLength(2);
  expect(evidence.route_context).not.toHaveProperty("source_features");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...full, route: { ...body.route, id: "wrong-route" } })),
      ),
  );
  await expect(fetchRouteEvidence(evidenceRoute, new AbortController().signal)).rejects.toThrow(
    /does not match/,
  );
});
