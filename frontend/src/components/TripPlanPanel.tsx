import { PrintableRoute } from "./PrintableRoute";
import { planLink, planMessage, type PlanInfo } from "@/lib/routing/plannedRoute";
import { useId, useState, useRef } from "react";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteData } from "@/lib/routing/types";
import { openPrintablePlan, whatsappPlanUrl } from "@/lib/routing/tripPlan";

export function TripPlanPanel({
  routes,
  selected,
  states,
  from,
  to,
  departure,
  reason,
  mode = "walk",
}: {
  routes: RouteData[];
  selected: string;
  states: Record<string, EvidenceState>;
  from: string;
  to: string;
  departure: string;
  reason?: string | undefined;
  mode?: "walk" | "drive";
}) {
  const id = useId();
  const [error, setError] = useState("");
  const chart = useRef<HTMLDivElement>(null);
  const route = routes.find((r) => r.id === selected);
  if (!route || route.coordinates.length < 2) return null;
  const info: PlanInfo = [from, to, mode, departure, route.distanceMeters, route.durationSeconds];
  const message = planMessage(info);
  const link = planLink(info, route.coordinates);
  const text = message + "\nView my planned route (snapshot): " + link;
  const state = states[selected];
  const markers =
    state?.status === "complete" && state.evidence.route.id === selected
      ? (state.evidence.route_context?.facility_markers?.slice(0, 3) ?? [])
      : [];
  return (
    <section
      aria-labelledby={id}
      className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-7"
    >
      <h2 id={id} className="font-display text-xl font-bold">
        Share or save
      </h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={whatsappPlanUrl(text)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Share on WhatsApp
        </a>
        <button
          type="button"
          onClick={() =>
            setError(
              openPrintablePlan([message, reason].filter(Boolean).join("\n\n"), chart.current)
                ? ""
                : "The print tab was blocked. Allow pop-ups for this app and try again.",
            )
          }
          className="rounded-xl border border-border px-4 py-2 font-semibold focus-visible:ring-2 focus-visible:ring-ring"
        >
          Save as PDF
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        PDF opens a printable tab. Choose Print → Save as PDF.
      </p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold">Preview shared text</summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Includes your start, destination and departure time. Choose the recipient in WhatsApp. No
          live tracking.
        </p>
        <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 font-sans">
          {message}
        </pre>
        <a href={link} target="_blank" rel="noopener noreferrer" className="underline">
          View my planned route (snapshot)
        </a>
      </details>
      <div hidden>
        <div ref={chart}>
          <PrintableRoute points={route.coordinates} markers={markers} />
        </div>
      </div>
      <p role="status" className="mt-2 text-sm">
        {error}
      </p>
    </section>
  );
}
