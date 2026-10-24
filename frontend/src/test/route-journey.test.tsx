import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { evidenceFixture } from "./evidenceFixture";
const { getRoutes, fetchEvidence } = vi.hoisted(() => ({ getRoutes: vi.fn(), fetchEvidence: vi.fn() }));
vi.mock("@/lib/routing/routeEvidence", () => ({ fetchRouteEvidence: fetchEvidence }));
vi.mock("@/lib/routing", () => ({ routingProvider: "api", routingService: { getRoutes } }));
vi.mock("@/components/ShePathMap", () => ({ ShePathMap: ({ routes, selected }: { routes: {id: string}[]; selected: string }) => <div data-testid="map" data-routes={JSON.stringify(routes)} data-selected={selected} /> }));
import { ShePathApp } from "@/routes/index";
const route = { id: "heigit-foot-walking-route-1", distanceMeters: 1411.6, durationSeconds: 1016.4, coordinates: [[23.37, 85.32], [23.35, 85.33]], startPoint: [23.37, 85.32], endPoint: [23.35, 85.33] };
function start() {
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: /Plan my walk/ }));
  fireEvent.click(screen.getByRole("button", { name: /Continue to preference preview/ }));
  fireEvent.click(screen.getByRole("button", { name: /Continue to routes/ }));
}
afterEach(cleanup);
beforeEach(() => { getRoutes.mockReset(); fetchEvidence.mockReset().mockRejectedValue(new Error("Evidence unavailable")); });
describe("Real routing journey", () => {
  it("keeps different evidence with each selected route when navigating details", async () => {
    const other = { ...route, id: "other", durationSeconds: 800 };
    const firstEvidence = evidenceFixture();
    const secondEvidence = evidenceFixture(); secondEvidence.route_context.categories.shops_and_businesses.count = 9;
    getRoutes.mockResolvedValue([route, other]); fetchEvidence.mockResolvedValueOnce(firstEvidence).mockResolvedValueOnce(secondEvidence);
    start(); await screen.findByText("9 mapped records");
    fireEvent.click(screen.getByRole("button", { name: /Fastest/ }));
    fireEvent.click(screen.getByRole("button", { name: /View route overview/ }));
    expect(screen.getByText("9 mapped records")).toBeInTheDocument();
    expect(screen.queryByText("7 mapped records")).not.toBeInTheDocument();
    expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "other");
    expect(fetchEvidence).toHaveBeenCalledTimes(2);
  });
  it("shows dynamic evidence without changing map geometry or route selection", async () => {
    getRoutes.mockResolvedValue([route]); fetchEvidence.mockResolvedValue(evidenceFixture()); start();
    await screen.findByText("7 mapped records");
    expect(fetchEvidence.mock.calls[0]![0]).toEqual(route);
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", JSON.stringify([route]));
    expect(screen.getByRole("button", { name: /View route overview/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /View route overview/ }));
    expect(screen.getByText("7 mapped records")).toBeInTheDocument();
    expect(fetchEvidence).toHaveBeenCalledOnce();
  });
  it("keeps a route usable if evidence fails", async () => {
    getRoutes.mockResolvedValue([route]); start();
    await screen.findByText(/Route 1: Evidence unavailable/);
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", JSON.stringify([route]));
    expect(screen.getByRole("button", { name: /View route overview/ })).toBeEnabled();
  });
  it("does not analyze a late routing response after editing the journey", async () => {
    let finish!: (routes: typeof route[]) => void;
    getRoutes.mockImplementation(() => new Promise(resolve => { finish = resolve; })); start();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Starting from/ }), { target: { value: "Another journey" } });
    await act(async () => finish([route]));
    expect(fetchEvidence).not.toHaveBeenCalled();
  });
  it("shares one fetched route with the map and details and never adds mock safety", async () => {
    getRoutes.mockResolvedValue([route]); start();
    await screen.findByRole("button", { name: /Fastest/ });
    expect(getRoutes).toHaveBeenCalledOnce();
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", JSON.stringify([route]));
    expect(screen.getByTestId("map")).toHaveAttribute("data-selected", route.id);
    expect(screen.queryByText(/mock safety/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /View route overview/ }));
    expect(screen.getByText("1.4 km")).toBeInTheDocument();
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", JSON.stringify([route]));
    fireEvent.click(screen.getByRole("button", { name: /View geographic evidence/ }));
    expect(screen.getByRole("heading", { name: "Geographic evidence" })).toBeInTheDocument();
    expect(screen.queryByText("94")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Go back/ }));
    fireEvent.click(screen.getByRole("button", { name: /Go back/ }));
    expect(getRoutes).toHaveBeenCalledOnce();
  });
  it("supports multiple arbitrary IDs and changes the selected map route", async () => {
    const alternative = { ...route, id: "another-backend-id", durationSeconds: 800 };
    getRoutes.mockResolvedValue([route, alternative]); start();
    await screen.findByRole("button", { name: /Route 1/ });
    fireEvent.click(screen.getByRole("button", { name: /Fastest/ }));
    expect(screen.getByTestId("map")).toHaveAttribute("data-selected", alternative.id);
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", JSON.stringify([route, alternative]));
    expect(getRoutes).toHaveBeenCalledOnce();
  });
  it("does not request routes on Welcome or while typing", () => {
    render(<ShePathApp />);
    expect(getRoutes).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Plan my walk/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Starting from/ }), { target: { value: "New origin" } });
    expect(getRoutes).not.toHaveBeenCalled();
  });
  it("shows loading with no fake routes", () => {
    getRoutes.mockImplementation(() => new Promise(() => {})); start();
    expect(screen.getByRole("status")).toHaveTextContent("Finding your routes");
    expect(screen.getByRole("button", { name: /View route overview/ })).toBeDisabled();
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", "[]");
  });
  it("shows backend errors with no fake routes", async () => {
    getRoutes.mockRejectedValue(new Error("Geocoding failed")); start();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Geocoding failed"));
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", "[]");
  });
});

