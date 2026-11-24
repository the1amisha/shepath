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
it("keeps model experiments separate and preserves the chosen live route when returning", async () => {
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
  fireEvent.click(screen.getByRole("button", { name: "Plan my journey" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to preferences" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to routes" }));
  await screen.findByRole("heading", { name: "Similar matches" });
  await waitFor(() =>
    expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "alternative"),
  );
  expect(document.querySelector("[data-route-card]")).toHaveAttribute(
    "data-route-card",
    "alternative",
  );
  expect(screen.getByRole("button", { name: "View top match" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /View fastest/ })).toBeInTheDocument();
  expect(screen.queryByText("Presentation demo")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Simulation-based ML routes")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Route 1 Not selected/ }));
  fireEvent.click(screen.getByRole("button", { name: "Model lab" }));
  expect(screen.getByText(/Hypothetical inputs/)).toBeInTheDocument();
  const before = screen.getByRole("status").textContent;
  fireEvent.change(screen.getByLabelText("Lighting"), { target: { value: "1" } });
  expect(screen.getByRole("status").textContent).not.toBe(before);
  fireEvent.click(screen.getByRole("button", { name: "Back to journey" }));
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", evidenceRoute.id);
  expect(screen.queryByText(/Simulated model rating/)).not.toBeInTheDocument();
  expect(getRoutes).toHaveBeenCalledTimes(1);
  const card = document.querySelector("[data-route-card]");
  expect(card?.querySelector("details")).not.toHaveAttribute("open");
  expect(screen.getByText("Compare route details").closest("details")).not.toHaveAttribute("open");
});
