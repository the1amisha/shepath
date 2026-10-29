import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteData } from "./types";
import { summarizeRoute } from "./routeSummary";
import { daylightEstimate, formatIst, parseDeparture } from "./departureTime";
import { summarizeHours } from "./facilityHours";

export function tripPlanText(
  routes: RouteData[],
  selected: string,
  states: Record<string, EvidenceState>,
  from: string,
  to: string,
  departure: string,
  via = "",
): string | null {
  const route = routes.find((r) => r.id === selected);
  const summary = summarizeRoute(routes, selected, states);
  if (!route || !summary) return null;
  const instant = parseDeparture(departure);
  const lines = [
    "SHEPATH · Walking trip plan",
    `From: ${from}`,
    `To: ${to}`,
    ...(via.trim()
      ? [
          `Via: ${via.trim()} (requested location; route uses a nearby routable point). Stop time is not included.`,
        ]
      : []),
    `Selected: ${summary.name}`,
    instant
      ? `Departure: ${departure.replace("T", " ")} IST (UTC+05:30)`
      : "Departure: not set to a valid date/time",
    summary.travel,
    summary.mapped,
  ];
  const state = states[selected];
  const e =
    state?.status === "complete" &&
    state.evidence.route.id === selected &&
    state.evidence.status === "available" &&
    state.evidence.coverage.full_buffer_covered &&
    state.evidence.route_context
      ? state.evidence
      : null;
  if (e) {
    if (instant) {
      const sun = daylightEstimate(instant, route.durationSeconds);
      if (sun)
        lines.push(
          `Estimated arrival: ${formatIst(sun.arrival)}.`,
          sun.nightMinutes < 0.01
            ? "Estimated walk falls between sunrise and sunset."
            : `About ${Math.max(1, Math.round(sun.nightMinutes))} min falls between sunset and sunrise.`,
          "Daylight is an offline estimate for central Ranchi; weather, terrain, stops and actual lighting are not modeled.",
        );
      if (e.route_context?.facility_hours) {
        const hours = summarizeHours(e.route_context.facility_hours, instant);
        lines.push(
          `Facilities at departure: ${hours.counts.likely_open} likely open; ${hours.counts.likely_closed} likely closed; ${hours.counts.missing + hours.counts.unsupported} hours unknown. Historical schedules, not confirmed operation or hours when passing each facility.`,
        );
      } else lines.push("Facility opening hours unavailable.");
    }
    lines.push(
      ...summary.context,
      `Geometry SHA-256: ${e.route.geometry_sha256}`,
      `Evidence identity SHA-256: ${e.evidence_identity_sha256}`,
      `${e.source_provenance.attribution} · ${e.source_provenance.license}`,
    );
  }
  lines.push(
    "Static plan only: no live location, tracking or turn-by-turn navigation. Travel times are estimates. Historical mapped evidence is incomplete; missing records mean unknown, not unsafe. No personal-safety assessment.",
  );
  return lines.join("\n\n");
}

export function whatsappPlanUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function openPrintablePlan(text: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.opener = null;
  const doc = win.document;
  doc.title = "SHEPATH trip plan";
  const style = doc.createElement("style");
  style.textContent =
    "body{font:14px/1.6 system-ui,sans-serif;color:#173f3b;max-width:760px;margin:32px auto;padding:0 24px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}button{padding:12px 20px;cursor:pointer}@media print{button{display:none}body{margin:0;max-width:none;color:#000}@page{margin:18mm}}";
  doc.head.append(style);
  const button = doc.createElement("button");
  button.textContent = "Print / save as PDF";
  button.onclick = () => win.print();
  const heading = doc.createElement("h1");
  heading.textContent = "SHEPATH trip plan";
  const content = doc.createElement("pre");
  content.textContent = text;
  doc.body.replaceChildren(button, heading, content);
  return true;
}
