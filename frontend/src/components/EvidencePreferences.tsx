import { useId } from "react";
import {
  criteria,
  criterionLabels,
  emptyWeights,
  normalizedWeights,
  type Weights,
} from "@/lib/routing/evidenceMatch";

export function EvidencePreferences({
  weights,
  onChange,
}: {
  weights: Weights;
  onChange: (weights: Weights) => void;
}) {
  const id = useId();
  const shares = normalizedWeights(weights);
  return (
    <fieldset className="space-y-4 rounded-2xl border border-border p-4">
      <legend className="px-2 font-bold">Evidence preferences</legend>
      <p className="text-sm text-muted-foreground">
        Weights reorder supported live routes after evidence loads. They do not change the paths or
        measure safety.
      </p>
      {criteria.map((key) => (
        <div key={key}>
          <label htmlFor={`${id}-${key}`} className="block text-sm font-bold">
            {criterionLabels[key]}: {weights[key]}{" "}
            <span className="font-normal">({(shares[key] * 100).toFixed(0)}% of total weight)</span>
          </label>
          <input
            id={`${id}-${key}`}
            type="range"
            min="0"
            max="100"
            step="5"
            value={weights[key]}
            onChange={(event) => onChange({ ...weights, [key]: Number(event.target.value) })}
            className="mt-2 block min-h-6 w-full accent-primary"
          />
        </div>
      ))}
      <p className="text-sm text-muted-foreground">
        <b>Street activity: unavailable.</b> No observations of pedestrians or crowds are available,
        so activity is excluded from matching.
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        Lighting and infrastructure measure route length near usable OSM tags, including recorded
        “no”. They measure how much is documented, not lighting or footpath quality. Businesses use
        mapped records per kilometre, relative to these alternatives; opening status and map
        completeness are unknown.
      </p>
      <button
        type="button"
        className="rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onChange({ ...emptyWeights })}
      >
        Reset weights
      </button>
    </fieldset>
  );
}
