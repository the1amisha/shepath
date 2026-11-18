import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ShePathMap } from "@/components/ShePathMap";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
const mocks = vi.hoisted(() => ({ remove: vi.fn(), popup: vi.fn() }));
vi.mock("leaflet", () => ({
  map: () => ({ remove: mocks.remove, fitBounds: vi.fn(), invalidateSize: vi.fn() }),
  tileLayer: () => ({ on: vi.fn(), off: vi.fn(), addTo: vi.fn() }),
  polyline: () => ({ addTo: vi.fn() }),
  control: { zoom: () => ({ addTo: vi.fn() }) },
  divIcon: vi.fn(),
  latLngBounds: vi.fn(),
  marker: () => ({ addTo: vi.fn(), bindPopup: mocks.popup }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("renders facility text safely, supports toggling, and clears stale markers on route changes", async () => {
  mocks.popup.mockImplementation(() => ({ addTo: vi.fn() }));
  const fixture = evidenceFixture();
  const evidenceState = {
    status: "complete",
    evidence: {
      ...fixture,
      route_context: {
        ...fixture.route_context,
        facility_markers: [
          {
            id: "node/12",
            kind: "pharmacy",
            name: "<img src=x onerror=alert(1)>",
            position: [23.356, 85.32],
            outline: false,
            openingHours: null,
          },
        ],
      },
    },
  } as EvidenceState;
  const routes = [evidenceRoute, { ...evidenceRoute, id: "other" }];
  const view = render(
    <ShePathMap routes={routes} selected={evidenceRoute.id} evidenceState={evidenceState} />,
  );
  await waitFor(() => expect(mocks.popup).toHaveBeenCalledTimes(1));
  const popup = mocks.popup.mock.calls[0]![0] as HTMLElement;
  expect(popup.querySelector("img")).toBeNull();
  expect(popup.textContent).toContain("<img src=x onerror=alert(1)>");
  expect(popup.textContent).toContain("Opening hours unknown");
  fireEvent.click(screen.getByRole("button", { name: "Hide nearby places" }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
  expect(mocks.popup).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Show nearby places" }));
  await waitFor(() => expect(mocks.popup).toHaveBeenCalledTimes(2));
  view.rerender(<ShePathMap routes={routes} selected="other" evidenceState={evidenceState} />);
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(3));
  expect(screen.queryByRole("button", { name: "Hide nearby places" })).not.toBeInTheDocument();
  expect(mocks.popup).toHaveBeenCalledTimes(2);
});
