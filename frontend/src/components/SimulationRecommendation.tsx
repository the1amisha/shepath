import { attributes } from "@/lib/routing/liveRecommendation";
import { priorityLabels } from "@/lib/routing/hybridRecommendation";
import {
  simulationModel,
  type SimulationRow,
  type SimulationResult,
} from "@/lib/routing/simulationRecommendation";

export function SimulationScore({ row }: { row?: SimulationRow | undefined }) {
  if (!row) return <p className="p-3 text-sm">Simulation rating unavailable</p>;
  return (
    <div className="px-3 py-2 text-sm">
      <p className="font-bold">Simulated rating {row.score!.toFixed(1)}/100</p>
      <p className="text-xs">
        {(100 - row.coverage).toFixed(0)}% generated inputs
        {!row.eligible && " · Outside time limit"}
      </p>
      <p className="mt-1 text-xs">{row.reason}</p>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer">Input sources</summary>
        {attributes.map((key) => (
          <p className="mt-2" key={key}>
            {priorityLabels[key]}: {row.inputs[key].toFixed(2)} ·{" "}
            {(row.simulated[key] * 100).toFixed(0)}% generated.
            {row.simulated[key] < 1 && <> Remaining portion: {row.values[key].source}.</>}
          </p>
        ))}
        <p className="mt-2">
          Night fraction: {row.nightFraction.toFixed(2)} · estimated from departure and duration.
        </p>
        <p className="mt-2">
          Reasons compare one input with 0.5 while keeping the others fixed; they are model
          sensitivities, not causal findings.
        </p>
      </details>
    </div>
  );
}
export function SimulationPanel({
  result,
  departure,
  onDeparture,
  maxExtra,
  onMaxExtra,
}: {
  result: SimulationResult;
  departure: string;
  onDeparture: (value: string) => void;
  maxExtra: number;
  onMaxExtra: (value: number) => void;
}) {
  return (
    <section
      aria-label="Simulation-based ML recommendation"
      className="my-4 rounded-2xl border bg-card p-4"
    >
      <h2 className="font-bold">Simulation-based ML recommendation</h2>
      <p className="mt-1 text-sm">{result.message}</p>
      <div className="my-3 flex flex-wrap gap-4">
        <label className="text-sm">
          Departure (IST)
          <input
            className="mt-1 block rounded border p-2"
            type="datetime-local"
            value={departure}
            onChange={(e) => onDeparture(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Extra walking time
          <select
            className="mt-1 block rounded border p-2"
            value={String(maxExtra)}
            onChange={(e) => onMaxExtra(Number(e.target.value))}
          >
            <option value="Infinity">Any duration</option>
            {[0, 5, 10, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n} extra min
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-bold">Model & evaluation</summary>
        <p className="mt-2">
          64 fitted gradient-boosted trees · {simulationModel.train_rows} synthetic training
          examples · {simulationModel.test_rows} held-out synthetic examples from separate generated
          environments.
        </p>
        <p className="mt-2">
          Synthetic test MAE: {simulationModel.metrics.synthetic_test_mae.toFixed(2)} points;
          constant baseline: {simulationModel.metrics.constant_baseline_mae.toFixed(2)}. These
          measure fit to invented ratings, not real-world safety.
        </p>
        <p className="mt-2">
          Map proxies are incorporated only when all alternatives have comparable evidence. Unknown
          portions use fixed generated cell values (seed {simulationModel.seed}); they are never
          saved as map evidence. Scores can update when evidence arrives. Survey responses do not
          supply this model's safety labels.
        </p>
      </details>
    </section>
  );
}
