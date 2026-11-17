import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
const { getRoutes, fetchEvidence } = vi.hoisted(() => ({
  getRoutes: vi.fn(),
  fetchEvidence: vi.fn(),
}));
vi.mock("@/lib/routing", () => ({ routingProvider: "api", routingService: { getRoutes } }));
vi.mock("@/lib/routing/routeEvidence", () => ({ fetchRouteEvidence: fetchEvidence }));
vi.mock("@/components/ShePathMap", () => ({
  ShePathMap: ({ selected }: { selected: string }) => (
    <div data-testid="map" data-selected={selected} />
  ),
}));
import { ShePathApp } from "@/routes/index";
afterEach(cleanup);
it("opts in, auto-selects the ML leader, preserves manual choice, and carries simulation labels to overview", async () => {
  const routes = [evidenceRoute, { ...evidenceRoute, id: "alternative", durationSeconds: 800 }];
  getRoutes.mockResolvedValue(routes);
  fetchEvidence.mockImplementation(async (route: typeof evidenceRoute) => {
    const e = evidenceFixture(route);
    const yes = route.id === "alternative" ? 10 : 0;
    e.route_context.lighting.states.yes.object_availability = {
      numerator: yes,
      denominator: 10,
      percent: yes * 10,
    };
    e.route_context.lighting.states.no.object_availability = {
      numerator: 10 - yes,
      denominator: 10,
      percent: 100 - yes * 10,
    };
    return e;
  });
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Try simulation-based ML routes" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to preferences" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to routes" }));
  await screen.findByRole("heading", { name: "Simulation-based ML recommendation" });
  await waitFor(() =>
    expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "alternative"),
  );
  expect(document.querySelector("[data-route-card]")).toHaveAttribute(
    "data-route-card",
    "alternative",
  );
  expect(screen.getByText("ML demo recommendation")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Route 1 Not selected/ }));
  fireEvent.change(screen.getByLabelText("Departure (IST)"), {
    target: { value: "2026-11-16T22:00" },
  });
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", evidenceRoute.id);
  expect(screen.getAllByText(/Simulated rating/)).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: /View route overview/ }));
  expect(screen.getByText(/Simulation mode · real routes/)).toBeInTheDocument();
  expect(screen.getByText(/Simulated rating/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Simulation-based ML routes"));
  expect(screen.queryByText(/Simulation mode · real routes/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Simulated rating/)).not.toBeInTheDocument();
  expect(getRoutes).toHaveBeenCalledTimes(1);
});
