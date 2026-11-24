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

it.each(["Continue to routes", "Skip preferences"])("keeps the four-step mock journey honest via %s", async action => {
  fetchEvidence.mockClear();
  render(<ShePathApp />); noScores();
  expect(screen.getByText(/Mock mode: fixed illustrative/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Plan my walk" }));
  expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continue to preferences" }));
  expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
  expect(screen.getByText(/They do not change the paths/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("slider", { name: /^Lighting/ }), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: action }));
  const first = await screen.findByRole("button", { name: /Demo route 1 Selected/ });
  expect(first).toHaveTextContent("1.7 km");
  expect(first).toHaveTextContent("22 min");
  expect(first).not.toHaveTextContent("Fastest");
  expect(screen.getByText("Step 3 of 4")).toBeInTheDocument(); noScores();
  expect(screen.getByRole("button", { name: /Demo route 2/ })).toHaveTextContent("Fastest demo estimate");
  fireEvent.click(screen.getByRole("button", { name: "View route overview" }));
  expect(screen.getByText("Step 4 of 4")).toBeInTheDocument(); noScores();
  expect(screen.getByText(/no geographic observations or personal-safety assessments/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "View geographic evidence" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Plan another journey" })).toBeInTheDocument();
  expect(fetchEvidence).not.toHaveBeenCalled();
});

