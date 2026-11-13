import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RouteComparisonTable } from "@/components/RouteComparisonTable";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import type { RouteEvidence } from "@/lib/routing/routeEvidence";
afterEach(cleanup);
it("shows documented tags, not safety scores, and selects the correct route", () => {
  const second = { ...evidenceRoute, id: "second" };
  const select = vi.fn();
  render(
    <RouteComparisonTable
      routes={[evidenceRoute, second]}
      orderedIds={["second", evidenceRoute.id]}
      selected={evidenceRoute.id}
      onSelect={select}
      states={{
        [evidenceRoute.id]: { status: "complete", evidence: evidenceFixture() as RouteEvidence },
        second: { status: "loading" },
      }}
    />,
  );
  const rows = screen.getAllByRole("row");
  expect(within(rows[1]!).getByRole("button")).toHaveTextContent("View Route 2");
  expect(within(rows[1]!).getAllByText("Loading…")).toHaveLength(3);
  expect(screen.getByText("3/10 recorded")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "View Route 2" }));
  expect(select).toHaveBeenCalledWith("second");
});
it("does not display stale or out-of-coverage counts", () => {
  const e = evidenceFixture() as RouteEvidence;
  e.coverage.full_buffer_covered = false;
  render(
    <RouteComparisonTable
      routes={[evidenceRoute]}
      orderedIds={[evidenceRoute.id]}
      selected={evidenceRoute.id}
      onSelect={() => {}}
      states={{ [evidenceRoute.id]: { status: "complete", evidence: e } }}
    />,
  );
  expect(screen.getAllByText("Unavailable")).toHaveLength(3);
  expect(screen.queryByText("7 mapped")).not.toBeInTheDocument();
});
