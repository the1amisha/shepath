import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import { segmentFixture } from "./segmentFixture";

const mocks = vi.hoisted(() => ({ line: vi.fn(), tooltip: vi.fn() }));
vi.mock("leaflet", () => ({
  map: () => ({ remove: vi.fn(), fitBounds: vi.fn(), invalidateSize: vi.fn() }),
  tileLayer: () => ({ on: vi.fn(), off: vi.fn(), addTo: vi.fn() }),
  control: { zoom: () => ({ addTo: vi.fn() }) },
  polyline: mocks.line,
  divIcon: vi.fn(),
  marker: () => ({ addTo: vi.fn() }),
  latLngBounds: vi.fn((value) => value),
}));
import { ShePathMap } from "@/components/ShePathMap";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("toggles segment lines and removes them when the selected route has no matching evidence", async () => {
  mocks.tooltip.mockImplementation(() => ({ addTo: vi.fn() }));
  mocks.line.mockImplementation(() => ({ addTo: vi.fn(), bindTooltip: mocks.tooltip }));
  const fixture = evidenceFixture();
  const state = {
    status: "complete",
    evidence: {
      ...fixture,
      route_context: { ...fixture.route_context, segment_evidence: segmentFixture() },
    },
  } as EvidenceState;
  const routes = [evidenceRoute, { ...evidenceRoute, id: "second" }];
  const { rerender } = render(
    <ShePathMap routes={routes} selected={evidenceRoute.id} evidenceState={state} />,
  );
  await waitFor(() => expect(mocks.line).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button", { name: "Show segment evidence" }));
  await waitFor(() => expect(mocks.tooltip).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Hide segment evidence" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(mocks.line).toHaveBeenCalledWith(
    segmentFixture().segments[1]!.coordinates,
    expect.objectContaining({ color: "#64748b" }),
  );
  rerender(<ShePathMap routes={routes} selected="second" evidenceState={state} />);
  await waitFor(() => expect(mocks.line).toHaveBeenCalledTimes(8));
  expect(screen.queryByRole("button", { name: /segment evidence/ })).not.toBeInTheDocument();
  expect(mocks.tooltip).toHaveBeenCalledTimes(2);
});
