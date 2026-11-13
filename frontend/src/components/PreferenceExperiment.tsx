import { useState } from "react";
import { experiment, predictScenario } from "@/lib/preferenceExperiment";
import { Button } from "@/components/ui/button";

const featureLabels = ["Walking time", "Footpath", "Lighting", "Open shops", "Other pedestrians"];

export function PreferenceExperiment() {
  const [index, setIndex] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const scenario = experiment.scenarios[index]!;
  const prediction = predictScenario(index, swapped);
  const probability = prediction.probabilityA;
  const options = swapped ? [scenario.b, scenario.a] : [scenario.a, scenario.b];
  const counts = swapped
    ? [scenario.observedB, scenario.observedA]
    : [scenario.observedA, scenario.observedB];

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <a href="/" className="inline-block text-sm font-bold text-primary underline">
          ← Back to SHEPATH
        </a>
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Survey experiment · ML demo
          </p>
          <h1 className="mt-3 font-display text-3xl font-black sm:text-4xl">
            What shapes a walking choice?
          </h1>
          <p className="mt-4 max-w-2xl leading-7">
            Explore what logistic regression learned from 39 consenting survey submissions. Compare
            six hypothetical route pairs and see its estimated choice probabilities.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Experimental stated preferences, not personal-safety predictions. These estimates do not
            rank your live routes.
          </p>
        </header>

        <section className="rounded-3xl border bg-card p-5 sm:p-8" aria-labelledby="scenario-title">
          <h2 id="scenario-title" className="text-xl font-bold">
            Compare a survey scenario
          </h2>
          <label htmlFor="survey-scenario" className="mt-5 block text-sm font-bold">
            Scenario
          </label>
          <select
            id="survey-scenario"
            value={index}
            onChange={(event) => {
              setIndex(Number(event.target.value));
              setSwapped(false);
            }}
            className="mt-2 w-full rounded-xl border bg-background p-3"
          >
            {experiment.scenarios.map((item, i) => (
              <option key={item.title} value={i}>
                {item.title}
              </option>
            ))}
          </select>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {options.map((description, i) => (
              <article key={i} className="rounded-2xl bg-secondary p-5">
                <h3 className="font-bold">Route {i === 0 ? "A" : "B"}</h3>
                <p className="mt-2 leading-7">{description}</p>
              </article>
            ))}
          </div>
          <Button className="mt-4" variant="outline" onClick={() => setSwapped(!swapped)}>
            Swap A and B
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Swapping labels reverses the probabilities; the route attributes determine the result.
          </p>
          <div className="mt-6 rounded-2xl border p-5" aria-live="polite" aria-atomic="true">
            <h3 className="font-bold">Model estimate</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {[probability, 1 - probability].map((value, i) => (
                <div key={i}>
                  <p className="text-sm">Route {i === 0 ? "A" : "B"}</p>
                  <p className="mt-1 text-3xl font-extrabold text-primary">
                    {(value * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm">
              Estimated choice probability from the final model fitted on all 202 clear answers.
              This is not a personal recommendation or a held-out prediction.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Observed clear survey choices for this pair: A = {counts[0]}, B = {counts[1]}. These
              answers were used in the final fit; they are not an independent test.
            </p>
          </div>
          <details className="mt-5">
            <summary className="cursor-pointer font-bold">How is this calculated?</summary>
            <p className="mt-3 text-sm leading-6">
              Each predefined A-minus-B attribute contrast is multiplied by its learned coefficient.
              The contributions are added, then converted to a probability using the logistic
              function. Positive contributions favour A; negative contributions favour B. Time is
              measured in five-minute units. Unmentioned attributes are assumed equal for these
              scenarios.
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              {prediction.contributions.map((value, i) => (
                <div className="flex justify-between gap-4" key={featureLabels[i]}>
                  <dt>{featureLabels[i]}</dt>
                  <dd>{value.toFixed(3)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">
              Coefficients describe this small, limited questionnaire. They do not establish causal
              effects or prove that people generally prefer longer walks or fewer pedestrians.
            </p>
          </details>
        </section>

        <section
          className="rounded-3xl border bg-card p-5 sm:p-8"
          aria-labelledby="evaluation-title"
        >
          <h2 id="evaluation-title" className="text-xl font-bold">
            How well did it predict held-out answers?
          </h2>
          <p className="mt-3 text-sm leading-6">
            For each of 39 folds, one submission and all its answers were held out. The model and a
            scenario-frequency baseline were trained on the remaining submissions. No settings were
            tuned using these results.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Leave-one-submission-out evaluation</caption>
              <thead>
                <tr>
                  <th className="p-2">Metric</th>
                  <th className="p-2">Model</th>
                  <th className="p-2">Baseline</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <th className="p-2">Accuracy</th>
                  <td className="p-2">
                    {(experiment.evaluation.model.accuracy * 100).toFixed(1)}%
                  </td>
                  <td className="p-2">
                    {(experiment.evaluation.scenario_baseline.accuracy * 100).toFixed(1)}%
                  </td>
                </tr>
                <tr className="border-t">
                  <th className="p-2">Log loss ↓</th>
                  <td className="p-2">{experiment.evaluation.model.log_loss.toFixed(3)}</td>
                  <td className="p-2">
                    {experiment.evaluation.scenario_baseline.log_loss.toFixed(3)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-6">
            Both methods correctly predicted 136 of 202 answers. The model had slightly lower log
            loss (better probability estimates on this evaluation), but this does not establish a
            meaningful overall advantage.
          </p>
          <details className="mt-5">
            <summary className="cursor-pointer font-bold">Dataset and limitations</summary>
            <p className="mt-3 text-sm leading-6">
              40 submissions received; one excluded without affirmative consent. From 39 consenting
              submissions, 202 clear A/B answers were retained; 14 no-preference, 7 missing and 11
              uncertain answers were excluded. Multiple answers from one submission are correlated,
              and unique people cannot be verified.
            </p>
            <p className="mt-3 text-sm leading-6">
              This evaluates new submissions answering the same six scenarios, not unseen routes or
              the wider population. Historical map records and unknown tags are not substituted for
              survey attributes. The live route comparison offers manual evidence weights and a separate experimental
              constrained ML recommender. This page retains the original unconstrained model.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Model: regularized logistic regression, C = 1, no intercept. Baseline: smoothed
              scenario choice frequencies from each training fold. Evaluation updated 13 November
              2026. Only aggregate results and model coefficients are included in this demo.
            </p>
          </details>
        </section>
      </div>
    </main>
  );
}
