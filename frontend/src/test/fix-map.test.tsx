import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FixMapPanel } from "@/components/FixMapPanel";
import { segmentFixture } from "./segmentFixture";
afterEach(cleanup);
function open() {
  fireEvent.click(screen.getByText(/Fix the map ·/));
}
it("includes only unknown stretches and links latitude/longitude to the editor", () => {
  const e = segmentFixture();
  e.segments[0]!.sidewalk_unknown_percent = 0;
  render(<FixMapPanel evidence={e} />);
  open();
  expect(screen.queryByRole("link", { name: "View stretch 1 on OSM" })).not.toBeInTheDocument();
  const link = screen.getByRole("link", { name: "Open OSM editor for stretch 2" });
  expect(link).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/edit?editor=id#map=18/23.356000/85.320000",
  );
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getByText(/do not update this app/)).toBeInTheDocument();
});
it("keeps small unknown shares visible and does not infer missing features", () => {
  const e = segmentFixture();
  e.segments[0]!.lighting_unknown_percent = 0.001;
  render(<FixMapPanel evidence={e} />);
  open();
  expect(screen.getByText(/less than 0.1%/)).toBeInTheDocument();
  expect(screen.getByText(/not confirmed missing street features/)).toBeInTheDocument();
});
it("handles no gaps explicitly", () => {
  const e = segmentFixture();
  e.segments.forEach((s) => {
    s.lighting_unknown_percent = 0;
    s.sidewalk_unknown_percent = 0;
  });
  render(<FixMapPanel evidence={e} />);
  open();
  expect(screen.getByText(/No stretches have missing/)).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("pages long routes and resets when evidence changes", () => {
  const e = segmentFixture();
  e.segments = Array.from({ length: 21 }, (_, i) => ({
    ...e.segments[1]!,
    index: i + 1,
    start_metres: i * 150,
    end_metres: (i + 1) * 150,
  }));
  const view = render(<FixMapPanel evidence={e} />);
  open();
  expect(screen.getAllByRole("link")).toHaveLength(20);
  fireEvent.click(screen.getByRole("button", { name: "Show more stretches" }));
  expect(screen.getAllByRole("link")).toHaveLength(40);
  view.rerender(<FixMapPanel evidence={segmentFixture()} />);
  open();
  expect(screen.getAllByRole("link")).toHaveLength(4);
});
