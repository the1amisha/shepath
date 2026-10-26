import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import type { RouteEvidence } from "@/lib/routing/routeEvidence";
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
vi.mock("@/components/SavedRanchiPilot", () => ({
  SavedRanchiPilot: ({ onBack }: { onBack: () => void }) => (
    <>
      <h1 id="journey-heading" tabIndex={-1}>
        Saved comparison
      </h1>
      <button onClick={onBack}>Back to journey</button>
    </>
  ),
}));
import { ShePathApp } from "@/routes/index";
import { RouteEvidencePanel } from "@/components/RouteEvidencePanel";
import { focusContent } from "@/hooks/useJourneyFocus";

beforeEach(() => {
  getRoutes.mockReset().mockResolvedValue([evidenceRoute]);
  fetchEvidence.mockReset().mockResolvedValue(evidenceFixture() as RouteEvidence);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function start() {
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Plan my walk" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to preference preview" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to routes" }));
}

it("recovers an interrupted request after saved view and ignores its late response during retry", async () => {
  let finishOld!: (value: (typeof evidenceRoute)[]) => void;
  let finishRetry!: (value: (typeof evidenceRoute)[]) => void;
  getRoutes
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRetry = resolve;
        }),
    );
  start();
  expect(screen.getByText("Finding your routes...")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Retry route" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Saved Ranchi Pilot Comparison" }));
  fireEvent.click(screen.getByRole("button", { name: "Back to journey" }));
  expect(screen.getByRole("region", { name: "Route recovery" })).toHaveTextContent(
    "Route request interrupted",
  );
  expect(screen.getByRole("button", { name: "Edit journey" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "View route overview" })).toBeDisabled();
  expect(fetchEvidence).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry route" }));
  expect(getRoutes).toHaveBeenLastCalledWith({
    origin: "Albert Ekka Chowk, Ranchi",
    destination: "Ranchi Railway Station, Ranchi",
    travelMode: "walk",
  });
  await act(async () => finishOld([{ ...evidenceRoute, id: "stale-route" }]));
  expect(screen.getByText("Finding your routes...")).toBeVisible();
  expect(fetchEvidence).not.toHaveBeenCalled();
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "");
  await act(async () => finishRetry([evidenceRoute]));
  await screen.findByText("7 mapped records");
  expect(fetchEvidence).toHaveBeenCalledOnce();
  expect(fetchEvidence.mock.calls[0]![0]).toEqual(evidenceRoute);
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", evidenceRoute.id);
});

it("keeps interruption visible after a late failure and edits then retries the current trimmed inputs", async () => {
  let rejectOld!: (reason: Error) => void;
  getRoutes.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectOld = reject;
      }),
  );
  start();
  fireEvent.click(screen.getByRole("button", { name: "Saved Ranchi Pilot Comparison" }));
  await act(async () => rejectOld(new Error("Obsolete request failed")));
  fireEvent.click(screen.getByRole("button", { name: "Back to journey" }));
  expect(screen.queryByText("Obsolete request failed")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit journey" }));
  fireEvent.change(screen.getByRole("textbox", { name: /Starting from/ }), {
    target: { value: "   New origin   " },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /Going to/ }), {
    target: { value: "   New destination   " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue to preference preview" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to routes" }));
  await screen.findByText("7 mapped records");
  expect(getRoutes).toHaveBeenLastCalledWith({
    origin: "New origin",
    destination: "New destination",
    travelMode: "walk",
  });
});

it("distinguishes ordinary empty results from interruption and routing errors", async () => {
  getRoutes
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error("Routing service unavailable"));
  start();
  expect(await screen.findByRole("region", { name: "Route recovery" })).toHaveTextContent(
    "No routes are available for this journey",
  );
  expect(screen.queryByText(/Route request interrupted/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry route" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Routing service unavailable");
  expect(screen.queryByRole("region", { name: "Route recovery" })).not.toBeInTheDocument();
  expect(fetchEvidence).not.toHaveBeenCalled();
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "");
});

it("places legend and selected actions after the map in the same column, outside its control area", async () => {
  start();
  await screen.findByText("7 mapped records");
  const map = screen.getByRole("region", { name: "Route comparison map" });
  const actions = screen.getByRole("region", { name: "Selected route actions" });
  const legend = document.querySelector('[aria-label="Route colors"]')!;
  expect(actions.parentElement).toBe(map.parentElement);
  expect(legend.parentElement).toBe(map.parentElement);
  expect(map).not.toContainElement(actions);
  expect(map).not.toContainElement(legend as HTMLElement);
  expect(map.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(legend.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(actions).not.toHaveClass("sticky", "bottom-0");
  expect(within(actions).getByRole("button", { name: "View route overview" })).toBeEnabled();
});

it("collapses metrics while keeping summary, historical qualifications and source visible", () => {
  render(
    <RouteEvidencePanel
      compact
      name="Route 1"
      state={{ status: "complete", evidence: evidenceFixture() as RouteEvidence }}
    />,
  );
  const summary = screen.getByText("Geographic metrics and methodology for Route 1");
  expect(summary.closest("details")).not.toHaveAttribute("open");
  expect(screen.getByText("7 mapped records")).not.toBeVisible();
  expect(screen.getByText(/Historical mapped data/)).toBeVisible();
  expect(screen.getByText(/Historical mapped data/)).toHaveTextContent(
    "No personal-safety assessment",
  );
  expect(screen.getByText(/Mapped records and tag availability/)).toBeVisible();
  expect(screen.getByText(/Source snapshot/)).toBeVisible();
  fireEvent.click(summary);
  expect(screen.getByText("7 mapped records")).toBeVisible();
  fireEvent.click(summary);
  expect(screen.getByText("7 mapped records")).not.toBeVisible();
  expect(screen.getByRole("status")).toBeVisible();
});

it("never collapses unavailable coverage or a service error", () => {
  const { rerender } = render(
    <RouteEvidencePanel
      compact
      name="Route 2"
      state={{
        status: "complete",
        evidence: {
          ...evidenceFixture(),
          status: "coverage_unavailable",
          route_context: null,
        } as RouteEvidence,
      }}
    />,
  );
  expect(screen.getByRole("status")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Route 2: Coverage unavailable");
  expect(document.querySelector("details")).toBeNull();
  expect(screen.queryByText("7 mapped records")).not.toBeInTheDocument();
  rerender(
    <RouteEvidencePanel
      compact
      name="Route 2"
      state={{ status: "error", message: "Evidence service is busy" }}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Route 2: Evidence service is busy");
  expect(screen.getByRole("status")).toBeVisible();
  expect(screen.getByText(/No personal-safety assessment/)).toBeVisible();
});

it("names queued and requested routes, preserves sequential processing and selected evidence", async () => {
  let finish!: (value: RouteEvidence) => void;
  const second = {
    ...evidenceRoute,
    id: "second",
    coordinates: [...evidenceRoute.coordinates].reverse(),
  };
  const otherEvidence = evidenceFixture(second);
  otherEvidence.route_context.categories.shops_and_businesses.count = 9;
  getRoutes.mockResolvedValue([evidenceRoute, second]);
  fetchEvidence
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(otherEvidence);
  start();
  const secondButton = await screen.findByRole("button", { name: /Route 2 Not selected/ });
  expect(await screen.findByText(/Route 1: Analysis requested/)).toHaveTextContent(
    "bounded retries",
  );
  expect(screen.getByText(/Route 2: Waiting for analysis/)).toBeVisible();
  expect(fetchEvidence).toHaveBeenCalledOnce();
  fireEvent.click(secondButton);
  fireEvent.click(screen.getByText("Locate selected route"));
  expect(secondButton).toHaveFocus();
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "second");
  expect(
    within(screen.getByRole("region", { name: "Selected route actions" })).getByText(
      "Selected: Route 2",
    ),
  ).toBeVisible();
  await act(async () => finish(evidenceFixture() as RouteEvidence));
  await screen.findByText("9 mapped records");
  expect(screen.getByText("9 mapped records")).toBeVisible();
  expect(screen.queryByText("7 mapped records")).not.toBeInTheDocument();
  expect(fetchEvidence.mock.calls.map((call) => call[0])).toEqual([evidenceRoute, second]);
  fireEvent.click(screen.getByText("View route overview"));
  expect(screen.getByText("9 mapped records")).toBeVisible();
  expect(screen.queryByText("7 mapped records")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
});

it("focuses all five screens without history changes or stealing focus on evidence updates", async () => {
  const push = vi.spyOn(window.history, "pushState");
  const replace = vi.spyOn(window.history, "replaceState");
  render(<ShePathApp />);
  for (const label of ["Plan my walk", "Continue to preference preview", "Continue to routes"]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  }
  await screen.findByText("7 mapped records");
  for (const label of ["View route overview", "View geographic evidence", "Go back", "Go back"]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  }
  const card = screen.getByRole("button", { name: /Route 1 Selected/ });
  card.focus();
  fireEvent.click(card);
  expect(card).toHaveFocus();
  expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "instant" }));
  expect(push).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

it("focuses saved entry and restores the recreated launch button on return", async () => {
  start();
  await screen.findByText("7 mapped records");
  fireEvent.click(screen.getByRole("button", { name: "Saved Ranchi Pilot Comparison" }));
  expect(screen.getByRole("heading", { name: "Saved comparison" })).toHaveFocus();
  expect((fetchEvidence.mock.calls[0]![1] as AbortSignal).aborted).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Back to journey" }));
  expect(screen.getByRole("button", { name: "Saved Ranchi Pilot Comparison" })).toHaveFocus();
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", evidenceRoute.id);
  await screen.findByText("7 mapped records");
  expect(screen.getByRole("button", { name: "Saved Ranchi Pilot Comparison" })).toHaveFocus();
});

it("scrolls focus below the measured header with instant movement", () => {
  render(
    <>
      <header data-journey-header style={{ position: "sticky" }} />
      <h1 tabIndex={-1}>Destination heading</h1>
    </>,
  );
  const header = document.querySelector("header")!;
  const heading = screen.getByRole("heading");
  vi.spyOn(header, "getBoundingClientRect").mockReturnValue({ height: 120 } as DOMRect);
  vi.spyOn(heading, "getBoundingClientRect").mockReturnValue({ top: 400 } as DOMRect);
  focusContent(heading);
  expect(heading).toHaveFocus();
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 264, behavior: "instant" });
});
