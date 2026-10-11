import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { evidenceRoute } from "./evidenceFixture";
vi.mock("leaflet", () => { throw new Error("Leaflet chunk unavailable"); });
import { ShePathMap } from "@/components/ShePathMap";
afterEach(cleanup);
it("contains a rejected Leaflet import and offers map-only recovery", async () => {
  render(<ShePathMap routes={[evidenceRoute]} selected={evidenceRoute.id} />);
  expect(await screen.findByText(/The map could not be initialized/)).toHaveAttribute("role", "status");
  expect(screen.getByRole("button", { name: "Retry map" })).toBeEnabled();
  expect(screen.getByText(/No replacement route has been generated/)).toBeVisible();
});
