import experiment from "./preferenceExperiment.json";

export { experiment };

/** Frozen survey contrasts only; never accepts live route or missing OSM attributes. */
export function predictScenario(index: number, swapped = false) {
  const scenario = experiment.scenarios[index];
  if (!scenario || !Number.isInteger(index)) throw new Error("Unknown survey scenario");
  const contributions = scenario.features.map(
    (value, i) => value * experiment.model.coefficients[i]! * (swapped ? -1 : 1),
  );
  const score = contributions.reduce((sum, value) => sum + value, 0);
  return { probabilityA: 1 / (1 + Math.exp(-score)), contributions };
}
