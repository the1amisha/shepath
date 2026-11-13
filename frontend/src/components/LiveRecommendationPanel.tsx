import type { RouteData } from "@/lib/routing/types";
import {
  attributes,
  attributeLabels,
  liveModel,
  observationKey,
  type Observations,
  type Recommendation,
} from "@/lib/routing/liveRecommendation";
import { Button } from "@/components/ui/button";

type Props = {
  routes: RouteData[];
  result: Recommendation;
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
  routes,
  result,
  departure,
  enabled,
  onEnabled,
  maxExtra,
  onMaxExtra,
  observations,
  onObservations,
  onSelect,
}: Props) {
  const routeName = (id: string) => `Route ${routes.findIndex((r) => r.id === id) + 1}`;
  const weights = liveModel.coefficients.slice(1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  return (
    <section className="rounded-3xl border bg-card p-5 sm:p-8" aria-labelledby="live-ml-title">
      <h2 id="live-ml-title" className="font-display text-2xl font-black">
        ML route recommendation
      </h2>
      <p className="mt-2 text-sm leading-6">
        Survey-trained preference weights compare these real walking routes using historical mapped
        attributes. This experimental hybrid is not a safety assessment or a validated prediction of
        your choice.
      </p>
      <label className="mt-4 flex items-center gap-3 font-bold">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabled(e.target.checked)}
          className="size-5"
        />
        Use ML recommendations
      </label>
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
              {[0, 5, 10, 15, 30].map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </div>
          <p className="mt-4 text-sm leading-6" role="status">
            {result.message}
          </p>
          {result.recommendedId && (
            <div className="mt-4 rounded-2xl bg-secondary p-4">
              <h3 className="font-bold">Experimental ML pick: {routeName(result.recommendedId)}</h3>
              <p className="mt-2 text-sm leading-6">
                Its lower fit bound exceeds the upper bounds of the other eligible routes. This only
                accounts for missing model inputs; map errors and the survey-to-map assumptions can
                still change the result.
              </p>
              <Button className="mt-3" onClick={() => onSelect(result.recommendedId!)}>
                Choose ML pick
              </Button>
            </div>
          )}
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
                      Only change a field if you know this route at your chosen departure time. Your
                      description overrides the mapped proxy for this journey; it is not uploaded or
                      saved.
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
                          {row.values[key].source}. Learned weight:{" "}
                          {((100 * weights[i]!) / totalWeight).toFixed(1)}%. Contribution:{" "}
                          {((100 * weights[i]! * row.values[key].low) / totalWeight).toFixed(1)}–
                          {((100 * weights[i]! * row.values[key].high) / totalWeight).toFixed(1)}{" "}
                          points.
                        </p>
                      </div>
                    ))}
                  </details>
                </article>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Fit ranges are weighted proxy scores, not probabilities or confidence intervals. Nearby
            tags may describe another street. Zero mapped facilities means unknown, not absent.
            Pedestrian activity is unknown unless you describe it. Overlapping ranges produce no
            pick.
          </p>
          <details className="mt-4 text-sm leading-6">
            <summary className="cursor-pointer font-bold">
              Model, evidence mapping and limitations
            </summary>
            <p className="mt-3">
              Constrained logistic regression learned weights from 202 clear survey choices from 39
              consenting submissions. Nearby positive sidewalk and lighting tag fractions, and the
              fraction of mapped businesses scheduled open at departure, are hand-designed proxies
              for the survey attributes. They do not establish real conditions or continuous
              coverage. Unknown values span 0–1 instead of being scored as absent.
            </p>
            <p className="mt-3">
              The fit forbids rewarding longer walks or penalizing desired attributes. It learned a
              zero time coefficient, so your extra-time limit handles duration separately. This is a
              different model from the unconstrained survey demo.
            </p>
            <p className="mt-3">
              Survey cross-validation: {(liveModel.evaluation.model.accuracy * 100).toFixed(1)}%
              accuracy; baseline {(liveModel.evaluation.baseline.accuracy * 100).toFixed(1)}%. Model
              log loss {liveModel.evaluation.model.log_loss.toFixed(3)}. These results evaluate the
              six survey scenarios, not real-route recommendations. Constraints were chosen after
              inspecting the original fit; this is exploratory evaluation.
            </p>
            <a className="mt-2 inline-block underline text-primary" href="/preference-lab">
              View the original survey experiment
            </a>
          </details>
        </>
      )}
    </section>
  );
}
