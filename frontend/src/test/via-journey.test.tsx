import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { evidenceRoute } from "./evidenceFixture";
const { getRoutes } = vi.hoisted(() => ({ getRoutes: vi.fn() }));
vi.mock("@/lib/routing", () => ({ routingProvider: "api", routingService: { getRoutes } }));
vi.mock("@/hooks/useRouteEvidence", () => ({ useRouteEvidence: () => ({}) }));
vi.mock("@/components/ShePathMap", () => ({ ShePathMap: () => <div /> }));
import { ShePathApp } from "@/routes/index";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("sends a trimmed via, keeps it in the overview/share text and removes it for a new search", async () => {
  getRoutes.mockResolvedValue([evidenceRoute]);
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Plan my walk" }));
  fireEvent.change(screen.getByLabelText("Via (optional)"), {
    target: { value: " Sadar Hospital, Ranchi " },
  });
  for (const name of ["Continue to preferences", "Skip preferences"])
    fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByRole("button", { name: "View route overview" });
  expect(getRoutes).toHaveBeenLastCalledWith(
    expect.objectContaining({ via: "Sadar Hospital, Ranchi" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "View route overview" }));
  expect(screen.getByText(/Via: Sadar Hospital, Ranchi \(requested location/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Go back/ }));
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove via location" }));
  for (const name of ["Continue to preferences", "Skip preferences"])
    fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByRole("button", { name: "View route overview" });
  expect(getRoutes.mock.calls[1]![0]).not.toHaveProperty("via");
});
