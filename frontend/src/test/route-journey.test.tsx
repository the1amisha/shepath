import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getRoutes } = vi.hoisted(() => ({ getRoutes: vi.fn() }));
vi.mock("@/lib/routing", () => ({ routingProvider: "api", routingService: { getRoutes } }));
vi.mock("@/components/ShePathMap", () => ({ ShePathMap: ({ routes, selected }: { routes: {id: string}[]; selected: string }) => <div data-testid="map" data-routes={JSON.stringify(routes)} data-selected={selected} /> }));
import { ShePathApp } from "@/routes/index";
const route = { id: "heigit-foot-walking-route-1", distanceMeters: 1411.6, durationSeconds: 1016.4, coordinates: [[23.37, 85.32], [23.35, 85.33]], startPoint: [23.37, 85.32], endPoint: [23.35, 85.33] };
function start() {
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: /Plan a safer route/ }));
  fireEvent.click(screen.getByRole("button", { name: /Choose safety preferences/ }));
  fireEvent.click(screen.getByRole("button", { name: /Find my routes/ }));
}
afterEach(cleanup);
beforeEach(() => { getRoutes.mockReset(); });
describe("Real routing journey", () => {
  it("shares one fetched route with the map and details and never adds mock safety", async () => {
    getRoutes.mockResolvedValue([route]); start();
    await screen.findByRole("button", { name: /Fastest/ });
    expect(getRoutes).toHaveBeenCalledOnce();
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", JSON.stringify([route]));
    expect(screen.getByTestId("map")).toHaveAttribute("data-selected", route.id);
    expect(screen.queryByText(/mock safety/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /View route details/ }));
    expect(screen.getByText("1.4 km")).toBeInTheDocument();
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", JSON.stringify([route]));
    fireEvent.click(screen.getByRole("button", { name: /View full safety report/ }));
    expect(screen.getByRole("heading", { name: "Safety analysis not available yet" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /Plan a safer route/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Starting from/ }), { target: { value: "New origin" } });
    expect(getRoutes).not.toHaveBeenCalled();
  });
  it("shows loading with no fake routes", () => {
    getRoutes.mockImplementation(() => new Promise(() => {})); start();
    expect(screen.getByRole("status")).toHaveTextContent("Finding your routes");
    expect(screen.getByRole("button", { name: /View route details/ })).toBeDisabled();
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", "[]");
  });
  it("shows backend errors with no fake routes", async () => {
    getRoutes.mockRejectedValue(new Error("Geocoding failed")); start();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Geocoding failed"));
    expect(screen.getByTestId("map")).toHaveAttribute("data-routes", "[]");
  });
});
