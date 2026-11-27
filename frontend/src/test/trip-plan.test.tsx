import { readPlan } from "@/lib/routing/plannedRoute";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { openPrintablePlan } from "@/lib/routing/tripPlan";
import { TripPlanPanel } from "@/components/TripPlanPanel";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
import type { RouteEvidence } from "@/lib/routing/routeEvidence";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
const departure = "2026-10-29T15:00";
function states(): Record<string, EvidenceState> {
  return {
    [evidenceRoute.id]: { status: "complete", evidence: evidenceFixture() as RouteEvidence },
  };
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("shares the selected geometry and arrival even when evidence is unavailable", () => {
  const destination = "राँची & Station";
  render(
    <TripPlanPanel
      routes={[evidenceRoute]}
      selected={evidenceRoute.id}
      states={{}}
      from="A"
      to={destination}
      departure={departure}
    />,
  );
  const url = new URL(
    screen.getByRole("link", { name: "Share on WhatsApp" }).getAttribute("href")!,
  );
  const message = url.searchParams.get("text")!;
  expect(message).toContain("Expected arrival");
  const snapshot = readPlan(new URL(message.split("snapshot): ")[1]!).hash);
  expect(snapshot.coordinates).toEqual(evidenceRoute.coordinates);
  expect(snapshot.info[1]).toBe(destination);
});
it("rejects an incomplete shared route", () => {
  expect(() => readPlan("#plan=broken")).toThrow();
});
it("embeds a tile-free route and endpoint markers in the print document", () => {
  const doc = document.implementation.createHTMLDocument();
  vi.spyOn(window, "open").mockReturnValue({ document: doc, print: vi.fn() } as unknown as Window);
  render(
    <TripPlanPanel
      routes={[evidenceRoute]}
      selected={evidenceRoute.id}
      states={{}}
      from="A"
      to="B"
      departure={departure}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save as PDF" }));
  expect(doc.querySelector("svg polyline")).toBeTruthy();
  expect(doc.querySelectorAll("svg circle")).toHaveLength(2);
  expect(doc.querySelector("img")).toBeNull();
});
it("updates the share link when departure or destination changes and reports blocked tabs", () => {
  const props = {
    routes: [evidenceRoute],
    selected: evidenceRoute.id,
    states: states(),
    from: "A",
    to: "B",
    departure,
  };
  const view = render(<TripPlanPanel {...props} />);
  const before = screen.getByRole("link", { name: "Share on WhatsApp" }).getAttribute("href");
  view.rerender(<TripPlanPanel {...props} to="New destination" departure="2026-10-29T17:00" />);
  expect(screen.getByRole("link", { name: "Share on WhatsApp" }).getAttribute("href")).not.toBe(
    before,
  );
  vi.spyOn(window, "open").mockReturnValue(null);
  fireEvent.click(screen.getByRole("button", { name: "Save as PDF" }));
  expect(screen.getByRole("status")).toHaveTextContent("blocked");
});
it("prints text as text, with no executable user markup or external resources", () => {
  const doc = document.implementation.createHTMLDocument();
  const print = vi.fn();
  const fake = { document: doc, opener: window, print };
  vi.spyOn(window, "open").mockReturnValue(fake as unknown as Window);
  expect(openPrintablePlan("<script>alert(1)</script>")).toBe(true);
  expect(doc.querySelector("script")).toBeNull();
  expect(doc.querySelector("pre")?.textContent).toBe("<script>alert(1)</script>");
  expect(fake.opener).toBeNull();
  doc.querySelector("button")!.click();
  expect(print).toHaveBeenCalledOnce();
});
