import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PreferenceExperiment } from "@/components/PreferenceExperiment";
import { experiment, predictScenario } from "@/lib/preferenceExperiment";

afterEach(cleanup);

describe("frozen preference experiment", () => {
  it("matches Python model probabilities for every survey scenario", () => {
    experiment.scenarios.forEach((scenario, i) => {
      expect(predictScenario(i).probabilityA).toBeCloseTo(scenario.referenceProbability, 12);
      expect(predictScenario(i, true).probabilityA).toBeCloseTo(
        1 - scenario.referenceProbability,
        12,
      );
    });
    expect(() => predictScenario(6)).toThrow("Unknown survey scenario");
  });

  it("changes scenarios, reverses route labels and identifies final-fit estimates", () => {
    render(<PreferenceExperiment />);
    fireEvent.change(screen.getByLabelText("Scenario"), { target: { value: "1" } });
    const original = (predictScenario(1).probabilityA * 100).toFixed(1) + "%";
    expect(screen.getByText(original)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Swap A and B" }));
    expect(screen.getByText(/Observed clear survey choices/)).toHaveTextContent("A = 8, B = 27");
    expect(screen.getByText(/This is not a personal recommendation/)).toBeInTheDocument();
    expect(screen.getByText(/Both methods correctly predicted 136 of 202/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Scenario"), { target: { value: "0" } });
    expect(screen.getByText(/Observed clear survey choices/)).toHaveTextContent("A = 9, B = 26");
  });
});
