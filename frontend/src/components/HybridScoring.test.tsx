import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PresentationDemo } from "./HybridScoring";
describe("presentation demo", () => {
  it("labels synthetic inputs and removes scores when data becomes unknown", () => {
    render(<PresentationDemo onClose={() => {}} />);
    expect(screen.getByText("Synthetic demo data · not live routes")).toBeTruthy();
    expect(screen.getByText(/1. Main street/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Simulate missing map data"));
    expect(screen.getAllByText("Suitability unavailable")).toHaveLength(3);
    expect(screen.getByText(/1. Direct route/)).toBeTruthy();
  });
  it("reranks on priorities and preserves all alternatives with zero weights", () => {
    render(<PresentationDemo onClose={() => {}} />);
    for (const label of ["Lighting", "Open businesses", "Pedestrians"])
      fireEvent.change(screen.getByLabelText(label + " priority"), { target: { value: "0" } });
    expect(screen.getByText(/1. Footpath route/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Footpath priority"), { target: { value: "0" } });
    expect(screen.getAllByText("Suitability unavailable")).toHaveLength(3);
    expect(screen.getByText(/1. Direct route/)).toBeTruthy();
    fireEvent.click(screen.getByText("Reset learned weights"));
    expect(screen.getByText(/1. Main street/)).toBeTruthy();
  });
});
