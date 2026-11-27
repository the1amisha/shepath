import { liveModel } from "@/lib/routing/liveRecommendation";

export function ModelEvidenceCard() {
  const { counts, evaluation } = liveModel;
  return (
    <details className="rounded-xl bg-secondary p-2 text-sm">
      <summary className="cursor-pointer font-semibold">How the ML works</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>Learn preferences from survey route choices using constrained logistic regression.</li>
        <li>Describe each route using available map tags and business schedules.</li>
        <li>Apply learned weights to compare routes. Your priorities can adjust those weights.</li>
      </ol>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <p>
          <strong className="block text-xl">{counts.consenting_submissions}</strong>Consenting
          submissions
        </p>
        <p>
          <strong className="block text-xl">{counts.clear_choices}</strong>Clear route choices
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left">
          <caption className="mb-2 text-left font-semibold">Survey evaluation</caption>
          <thead>
            <tr>
              <th className="p-2">Measure</th>
              <th className="p-2">ML model</th>
              <th className="p-2">Baseline</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="p-2">Accuracy</th>
              <td className="p-2">{(evaluation.model.accuracy * 100).toFixed(1)}%</td>
              <td className="p-2">{(evaluation.baseline.accuracy * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <th className="p-2">Log loss ↓</th>
              <td className="p-2">{evaluation.model.log_loss.toFixed(3)}</td>
              <td className="p-2">{evaluation.baseline.log_loss.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2">
        Same accuracy as the baseline; slightly lower log loss (better probability estimates on this
        evaluation).
      </p>
      <p className="mt-2 text-xs">
        Each submission was held out in turn, using the same six scenarios. Model constraints were
        chosen after inspecting an earlier fit. These exploratory results do not validate real-route
        safety.
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold">How route scores are calculated</summary>
        <p className="mt-2">
          The route score is a weighted average of mapped proxies, with unknown inputs assigned a
          neutral midpoint. This calculation uses learned weights; it is not a safety probability.
          Missing-input ranges show how the score could change, not statistical confidence.
        </p>
        <p className="mt-2">
          The learned time coefficient is zero. The extra-time limit handles travel duration
          separately. Nearby tags do not verify conditions on the selected street.
        </p>
      </details>
      <a href="/preference-lab" className="mt-3 inline-block font-semibold text-primary underline">
        Explore survey scenarios →
      </a>
    </details>
  );
}
