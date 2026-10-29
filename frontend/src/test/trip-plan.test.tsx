import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { tripPlanText, whatsappPlanUrl, openPrintablePlan } from "@/lib/routing/tripPlan";
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
it("preserves place names and encodes the exact text for WhatsApp", () => {
  const text = tripPlanText(
    [evidenceRoute],
    evidenceRoute.id,
    states(),
    "चौक & A",
    "B #1",
    departure,
  )!;
  expect(text).toContain("From: चौक & A");
  expect(text).toContain("2026-10-29 15:00 IST");
  expect(text).toContain("7 mapped business records");
  expect(text).toContain("Source snapshot:");
  expect(text).toContain("no live location");
  expect(new URL(whatsappPlanUrl(text)).searchParams.get("text")).toBe(text);
});
it("does not invent counts or daylight when evidence is missing or mismatched", () => {
  for (const s of [
    {},
    { [evidenceRoute.id]: { status: "error", message: "Offline" } } as Record<
      string,
      EvidenceState
    >,
    { other: states()[evidenceRoute.id]! },
  ]) {
    const text = tripPlanText([evidenceRoute], evidenceRoute.id, s, "A", "B", departure)!;
    expect(text).not.toContain("7 mapped");
    expect(text).not.toContain("Estimated arrival");
  }
});
it("handles invalid departure and absent selected route", () => {
  expect(tripPlanText([], "missing", {}, "A", "B", departure)).toBeNull();
  const text = tripPlanText([evidenceRoute], evidenceRoute.id, states(), "A", "B", "bad")!;
  expect(text).toContain("not set to a valid");
  expect(text).not.toContain("Estimated arrival");
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
  fireEvent.click(screen.getByRole("button", { name: "Open printable plan" }));
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
