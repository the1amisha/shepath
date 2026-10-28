import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { DepartureTimePanel } from "@/components/DepartureTimePanel";
import { fetchRouteEvidence, type RouteEvidence } from "@/lib/routing/routeEvidence";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import type { FacilityHours } from "@/lib/routing/facilityHours";
const hours: FacilityHours = {
  schema_version: "SHEPATH.facility_hours.v1",
  records: [
    {
      osm_id: "node/1",
      name: "Test clinic",
      business: true,
      healthcare: true,
      opening_hours: "Mo-Fr 09:00-18:00",
    },
  ],
};
function full() {
  const body = evidenceFixture();
  body.route_context.categories.shops_and_businesses.count = 1;
  body.route_context.categories.healthcare_facilities.count = 1;
  return { ...body, route_context: { ...body.route_context, facility_hours: hours } };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("updates locally and clears stale results for an invalid date", () => {
  const network = vi.fn();
  vi.stubGlobal("fetch", network);
  function Wrapper() {
    const [departure, setDeparture] = useState("2026-10-28T17:00");
    return (
      <DepartureTimePanel
        route={evidenceRoute}
        name="Route 1"
        state={{ status: "complete", evidence: full() as RouteEvidence }}
        departure={departure}
        onChange={setDeparture}
      />
    );
  }
  render(<Wrapper />);
  expect(screen.getByText("1 likely open · 0 likely closed")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Departure date and time (IST)"), {
    target: { value: "2026-10-28T20:00" },
  });
  expect(screen.getByText("0 likely open · 1 likely closed")).toBeInTheDocument();
  expect(screen.getByText(/7 min of this walk/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Departure date and time (IST)"), {
    target: { value: "" },
  });
  expect(screen.queryByText(/likely open ·/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Departure date and time (IST)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(network).not.toHaveBeenCalled();
});
it("hides unmatched evidence and handles older responses without inventing counts", () => {
  const state = { status: "complete" as const, evidence: full() as RouteEvidence };
  const { rerender } = render(
    <DepartureTimePanel
      route={{ ...evidenceRoute, id: "other" }}
      name="Route 2"
      state={state}
      departure="2026-10-28T17:00"
      onChange={() => {}}
    />,
  );
  expect(screen.queryByText(/Estimated arrival:/)).not.toBeInTheDocument();
  expect(screen.getByText(/until matching Ranchi route evidence/)).toBeInTheDocument();
  rerender(
    <DepartureTimePanel
      route={evidenceRoute}
      name="Route 1"
      state={{ status: "complete", evidence: evidenceFixture() as RouteEvidence }}
      departure="2026-10-28T17:00"
      onChange={() => {}}
    />,
  );
  expect(screen.getByText(/Facility schedules are unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/Estimated arrival:/)).toBeInTheDocument();
});
it("retains hours through response parsing and rejects inconsistent inventories", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8011");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(full()))));
  expect(
    (await fetchRouteEvidence(evidenceRoute, new AbortController().signal)).route_context
      ?.facility_hours,
  ).toEqual(hours);
  const wrong = full();
  wrong.route_context.categories.shops_and_businesses.count = 2;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(wrong))));
  await expect(fetchRouteEvidence(evidenceRoute, new AbortController().signal)).rejects.toThrow(
    /mapped inventory/,
  );
});
