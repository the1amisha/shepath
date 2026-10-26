import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";

const mocks = vi.hoisted(() => ({
  map: vi.fn(), polyline: vi.fn(), tileLayer: vi.fn(), remove: vi.fn(), invalidateSize: vi.fn(),
  getRoutes: vi.fn(), fetchEvidence: vi.fn(), handlers: [] as (() => void)[], off: vi.fn(),
}));
vi.mock("leaflet", () => ({
  map: mocks.map, tileLayer: mocks.tileLayer, polyline: mocks.polyline,
  control: { zoom: () => ({ addTo: vi.fn() }) },
  divIcon: vi.fn(), marker: () => ({ addTo: vi.fn() }), latLngBounds: vi.fn(value => value),
}));
vi.mock("@/lib/routing", () => ({ routingProvider: "api", routingService: { getRoutes: mocks.getRoutes } }));
vi.mock("@/lib/routing/routeEvidence", () => ({ fetchRouteEvidence: mocks.fetchEvidence }));
import { ShePathMap } from "@/components/ShePathMap";
import { ShePathApp } from "@/routes/index";

beforeEach(() => {
  vi.clearAllMocks(); mocks.handlers.length = 0;
  mocks.map.mockReset().mockImplementation(() => ({ remove: mocks.remove, fitBounds: vi.fn(), invalidateSize: mocks.invalidateSize }));
  mocks.tileLayer.mockImplementation(() => ({
    on: (_event: string, callback: () => void) => mocks.handlers.push(callback), off: mocks.off, addTo: vi.fn(),
  }));
  mocks.polyline.mockImplementation(() => ({ addTo: vi.fn() }));
  mocks.getRoutes.mockResolvedValue([evidenceRoute]);
  mocks.fetchEvidence.mockResolvedValue(evidenceFixture());
});
afterEach(cleanup);

it("reports initialization failure with a bounded manual retry and no invented geometry", async () => {
  mocks.map.mockImplementation(() => { throw new Error("Map unavailable"); });
  render(<ShePathMap routes={[evidenceRoute]} selected={evidenceRoute.id} />);
  expect(await screen.findByRole("status")).toBeVisible();
  await screen.findByText(/The map could not be initialized/);
  for (let attempt = 0; attempt < 2; attempt++) {
    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
    await screen.findByText(/The map could not be initialized/);
  }
  expect(mocks.map).toHaveBeenCalledTimes(3);
  expect(screen.getByRole("button", { name: "Retry map" })).toBeDisabled();
  expect(screen.getByText(/Map retry limit reached/)).toBeVisible();
  expect(mocks.polyline).not.toHaveBeenCalled();
  expect(mocks.getRoutes).not.toHaveBeenCalled();
});

it("reports tile errors separately, retains attribution and retries only the exact supplied geometry", async () => {
  const { unmount } = render(<ShePathMap routes={[evidenceRoute]} selected={evidenceRoute.id} />);
  await waitFor(() => expect(mocks.polyline).toHaveBeenCalledOnce());
  act(() => mocks.handlers[0]!());
  expect(screen.getByRole("status")).toHaveTextContent("returned route information remains usable");
  expect(screen.getByText(/Basemap source:/)).toHaveTextContent("OpenStreetMap contributors");
  expect(mocks.tileLayer).toHaveBeenCalledWith(expect.stringContaining("tile.openstreetmap.org"), expect.objectContaining({ attribution: expect.stringContaining("OpenStreetMap") }));
  fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
  await waitFor(() => expect(mocks.polyline).toHaveBeenCalledTimes(2));
  act(() => mocks.handlers[0]!()); // Disposed map cannot change the new map's status.
  expect(screen.queryByText(/basemap tiles could not load/)).not.toBeInTheDocument();
  expect(mocks.polyline.mock.calls.map(call => call[0])).toEqual([evidenceRoute.coordinates, evidenceRoute.coordinates]);
  expect(mocks.invalidateSize).toHaveBeenCalledWith({ pan: false, animate: false });
  expect(mocks.getRoutes).not.toHaveBeenCalled();
  expect(mocks.fetchEvidence).not.toHaveBeenCalled();
  unmount();
  expect(mocks.off).toHaveBeenCalledTimes(2);
  expect(mocks.remove).toHaveBeenCalledTimes(2);
});

it("does not initialize or fabricate a route when there is no selected geometry", () => {
  render(<ShePathMap routes={[]} selected="" />);
  expect(screen.getByText(/map will appear when a route is available/)).toBeVisible();
  expect(mocks.map).not.toHaveBeenCalled();
  expect(mocks.polyline).not.toHaveBeenCalled();
});

it("keeps mock tile failure wording explicitly illustrative", async () => {
  render(<ShePathMap routes={[evidenceRoute]} selected={evidenceRoute.id} mock />);
  await waitFor(() => expect(mocks.polyline).toHaveBeenCalledOnce());
  act(() => mocks.handlers[0]!());
  expect(screen.getByRole("status")).toHaveTextContent("illustrative route preview remains a mock example");
});

it.each(["initialization", "tiles"])("retains route cards, evidence and navigation through %s failure and map retry", async failure => {
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Plan my walk" }));
  if (failure === "initialization") mocks.map.mockImplementation(() => { throw new Error("Initialization failed"); });
  fireEvent.click(screen.getByRole("button", { name: "Continue to preference preview" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to routes" }));
  await screen.findByText("7 mapped records");
  if (failure === "tiles") {
    await waitFor(() => expect(mocks.handlers.length).toBeGreaterThan(0));
    act(() => mocks.handlers.at(-1)!());
  }
  const mapRegion = screen.getByRole("region", { name: "Route comparison map" });
  await within(mapRegion).findByRole("button", { name: "Retry map" });
  const card = screen.getByRole("button", { name: /Route 1 Selected/ });
  expect(card).toHaveTextContent("7 min"); expect(card).toHaveTextContent("0.6 km");
  expect(screen.getByRole("button", { name: "View route overview" })).toBeEnabled();
  const requestsBefore = mocks.map.mock.calls.length;
  fireEvent.click(within(mapRegion).getByRole("button", { name: "Retry map" }));
  await waitFor(() => expect(mocks.map).toHaveBeenCalledTimes(requestsBefore + 1));
  expect(mocks.getRoutes).toHaveBeenCalledOnce();
  expect(mocks.fetchEvidence).toHaveBeenCalledOnce();
  expect(mocks.fetchEvidence.mock.calls[0]![0]).toEqual(evidenceRoute);
  expect(card).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "View route overview" }));
  expect(screen.getByRole("button", { name: /View geographic evidence/ })).toBeEnabled();
  await act(async () => {});
});

