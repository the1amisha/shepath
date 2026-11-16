import { useState } from "react";
import { attributes, type Recommendation } from "@/lib/routing/liveRecommendation";
import {
  hybridRecommendation,
  learnedPriorities,
  priorityLabels,
  type Priorities,
  type HybridRow,
} from "@/lib/routing/hybridRecommendation";

export function PriorityControls({
  value,
  onChange,
}: {
  value: Priorities;
  onChange: (value: Priorities) => void;
}) {
  return (
    <details className="my-3 rounded-xl border bg-card p-3">
      <summary className="cursor-pointer font-semibold">Adjust ranking priorities</summary>
      <p className="my-2 text-xs">Defaults use learned survey weights. Changes are your rules.</p>
      {attributes.map((key) => (
        <label key={key} className="my-3 block text-sm">
          {priorityLabels[key]} · {value[key].toFixed(2)}
          <input
            className="mt-1 block w-full"
            aria-label={priorityLabels[key] + " priority"}
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={value[key]}
            onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })}
          />
        </label>
      ))}
      <button
        type="button"
        className="underline"
        onClick={() => onChange({ ...learnedPriorities })}
      >
        Reset learned weights
      </button>
    </details>
  );
}
export function SuitabilityScore({ row }: { row?: HybridRow | undefined }) {
  return (
    <div className="px-3 py-2 text-sm">
      <p className="font-bold">
        {row?.score !== undefined
          ? `Suitability ${row.score.toFixed(0)}/100`
          : "Suitability unavailable"}
      </p>
      {row && (
        <>
          <p className="text-xs">
            {row.coverage.toFixed(0)}% input coverage
            {row.score !== undefined && row.coverage < 99.999 ? " · Provisional" : ""}
            {!row.eligible ? " · Outside time limit" : ""}
          </p>
          <p className="mt-1 text-xs">{row.reason}</p>
        </>
      )}
    </div>
  );
}
const samples = [
  { id: "demo-a", name: "Direct route", minutes: 12, values: [0, 0, 0.2, 0.3] },
  { id: "demo-b", name: "Main street", minutes: 17, values: [0.8, 1, 0.8, 0.7] },
  { id: "demo-c", name: "Footpath route", minutes: 20, values: [1, 0.3, 0.3, 0.2] },
];
export function PresentationDemo({ onClose }: { onClose: () => void }) {
  const [priorities, setPriorities] = useState<Priorities>({ ...learnedPriorities });
  const [missing, setMissing] = useState(false);
  const input: Recommendation = {
    message: "",
    rows: samples.map((sample) => ({
      id: sample.id,
      eligible: true,
      low: 0,
      high: 100,
      values: Object.fromEntries(
        attributes.map((key, i) => [
          key,
          {
            low: missing ? 0 : sample.values[i]!,
            high: missing ? 1 : sample.values[i]!,
            source: "Synthetic demo input",
          },
        ]),
      ) as Recommendation["rows"][number]["values"],
    })),
  };
  const result = hybridRecommendation(input, priorities);
  // Keep all alternatives visible even when every priority is zero.
  const ordered = [...samples].sort(
    (a, b) =>
      (result.rows.find((r) => r.id === b.id)?.score ?? -1) -
        (result.rows.find((r) => r.id === a.id)?.score ?? -1) || a.minutes - b.minutes,
  );
  return (
    <main className="mx-auto max-w-3xl p-5">
      <button type="button" className="underline" onClick={onClose}>
        Back to live routes
      </button>
      <h1 className="mt-5 text-2xl font-bold">Route ranking demo</h1>
      <p className="my-3 rounded-xl bg-secondary p-3 font-bold">
        Synthetic demo data · not live routes
      </p>
      <p className="text-sm">
        Real learned weights, invented route inputs. Scores express suitability, not safety.
      </p>
      <PriorityControls value={priorities} onChange={setPriorities} />
      <label className="block my-3">
        <input type="checkbox" checked={missing} onChange={(e) => setMissing(e.target.checked)} />{" "}
        Simulate missing map data
      </label>
      <div aria-live="polite">
        {ordered.map((sample, index) => {
          const row = result.rows.find((r) => r.id === sample.id);
          return (
            <article key={sample.id} className="my-3 rounded-xl border bg-card p-4">
              <h2 className="font-bold">
                {index + 1}. {sample.name} · {sample.minutes} min
              </h2>
              <SuitabilityScore row={row} />
              <p className="text-xs">
                {missing
                  ? "Synthetic inputs hidden."
                  : attributes
                      .map(
                        (key, i) =>
                          `${priorityLabels[key]} ${Math.round(sample.values[i]! * 100)}%`,
                      )
                      .join(" · ")}
              </p>
            </article>
          );
        })}
      </div>
      <details className="mt-4">
        <summary>How the score works</summary>
        <p className="mt-2 text-sm">
          Weighted mean of route inputs, scaled to 100. Missing inputs use 0.5, with coverage shown
          separately. All unknown means no score. These are designed proxy rules, not calibrated
          probabilities.
        </p>
      </details>
    </main>
  );
}
