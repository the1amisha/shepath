import { useId, useState } from "react";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteData } from "@/lib/routing/types";
import { openPrintablePlan, tripPlanText, whatsappPlanUrl } from "@/lib/routing/tripPlan";

export function TripPlanPanel({
  routes,
  selected,
  states,
  from,
  to,
  departure,
}: {
  routes: RouteData[];
  selected: string;
  states: Record<string, EvidenceState>;
  from: string;
  to: string;
  departure: string;
}) {
  const id = useId();
  const [error, setError] = useState("");
  const text = tripPlanText(routes, selected, states, from, to, departure);
  if (!text) return null;
  return (
    <section
      aria-labelledby={id}
      className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-7"
    >
      <h2 id={id} className="font-display text-xl font-bold">
        Share your trip plan
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        A static summary of your selected route and departure time. Review the text before sharing;
        it includes your start and destination. WhatsApp lets you choose the recipient and send it
        yourself.
      </p>
      <details className="mt-4">
        <summary className="cursor-pointer font-semibold">Preview shared text</summary>
        <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 font-sans">
          {text}
        </pre>
      </details>
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
              openPrintablePlan(text)
                ? ""
                : "The print tab was blocked. Allow pop-ups for this app and try again.",
            )
          }
          className="rounded-xl border border-border px-4 py-2 font-semibold focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open printable plan
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        In the printable tab, choose Print / save as PDF. The summary has no live tracking or
        navigation map and makes no extra route requests.
      </p>
      <p role="status" className="mt-2 text-sm">
        {error}
      </p>
    </section>
  );
}
