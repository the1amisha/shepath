import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import { segmentFixture } from "./segmentFixture";
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
it("reorders cards after evidence arrives, preserves names/selection, and reset restores order", async () => {
  const routes = [evidenceRoute, { ...evidenceRoute, id: "second" }];
  getRoutes.mockResolvedValue(routes);
  fetchEvidence.mockImplementation(async (route: typeof evidenceRoute) => {
    const body = evidenceFixture(route);
    return {
      ...body,
      route_context: {
        ...body.route_context,
        segment_evidence: {
          ...segmentFixture(),
          lighting_unknown_percent: route.id === "second" ? 10 : 90,
        },
      },
    };
  });
  render(<ShePathApp />);
  for (const name of ["Plan my walk", "Continue to preferences"])
    fireEvent.click(screen.getByRole("button", { name }));
  fireEvent.change(screen.getByRole("slider", { name: /^Lighting/ }), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to routes" }));
  const order = () =>
    [...document.querySelectorAll("[data-route-card]")].map((e) =>
      e.getAttribute("data-route-card"),
    );
  await waitFor(() => expect(order()).toEqual(["second", evidenceRoute.id]));
  expect(screen.getByRole("button", { name: /Route 1 Selected/ })).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", evidenceRoute.id);
  fireEvent.click(screen.getByRole("button", { name: /Route 2 Not selected/ }));
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "second");
  fireEvent.click(screen.getByText("Adjust evidence preferences"));
  fireEvent.click(screen.getByRole("button", { name: "Reset weights" }));
  expect(order()).toEqual([evidenceRoute.id, "second"]);
  expect(screen.getByRole("button", { name: /Route 2 Selected/ })).toBeInTheDocument();
  expect(fetchEvidence).toHaveBeenCalledTimes(2);
  expect(getRoutes).toHaveBeenCalledTimes(1);
});
