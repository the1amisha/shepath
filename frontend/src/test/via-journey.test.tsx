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
  fireEvent.click(screen.getByRole("button", { name: "Plan my journey" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Plan my journey" }));
  fireEvent.focus(screen.getByLabelText("Going to"));
  fireEvent.click(screen.getByRole("option", { name: "Sarala Birla University" }));
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
it("uses the campus as start without replacing the destination", async () => {
  getRoutes.mockResolvedValue([evidenceRoute]);
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Plan my journey" }));
  fireEvent.focus(screen.getByLabelText("Starting from"));
  fireEvent.click(screen.getByRole("option", { name: "Sarala Birla University" }));
  expect(screen.getByLabelText("Starting from")).toHaveValue(
    "Sarala Birla University, Ara, Mahilong, Ranchi",
  );
  expect(screen.getByLabelText("Going to")).toHaveValue("Ranchi Railway Station, Ranchi");
  for (const name of ["Continue to preferences", "Skip preferences"])
    fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByRole("button", { name: "View route overview" });
  expect(getRoutes.mock.calls[0]![0]).toMatchObject({
    origin: "Sarala Birla University, Ara, Mahilong, Ranchi",
    originPoint: [23.3473466, 85.4174703],
    destination: "Ranchi Railway Station, Ranchi",
  });
});
it("targets shortcuts at the last focused field and preserves campus coordinates", async () => {
  getRoutes.mockResolvedValue([evidenceRoute]);
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Plan my journey" }));
  const origin = screen.getByLabelText("Starting from");
  const destination = screen.getByLabelText("Going to");
  fireEvent.focus(origin);

  fireEvent.click(screen.getByRole("option", { name: "Sarala Birla University" }));
  expect(origin).toHaveValue("Sarala Birla University, Ara, Mahilong, Ranchi");
  expect(destination).toHaveValue("Ranchi Railway Station, Ranchi");
  fireEvent.focus(destination);

  fireEvent.click(screen.getByRole("option", { name: "Doranda, Ranchi" }));
  expect(origin).toHaveValue("Sarala Birla University, Ara, Mahilong, Ranchi");
  expect(destination).toHaveValue("Doranda, Ranchi");
  for (const name of ["Continue to preferences", "Skip preferences"])
    fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByRole("button", { name: "View route overview" });
  expect(getRoutes.mock.calls[0]![0]).toMatchObject({
    origin: "Sarala Birla University, Ara, Mahilong, Ranchi",
    originPoint: [23.3473466, 85.4174703],
    destination: "Doranda, Ranchi",
  });
  expect(getRoutes.mock.calls[0]![0]).not.toHaveProperty("destinationPoint");
});

it("offers current location first only for the origin and allows keyboard shortcut selection", () => {
  render(<ShePathApp />);
  fireEvent.click(screen.getByRole("button", { name: "Plan my journey" }));
  const origin = screen.getByLabelText("Starting from");
  fireEvent.focus(origin);
  expect(screen.getAllByRole("option")[0]).toHaveTextContent("Current location");
  fireEvent.keyDown(origin, { key: "ArrowDown" });
  fireEvent.keyDown(origin, { key: "ArrowDown" });
  fireEvent.keyDown(origin, { key: "Enter" });
  expect(origin).toHaveValue("Sarala Birla University, Ara, Mahilong, Ranchi");
  const destination = screen.getByLabelText("Going to");
  fireEvent.focus(destination);
  expect(screen.queryByRole("option", { name: "Current location" })).not.toBeInTheDocument();
  fireEvent.keyDown(destination, { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(getRoutes).not.toHaveBeenCalled();
});
