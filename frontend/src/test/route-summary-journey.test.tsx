import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import { segmentFixture } from "./segmentFixture";
const { getRoutes, fetchEvidence } = vi.hoisted(() => ({
  getRoutes: vi.fn(),
  fetchEvidence: vi.fn(),
}));
vi.mock("@/lib/routing", () => ({ routingProvider: "api", routingService: { getRoutes } }));
vi.mock("@/lib/routing/routeEvidence", () => ({ fetchRouteEvidence: fetchEvidence }));
vi.mock("@/components/ShePathMap", () => ({ ShePathMap: () => <div /> }));
import { ShePathApp } from "@/routes/index";
afterEach(cleanup);
it("updates the summary/comparator without requests and preserves the choice in overview", async () => {
  const routes = [
    evidenceRoute,
    { ...evidenceRoute, id: "second", durationSeconds: 340 },
    { ...evidenceRoute, id: "third", durationSeconds: 460 },
  ];
  getRoutes.mockResolvedValue(routes);
  fetchEvidence.mockImplementation(async (route: typeof evidenceRoute) => {
    const body = evidenceFixture(route);
    body.route_context.categories.healthcare_facilities.count = route.id === "second" ? 3 : 1;
    return {
      ...body,
      route_context: { ...body.route_context, segment_evidence: segmentFixture() },
    };
  });
  render(<ShePathApp />);
  for (const name of ["Plan my walk", "Continue to preferences", "Skip preferences"])
    fireEvent.click(screen.getByRole("button", { name }));
  const summary = await screen.findByRole("region", { name: "Route summary · Route 1" });
  expect(await within(summary).findByText(/1 mapped healthcare record\./)).toBeInTheDocument();
  expect(
    await within(summary).findByText(/2 fewer mapped healthcare records than Route 2/),
  ).toBeInTheDocument();
  fireEvent.change(within(summary).getByRole("combobox", { name: "Compare with" }), {
    target: { value: "third" },
  });
  expect(within(summary).getByText(/1 min faster than Route 3/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View route overview" }));
  expect(screen.getByRole("combobox", { name: "Compare with" })).toHaveValue("third");
  fireEvent.click(screen.getByRole("button", { name: /Go back/ }));
  fireEvent.click(screen.getByRole("button", { name: /Route 2 Not selected/ }));
  const second = screen.getByRole("region", { name: "Route summary · Route 2" });
  expect(within(second).getByText(/3 mapped healthcare records\./)).toBeInTheDocument();
  expect(within(second).getByRole("combobox", { name: "Compare with" })).toHaveValue("third");
  expect(getRoutes).toHaveBeenCalledTimes(1);
  expect(fetchEvidence).toHaveBeenCalledTimes(3);
});
