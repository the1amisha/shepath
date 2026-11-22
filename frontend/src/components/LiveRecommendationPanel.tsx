import { ModelEvidenceCard } from "@/components/ModelEvidenceCard";
import type { ReactNode } from "react";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import { Button } from "@/components/ui/button";
import {
  recommendationSummary,
  recommendationFallback,
  walkingTime,
  preferenceIsSeparated,
} from "@/lib/routing/recommendationSummary";
import type { HybridResult } from "@/lib/routing/hybridRecommendation";
import { learnedPriorities, type Priorities } from "@/lib/routing/hybridRecommendation";
import type { RouteData } from "@/lib/routing/types";
import {
  attributes,
  attributeLabels,
  observationKey,
  type Observations,
} from "@/lib/routing/liveRecommendation";

type Props = {
  priorityControls?: ReactNode;
  priorities?: Priorities;
  routes: RouteData[];
  result: HybridResult;
  states: Record<string, EvidenceState>;
  departure: string;
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  maxExtra: number;
  onMaxExtra: (value: number) => void;
  observations: Observations;
  onObservations: (value: Observations) => void;
  onSelect: (id: string) => void;
};
export function LiveRecommendationPanel({
  priorityControls,
  priorities = learnedPriorities,
  states,
  onSelect,
  routes,
  result,
  departure,
  enabled,
  onEnabled,
  maxExtra,
  onMaxExtra,
  observations,
  onObservations,
}: Props) {
  const summary = enabled ? recommendationSummary(routes, result, states, priorities) : null;
  const uncertain = !!summary && !summary.onlyEligible && !preferenceIsSeparated(result);
  const fallbackRoute =
    enabled && (!summary || uncertain) && routes.length > 1 && result.rows.length > 0
      ? [...routes]
          .filter((route) => result.rows.find((row) => row.id === route.id)?.eligible)
          .sort(
            (a, b) => a.durationSeconds - b.durationSeconds || a.distanceMeters - b.distanceMeters,
          )[0]
      : undefined;
  const routeName = (id: string) => `Route ${routes.findIndex((r) => r.id === id) + 1}`;
  const weights = attributes.map((key) => priorities[key]);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  return (
    <section className="mb-4 rounded-2xl border bg-card p-4" aria-labelledby="live-ml-title">
      {summary ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {summary.onlyEligible
                ? "Within your time limit"
                : summary.custom
                  ? "Your priorities"
                  : "ML preference recommendation"}
            </p>
            <h2 id="live-ml-title" className="mt-1 font-display text-xl font-black">
              {uncertain
                ? "Similar matches"
                : `${summary.onlyEligible ? "Time-limit match" : "Recommended"} · ${routeName(summary.route.id)}`}
            </h2>
            <p role="status" className="mt-1 text-sm font-semibold">
              {uncertain && `${routeName(summary.route.id)} · Top calculated fit · `}
              {walkingTime(summary.route.durationSeconds)} ·{" "}
              {(summary.route.distanceMeters / 1000).toFixed(1)} km
              <span className="ml-2 inline-block rounded-full bg-secondary px-3 py-1 text-xs">
                {summary.extra}
              </span>
            </p>
            <p className="mt-3 text-sm">
              {uncertain ? "Missing information could change the order." : summary.reason}
            </p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => onSelect(summary.route.id)}>
            {uncertain ? "View top match" : "View recommended route"}
          </Button>
        </div>
      ) : (
        <>
          <h2 id="live-ml-title" className="font-display text-lg font-black">
            Your route options
          </h2>
          <p role="status" className="mt-2 text-sm font-semibold">
            {!enabled
              ? "Manual comparison"
              : routes.length === 1
                ? "One route available"
                : recommendationFallback(result)}
          </p>
          {fallbackRoute && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-sm">
                Fastest route · {routeName(fallbackRoute.id)} ·{" "}
                {walkingTime(fallbackRoute.durationSeconds)} ·{" "}
                {(fallbackRoute.distanceMeters / 1000).toFixed(1)} km
              </p>
              <Button variant="outline" onClick={() => onSelect(fallbackRoute.id)}>
                View fastest route
              </Button>
            </div>
          )}
        </>
      )}
      {uncertain && fallbackRoute && fallbackRoute.id !== summary?.route.id && (
        <Button variant="outline" className="mt-3" onClick={() => onSelect(fallbackRoute.id)}>
          View fastest · {walkingTime(fallbackRoute.durationSeconds)}
        </Button>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {summary?.limited ? "Limited input coverage · " : ""}Experimental preference model · not a
        safety rating
      </p>
      <div className="mt-3 grid items-start gap-2 sm:grid-cols-3 [&>details[open]]:col-span-full [&>details]:min-w-0">
        <details className="rounded-xl border p-2 text-sm">
          <summary className="cursor-pointer font-semibold">Why this recommendation?</summary>
          {summary && (
            <>
              <p className="mt-2">
                Preference fit {summary.row.score!.toFixed(0)}/100 ·{" "}
                {summary.row.coverage.toFixed(0)}% input coverage
              </p>
              {uncertain && <p className="mt-2">{summary.reason}</p>}
              <p className="mt-2">
                {summary.custom
                  ? "Uses your adjusted weights."
                  : "Uses weights learned from the route-choice survey."}{" "}
                Missing inputs use a neutral midpoint.
              </p>
              {!!summary.facts.length && (
                <div className="mt-3 rounded-xl bg-secondary p-3">
                  <p className="font-semibold">
                    Map comparison with {routeName(summary.reference!.id)}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {summary.facts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    Historical records within 100 m; these comparisons are context, not additional
                    ML inputs. Current activity is unknown.
                  </p>
                </div>
              )}
            </>
          )}
          <p className="mt-2 leading-6">{result.message}</p>
          {enabled && result.rows.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="mb-2 text-left font-semibold">Known model inputs</caption>
                <thead>
                  <tr>
                    <th className="p-2">Route</th>
                    {["Footpath", "Lighting", "Business hours", "Pedestrians"].map((label) => (
                      <th className="p-2" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id}>
                      <th className="p-2">{routeName(row.id)}</th>
                      {attributes.map((key) => {
                        const known = Math.max(
                          0,
                          Math.min(100, 100 * (1 - row.values[key].high + row.values[key].low)),
                        );
                        return (
                          <td className="p-2" key={key}>
                            {priorities[key] === 0
                              ? "Not used"
                              : known < 1e-8
                                ? "Unknown"
                                : known < 1
                                  ? "<1% known"
                                  : `${Math.round(known)}% known`}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                Known input share, not safety or street coverage. Nearby places alone do not
                establish opening hours or pedestrian activity.
              </p>
            </div>
          )}
        </details>
        <details className="rounded-xl border p-2 text-sm">
          <summary className="cursor-pointer font-semibold">Personalise comparison</summary>
          {priorityControls}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-bold">Recommendation settings</summary>
            <label className="mt-4 flex items-center gap-3 font-bold">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onEnabled(e.target.checked)}
                className="size-5"
              />
              Use ML recommendations
            </label>
          </details>
          {enabled && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label htmlFor="ml-extra-time" className="text-sm font-bold">
                  Maximum extra walking time beyond fastest
                </label>
                <select
                  id="ml-extra-time"
                  className="rounded-xl border bg-background p-2"
                  value={maxExtra}
                  onChange={(e) => onMaxExtra(Number(e.target.value))}
                >
                  <option value="Infinity">Compare all returned routes</option>
                  {[0, 5, 10, 15, 30].map((n) => (
                    <option key={n} value={n}>
                      {n} minutes
                    </option>
                  ))}
                </select>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-bold">
                  Detailed model inputs and optional corrections
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {result.rows.map((row) => {
                    const route = routes.find((r) => r.id === row.id)!;
                    const identity = observationKey(route, departure);
                    return (
                      <article key={row.id} className="rounded-2xl border p-4">
                        <h3 className="font-bold">
                          {routeName(row.id)} · {Math.round(route.durationSeconds / 60)} min
                        </h3>
                        <p className="mt-2 text-sm">
                          {row.eligible
                            ? `Preference fit range: ${row.low.toFixed(1)}–${row.high.toFixed(1)} / 100`
                            : "Outside your extra-time limit"}
                        </p>
                        <details className="mt-3 text-sm">
                          <summary className="cursor-pointer font-bold">
                            Why this fit? / Add known route details
                          </summary>
                          <p className="mt-3 leading-6">
                            Only change a field if you know this route at your chosen departure
                            time. Your description overrides the mapped proxy for this journey; it
                            is not uploaded or saved.
                          </p>
                          {attributes.map((key, i) => (
                            <div key={key} className="mt-4">
                              <label
                                htmlFor={`ml-${routes.indexOf(route)}-${key}`}
                                className="block font-bold"
                              >
                                {attributeLabels[key]}
                              </label>
                              <select
                                id={`ml-${routes.indexOf(route)}-${key}`}
                                className="mt-1 w-full rounded-xl border bg-background p-2"
                                value={observations[identity]?.[key] ?? "unknown"}
                                onChange={(e) => {
                                  const next = { ...observations[identity] };
                                  if (e.target.value === "unknown") delete next[key];
                                  else next[key] = e.target.value as "yes" | "no";
                                  onObservations({ ...observations, [identity]: next });
                                }}
                              >
                                <option value="unknown">Use available map data / unknown</option>
                                <option value="yes">Yes, based on my knowledge</option>
                                <option value="no">No, based on my knowledge</option>
                              </select>
                              <p className="mt-1 text-xs leading-5">
                                {row.values[key].source}. Active weight:{" "}
                                {((100 * weights[i]!) / totalWeight).toFixed(1)}%. Contribution:{" "}
                                {((100 * weights[i]! * row.values[key].low) / totalWeight).toFixed(
                                  1,
                                )}
                                –
                                {((100 * weights[i]! * row.values[key].high) / totalWeight).toFixed(
                                  1,
                                )}{" "}
                                points.
                              </p>
                            </div>
                          ))}
                        </details>
                      </article>
                    );
                  })}
                </div>
              </details>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Fit ranges are weighted proxy scores, not probabilities or confidence intervals.
                Nearby tags may describe another street. Zero mapped facilities means unknown, not
                absent. Pedestrian activity is unknown unless you describe it. Ranking uses range
                midpoints; overlapping ranges mean the order is uncertain.
              </p>
            </>
          )}
        </details>
        <ModelEvidenceCard />
      </div>
    </section>
  );
}
