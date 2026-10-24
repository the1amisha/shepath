import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { fetchEvidence } = vi.hoisted(() => ({ fetchEvidence: vi.fn() }));
vi.mock("@/lib/routing", async () => {
  const { MockRoutingService } = await import("@/lib/routing/mockRoutingService");
  return { routingProvider: "mock", routingService: new MockRoutingService() };
});
vi.mock("@/lib/routing/routeEvidence", () => ({ fetchRouteEvidence: fetchEvidence }));
vi.mock("@/components/ShePathMap", () => ({ ShePathMap: () => <div /> }));
import { ShePathApp } from "@/routes/index";
afterEach(cleanup);
const noScores = () => expect(document.body.textContent).not.toMatch(/\b(92|94|91|88|90|84|78)\b|86%|best balance|safest|step by step|full safety report|14 open businesses|9:30 PM|\/\s*100/i);

it.each(["Continue to routes", "Skip preference preview"])("keeps the five-step mock journey honest via %s", async action => {
  fetchEvidence.mockClear();
  render(<ShePathApp />); noScores();
  expect(screen.getByText(/Mock mode: fixed illustrative/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Plan my walk" }));
  expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continue to preference preview" }));
  expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
  expect(screen.getByText(/They do not affect routing/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Lighting/ }));
  fireEvent.click(screen.getByRole("button", { name: action }));
  const first = await screen.findByRole("button", { name: /Demo route 1 Selected/ });
  expect(first).toHaveTextContent("1.7 km");
  expect(first).toHaveTextContent("22 min");
  expect(first).not.toHaveTextContent("Fastest");
  expect(screen.getByText("Step 3 of 5")).toBeInTheDocument(); noScores();
  expect(screen.getByRole("button", { name: /Demo route 2/ })).toHaveTextContent("Fastest demo estimate");
  fireEvent.click(screen.getByRole("button", { name: "View route overview" }));
  expect(screen.getByText("Step 4 of 5")).toBeInTheDocument(); noScores();
  expect(screen.getByText(/no geographic observations or personal-safety assessments/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View geographic evidence" }));
  expect(screen.getByText("Step 5 of 5")).toBeInTheDocument(); noScores();
  expect(screen.getByRole("heading", { level: 1, name: "Geographic evidence" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "No evidence for illustrative routes" })).toBeInTheDocument();
  expect(fetchEvidence).not.toHaveBeenCalled();
});

