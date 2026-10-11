import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/ranchi-comparison.json";
import { fetchSavedPilot, parseSavedPilot } from "@/lib/routing/savedPilot";
import { SavedRanchiPilot } from "@/components/SavedRanchiPilot";
import { ShePathApp } from "@/routes/index";

const { getRoutes } = vi.hoisted(() => ({ getRoutes: vi.fn() }));
vi.mock("@/lib/routing", () => ({ routingProvider: "api", routingService: { getRoutes } }));
vi.mock("@/components/ShePathMap", () => ({
  ShePathMap: ({ routes }: { routes: unknown[] }) => (
    <div data-testid="map" data-routes={JSON.stringify(routes)} />
  ),
}));
const copy = () => JSON.parse(JSON.stringify(fixture));
function respond(body: unknown = fixture, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: status === 200, status, json: async () => body }),
  );
}
beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "https://configured.example/api/");
  getRoutes.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Saved comparison contract and failures", () => {
  it("accepts the actual complete response captured from the comparison endpoint", async () => {
    respond();
    expect((await fetchSavedPilot()).comparison.routes).toHaveLength(3);
    expect(fetch).toHaveBeenCalledWith(
      "https://configured.example/api/pilot/ranchi/comparison",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it.each([409, 422, 503, 404, 500])("handles HTTP %s without fallback data", async (status) => {
    respond(
      {
        detail: {
          status: "unavailable",
          code: "artifact_missing",
          message: "Artifact unavailable",
        },
      },
      status,
    );
    render(<SavedRanchiPilot onBack={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(`HTTP ${status}`);
    expect(screen.queryByRole("region", { name: "Three saved routes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
  it("handles network failures and retries successfully", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce({ ok: true, json: async () => fixture }),
    );
    render(<SavedRanchiPilot onBack={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to reach");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Three saved routes" })).toBeInTheDocument();
  });
  it("requires configuration without a hardcoded fallback", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    respond();
    await expect(fetchSavedPilot()).rejects.toThrow("VITE_API_BASE_URL");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON and missing required artifacts", async () => {
    respond(null);
    await expect(fetchSavedPilot()).rejects.toThrow("incomplete");
    const data = copy();
    delete data.comparison;
    expect(() => parseSavedPilot(data)).toThrow("incomplete");
  });
  it.each(["snapshot", "geometry", "routes", "profiles", "feature hash", "timestamp"])(
    "rejects inconsistent %s identity",
    (kind) => {
      const data = copy();
      if (kind === "snapshot")
        data.comparison.source_provenance.saved_routes_sha256 = "a".repeat(64);
      if (kind === "geometry") {
        delete data.journey.geometrySha256ByRoute[data.journey.routeIds[0]];
        data.journey.geometrySha256ByRoute.unrelated = "a".repeat(64);
      }
      if (kind === "routes")
        data.comparison.routes[0].route_id = data.comparison.routes[1].route_id;
      if (kind === "profiles")
        data.comparison.profiles.distance_first.preference_fronts[0] = ["unrelated"];
      if (kind === "feature hash") data.integrity.featureDatasetSha256 = "a".repeat(64);
      if (kind === "timestamp")
        data.comparison.source_provenance.route_retrieved_at_utc = "different";
      expect(() => parseSavedPilot(data)).toThrow("identity mismatch");
    },
  );
});

describe("Saved pilot view", () => {
  it("shows loading and aborts when leaving", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );
    const { unmount } = render(<SavedRanchiPilot onBack={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading saved");
    const signal = vi.mocked(fetch).mock.calls[0]![1]!.signal!;
    unmount();
    expect(signal.aborted).toBe(true);
  });
  it("displays distances, observations, timestamps and saved profile tradeoffs", async () => {
    respond();
    render(<SavedRanchiPilot onBack={() => {}} />);
    const region = await screen.findByRole("region", { name: "Three saved routes" });
    expect(within(region).getAllByRole("article")).toHaveLength(3);
    expect(within(region).getByText("5,336.77 m")).toBeInTheDocument();
    expect(within(region).getByText("5,348.2 m")).toBeInTheDocument();
    expect(screen.getByText(fixture.journey.retrievedAtUtc)).toBeInTheDocument();
    expect(
      screen.getByText(fixture.comparison.source_provenance.OSM_snapshot_timestamp),
    ).toBeInTheDocument();
    expect(
      screen.getByText(fixture.comparison.source_feature_manifest.created_at_utc),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Saved preference profile"), {
      target: { value: "pareto_tradeoffs" },
    });
    expect(screen.getAllByText(/No strict preference between/)).toHaveLength(3);
    expect(screen.getByText(/Missing lighting or sidewalk tags mean unknown/)).toBeInTheDocument();
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
    expect(screen.queryByText(/\/ 100|safety score/i)).not.toBeInTheDocument();
  });
  it("preserves null or absent measurements as unknown and measured zero as zero", async () => {
    const data = copy();
    data.comparison.routes[0].criteria.business_proximity_percent = {
      value: null,
      availability: "unknown",
    };
    delete data.comparison.routes[0].criteria.healthcare_proximity_percent;
    data.comparison.routes[0].availability.lighting = null;
    delete data.comparison.source_provenance.OSM_snapshot_timestamp;
    respond(data);
    render(<SavedRanchiPilot onBack={() => {}} />);
    const region = await screen.findByRole("region", { name: "Three saved routes" });
    const first = within(region).getAllByRole("article")[0]!;
    expect(within(first).getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
    expect(within(first).getByText("0%")).toBeInTheDocument();
  });
  it("keeps matching live IDs and places separate and preserves the journey on return", async () => {
    const live = {
      id: fixture.journey.routeIds[0],
      distanceMeters: 1000,
      durationSeconds: 600,
      coordinates: [
        [1, 2],
        [3, 4],
      ],
      startPoint: [1, 2],
      endPoint: [3, 4],
    };
    getRoutes.mockResolvedValue([live]);
    respond();
    render(<ShePathApp />);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Compare walking routes/ }));
    fireEvent.change(screen.getByLabelText(/Going to/), {
      target: { value: fixture.journey.destination },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continue to preference preview/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to routes/ }));
    await screen.findByRole("button", { name: /Fastest/ });
    fireEvent.click(screen.getByRole("button", { name: "Saved Ranchi Pilot Comparison" }));
    await screen.findByRole("region", { name: "Three saved routes" });
    expect(
      screen.getByText(/snapshot and geometry identity cannot be verified/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to journey" }));
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", JSON.stringify([live]));
    expect(screen.queryByText(/Mapped proximity observations/)).not.toBeInTheDocument();
    expect(screen.getByText("Walking-route comparison.")).toBeInTheDocument();
    expect(getRoutes).toHaveBeenCalledOnce();
  });
});
