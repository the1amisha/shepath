import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { evidenceRoute } from "./evidenceFixture";
const { getRoutes } = vi.hoisted(() => ({ getRoutes: vi.fn() }));
vi.mock("@/lib/routing", () => ({ routingProvider: "api", routingService: { getRoutes } }));
vi.mock("@/hooks/useRouteEvidence", () => ({ useRouteEvidence: () => ({}) }));
vi.mock("@/components/ShePathMap", () => ({ ShePathMap: () => <div /> }));
vi.mock("@/components/LocationPicker", () => ({
  LocationPicker: ({
    onPick,
  }: {
    onPick: (target: string, point: number[], label: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onPick("origin", [23.36, 85.32], "Map start");
        onPick("destination", [23.35, 85.33], "Map destination");
      }}
    >
      Pick test points
    </button>
  ),
}));
import { ShePathApp } from "@/routes/index";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("routes selected coordinates and clears stale points when names are edited", async () => {
  getRoutes.mockResolvedValue([evidenceRoute]);
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Plan my walk" }));
  fireEvent.click(screen.getByRole("button", { name: "Pick test points" }));
  for (const name of ["Continue to preferences", "Skip preferences"])
    fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByRole("button", { name: "View route overview" });
  expect(getRoutes.mock.calls[0]![0]).toMatchObject({
    originPoint: [23.36, 85.32],
    destinationPoint: [23.35, 85.33],
  });
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Starting from"), { target: { value: "New start" } });
  fireEvent.click(screen.getByRole("button", { name: "Doranda, Ranchi" }));
  for (const name of ["Continue to preferences", "Skip preferences"])
    fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByRole("button", { name: "View route overview" });
  expect(getRoutes.mock.calls[1]![0]).not.toHaveProperty("originPoint");
  expect(getRoutes.mock.calls[1]![0]).not.toHaveProperty("destinationPoint");
});
