import { useId } from "react";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteData } from "@/lib/routing/types";
import { summarizeRoute } from "@/lib/routing/routeSummary";

export function RouteSummaryPanel({
  routes,
  selected,
  states,
  comparisonId,
  onComparisonChange,
  mock = false,
}: {
  routes: RouteData[];
  selected: string;
  states: Record<string, EvidenceState>;
  comparisonId: string;
  onComparisonChange: (id: string) => void;
  mock?: boolean;
}) {
  const id = useId();
  const summary = summarizeRoute(routes, selected, states, comparisonId, mock);
  if (!summary) return null;
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mb-6 rounded-3xl border border-border bg-card p-5 sm:p-7"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 id={`${id}-heading`} className="font-display text-xl font-bold">
          Route summary · {summary.name}
        </h2>
        {summary.comparisonId && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label htmlFor={`${id}-compare`} className="text-sm font-bold">
              Compare with
            </label>
            <select
              id={`${id}-compare`}
              value={summary.comparisonId}
              onChange={(event) => onComparisonChange(event.target.value)}
              className="max-w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              {routes.map(
                (route, index) =>
                  route.id !== selected && (
                    <option key={route.id} value={route.id}>
                      Route {index + 1}
                    </option>
                  ),
              )}
            </select>
          </div>
        )}
      </div>
      <div aria-live="polite" aria-atomic="true" className="space-y-3 text-sm leading-6">
        <p className="font-semibold">{summary.travel}</p>
        <p>{summary.mapped}</p>
        {summary.comparison && <p>{summary.comparison}</p>}
      </div>
      {summary.context.length > 0 && (
        <details className="mt-4 text-xs leading-5 text-muted-foreground" key={selected}>
          <summary className="cursor-pointer font-semibold">Missing information and source</summary>
          {summary.context.map((text) => (
            <p key={text} className="mt-2">
              {text}
            </p>
          ))}
        </details>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Historical mapped evidence is incomplete. Missing records do not mean unsafe conditions;
        this summary does not assess personal safety.
      </p>
    </section>
  );
}
