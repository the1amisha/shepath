import { useEffect, useRef, useState } from "react";
import { predictSimulation } from "@/lib/routing/simulationRecommendation";
import { Button } from "@/components/ui/button";

const labels = [
  "Footpath",
  "Lighting",
  "Open businesses",
  "Pedestrian activity",
  "Night-time portion",
];
const initial = [0.5, 0.5, 0.5, 0.5, 0];

export function ModelLab({ onClose }: { onClose: () => void }) {
  const [values, setValues] = useState(initial);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const score = predictSimulation(values);
  const baseline = predictSimulation(initial);
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <Button variant="outline" onClick={onClose}>
        Back to journey
      </Button>
      <h1 ref={heading} tabIndex={-1} className="mt-6 font-display text-3xl font-black">
        Model lab
      </h1>
      <p className="mt-2 text-muted-foreground">Change a scenario. See how the model responds.</p>
      <p className="my-5 rounded-xl bg-secondary p-3 text-sm font-semibold">
        Hypothetical inputs · not observed street conditions
      </p>
      <section className="rounded-3xl border bg-card p-6" aria-label="What-if experiment">
        <h2 className="text-xl font-bold">What if?</h2>
        <div className="my-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm">Starting scenario</p>
            <p className="text-2xl font-bold">{baseline.toFixed(1)}</p>
          </div>
          <div role="status">
            <p className="text-sm">Simulated model rating</p>
            <p className="text-2xl font-bold">{score.toFixed(1)} / 100</p>
          </div>
        </div>
        {labels.map((label, index) => (
          <label key={label} className="my-5 block text-sm font-semibold">
            {label} · {Math.round(values[index]! * 100)}%
            <input
              aria-label={label}
              type="range"
              min="0"
              max="1"
              step="0.05"
              className="mt-2 block w-full"
              value={values[index]}
              onChange={(event) =>
                setValues(
                  values.map((value, i) => (i === index ? Number(event.target.value) : value)),
                )
              }
            />
          </label>
        ))}
        <Button variant="outline" onClick={() => setValues([...initial])}>
          Reset scenario
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          This experiment does not change your journey or its ranking.
        </p>
      </section>
      <details className="mt-5 rounded-2xl border bg-card p-5">
        <summary className="cursor-pointer font-semibold">Model & data sources</summary>
        <p className="mt-3 text-sm leading-6">
          This gradient-boosted tree model was trained on generated examples and predicts a
          synthetic rating. It demonstrates model behaviour, not real-world safety. The main journey
          uses a separate survey-trained preference model with available map evidence.
        </p>
        <a className="mt-3 inline-block text-primary underline" href="/preference-lab">
          Explore the survey model
        </a>
      </details>
    </main>
  );
}
