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
it("plans a direct journey without a via field or shared stop", async () => {
  getRoutes.mockResolvedValue([evidenceRoute]);
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Plan my walk" }));
  expect(screen.queryByLabelText("Via (optional)")).not.toBeInTheDocument();
  for (const name of ["Continue to preferences", "Skip preferences"])
    fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByRole("button", { name: "View route overview" });
  expect(getRoutes.mock.calls[0]![0]).not.toHaveProperty("via");
  fireEvent.click(screen.getByRole("button", { name: "View route overview" }));
  expect(screen.queryByText(/Via:/)).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Share on WhatsApp" }).getAttribute("href"),
  ).not.toContain("Via%3A");
});
it("routes the campus shortcut using its selected coordinates", async () => {
  getRoutes.mockResolvedValue([evidenceRoute]);
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Plan my walk" }));
  fireEvent.click(screen.getByRole("button", { name: "Sarala Birla University" }));
  expect(screen.getByLabelText("Going to")).toHaveValue(
    "Sarala Birla University, Ara, Mahilong, Ranchi",
  );
  for (const name of ["Continue to preferences", "Skip preferences"])
    fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByRole("button", { name: "View route overview" });
  expect(getRoutes.mock.calls[0]![0]).toMatchObject({
    destination: "Sarala Birla University, Ara, Mahilong, Ranchi",
    destinationPoint: [23.3473466, 85.4174703],
  });
});
