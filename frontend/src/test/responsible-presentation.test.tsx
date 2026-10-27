import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { evidenceFixture } from "./evidenceFixture";
const { getRoutes, fetchEvidence } = vi.hoisted(() => ({
  getRoutes: vi.fn(),
  fetchEvidence: vi.fn(),
}));
vi.mock("@/lib/routing", () => ({ routingProvider: "api", routingService: { getRoutes } }));
vi.mock("@/lib/routing/routeEvidence", () => ({ fetchRouteEvidence: fetchEvidence }));
vi.mock("@/components/ShePathMap", () => ({
  ShePathMap: ({ routes, selected }: { routes: unknown; selected: string }) => (
    <div data-testid="map" data-routes={JSON.stringify(routes)} data-selected={selected} />
  ),
}));
import { Route, ShePathApp } from "@/routes/index";
import { Route as RootRoute } from "@/routes/__root";

const route = {
  id: "first",
  distanceMeters: 1200,
  durationSeconds: 90,
  coordinates: [
    [23.37, 85.32],
    [23.35, 85.33],
  ],
  startPoint: [23.37, 85.32],
  endPoint: [23.35, 85.33],
};
afterEach(cleanup);
beforeEach(() => {
  getRoutes.mockReset().mockResolvedValue([route]);
  fetchEvidence.mockReset().mockResolvedValue(evidenceFixture());
});
function search() {
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Plan my walk" }));
}
function preferences() {
  search();
  fireEvent.click(screen.getByRole("button", { name: "Continue to preference preview" }));
}

it("uses responsible landing and page/social metadata without mock scores", async () => {
  render(<ShePathApp />);
  expect(screen.getByText(/historical mapped context where covered/)).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Illustration of a woman walking along a leafy path" }),
  ).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/92|86%|best balance|safer route|safety score/i);
  for (const configuredRoute of [Route, RootRoute]) {
    const head = await configuredRoute.options.head?.({} as never);
    const metadata = JSON.stringify(head?.meta);
    expect(metadata).toMatch(/historical mapped geographic evidence/);
    expect(metadata).not.toMatch(/safer routes|safety-aware|clear scores/i);
  }
});

it("rejects whitespace with associated errors and submits trimmed locations through the native form", async () => {
  search();
  const origin = screen.getByRole("textbox", { name: "Starting from" });
  const destination = screen.getByRole("textbox", { name: "Going to" });
  fireEvent.change(origin, { target: { value: "   " } });
  fireEvent.change(destination, { target: { value: "\t " } });
  const submit = screen.getByRole("button", { name: "Continue to preference preview" });
  expect(submit).toHaveAttribute("type", "submit");
  expect(origin.closest("form")).toBe(destination.closest("form"));
  fireEvent.submit(origin.closest("form")!);
  expect(origin).toHaveAttribute("aria-invalid", "true");
  expect(origin).toHaveAccessibleDescription("Enter a starting place.");
  expect(destination).toHaveAccessibleDescription("Enter a destination.");
  expect(getRoutes).not.toHaveBeenCalled();
  fireEvent.change(origin, { target: { value: "  Origin  " } });
  fireEvent.change(destination, { target: { value: "  Destination  " } });
  fireEvent.submit(origin.closest("form")!);
  fireEvent.click(screen.getByRole("button", { name: "Skip preference preview" }));
  await screen.findByRole("button", { name: /Route 1 Selected/ });
  expect(getRoutes).toHaveBeenCalledWith({
    origin: "Origin",
    destination: "Destination",
    travelMode: "walk",
  });
});

it("explains the buffer before generation and destination presets do not submit", () => {
  search();
  expect(screen.getByText(/entire route and its 100 m buffer/)).toHaveTextContent(
    "a Ranchi place name does not guarantee coverage",
  );
  fireEvent.click(screen.getByRole("button", { name: "Doranda, Ranchi" }));
  expect(screen.getByRole("textbox", { name: "Going to" })).toHaveValue("Doranda, Ranchi");
  expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
  expect(getRoutes).not.toHaveBeenCalled();
});

it("exposes optional preference toggles without adding preferences to routing", async () => {
  preferences();
  expect(screen.getByText(/They do not affect routing/)).toBeInTheDocument();
  const lighting = screen.getByRole("button", { name: /^Lighting/ });
  expect(lighting).toHaveAttribute("aria-pressed", "false");
  lighting.focus();
  expect(lighting).toHaveFocus();
  fireEvent.click(lighting);
  expect(lighting).toHaveAttribute("aria-pressed", "true");
  expect(within(lighting).getByText("Selected")).toBeInTheDocument();
  fireEvent.click(lighting);
  expect(lighting).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(lighting);
  fireEvent.click(screen.getByRole("button", { name: "Continue to routes" }));
  await screen.findByText("7 mapped records");
  expect(getRoutes.mock.calls[0]![0]).toEqual({
    origin: "Albert Ekka Chowk, Ranchi",
    destination: "Ranchi Railway Station, Ranchi",
    travelMode: "walk",
  });
  expect(fetchEvidence.mock.calls[0]![0]).toEqual(route);
});

it("keeps tied options unique, distance visible, and selection separate from fastest", async () => {
  getRoutes.mockResolvedValue([
    route,
    { ...route, id: "second", durationSeconds: 30, distanceMeters: 800 },
    { ...route, id: "third", durationSeconds: 30 },
  ]);
  preferences();
  fireEvent.click(screen.getByRole("button", { name: "Skip preference preview" }));
  const first = await screen.findByRole("button", { name: /Route 1 Selected/ });
  const second = screen.getByRole("button", { name: /Route 2 Not selected/ });
  expect(first).toHaveAttribute("aria-pressed", "true");
  expect(first).not.toHaveTextContent("Fastest");
  expect(first).toHaveTextContent("1.2 km");
  expect(second).toHaveTextContent("0.8 km");
  expect(second).toHaveTextContent("Less than 1 min");
  expect(screen.getAllByText("Fastest estimate (tied)")).toHaveLength(2);
  expect(screen.getByText(/first returned route is selected initially/)).toBeInTheDocument();
  fireEvent.click(second);
  expect(second).toHaveAttribute("aria-pressed", "true");
  expect(first).toHaveAttribute("aria-pressed", "false");
  expect(within(second).getByText("Selected")).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "second");
});

it("preserves selected evidence through overview and report with heading first and compatible map height", async () => {
  const other = {
    ...route,
    id: "other",
    coordinates: [
      [23.36, 85.32],
      [23.35, 85.33],
    ],
  };
  const secondEvidence = evidenceFixture();
  secondEvidence.route_context.categories.shops_and_businesses.count = 9;
  getRoutes.mockResolvedValue([route, other]);
  fetchEvidence.mockResolvedValueOnce(evidenceFixture()).mockResolvedValueOnce(secondEvidence);
  preferences();
  fireEvent.click(screen.getByRole("button", { name: "Continue to routes" }));
  await screen.findByText(/Route 2: Mapped evidence available/);
  expect(screen.getByRole("heading", { level: 2, name: "Route 2" })).toBeInTheDocument();
  expect(screen.queryByText("9 mapped records")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Route 2 Not selected/ }));
  fireEvent.click(screen.getByRole("button", { name: "View route overview" }));
  expect(screen.getByText("Step 4 of 5")).toBeInTheDocument();
  expect(screen.getByTestId("overview-map-frame")).toHaveClass("min-h-[360px]");
  expect(screen.getByTestId("map")).toHaveAttribute("data-routes", JSON.stringify([route, other]));
  expect(screen.getByText("9 mapped records")).toBeInTheDocument();
  expect(screen.queryByText("7 mapped records")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View geographic evidence" }));
  expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();
  const heading = screen.getByRole("heading", { level: 1, name: "Geographic evidence" });
  const introduction = screen.getByText(/Historical mapped evidence for Route 2/);
  const evidenceHeading = screen.getByRole("heading", {
    level: 2,
    name: /Mapped geographic evidence.*Route 2/,
  });
  expect(
    heading.compareDocumentPosition(introduction) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    introduction.compareDocumentPosition(evidenceHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getByText("9 mapped records")).toBeInTheDocument();
  expect(screen.queryByText("7 mapped records")).not.toBeInTheDocument();
  expect(fetchEvidence).toHaveBeenCalledTimes(2);
  expect(fetchEvidence.mock.calls.map((call) => call[0])).toEqual([route, other]);
});
