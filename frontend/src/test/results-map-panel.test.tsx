import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ResultsMapPanel } from "@/components/ResultsMapPanel";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("rechecks measured header and wrapped action height without remounting map children", () => {
  let panelHeight = 650;
  let headerHeight = 80;
  let notifyResize!: () => void;
  const observe = vi.fn(); const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { notifyResize = callback; }
    observe = observe;
    disconnect = disconnect;
  });
  vi.stubGlobal("innerHeight", 930);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { height: this.tagName === "HEADER" ? headerHeight : panelHeight } as DOMRect;
  });
  const mounted = vi.fn(); const unmounted = vi.fn();
  function MapChild() { useEffect(() => { mounted(); return unmounted; }, []); return <div>Map instance</div>; }
  const { unmount } = render(<><header data-journey-header style={{ position: "sticky" }} /><ResultsMapPanel><MapChild /></ResultsMapPanel></>);
  const panel = screen.getByText("Map instance").parentElement!;
  expect(panel).toHaveAttribute("data-sticky-fits", "true");
  expect(panel.style.getPropertyValue("--results-panel-top")).toBe("96px");
  expect(observe).toHaveBeenCalledTimes(2);
  panelHeight = 850;
  act(() => notifyResize());
  expect(panel).toHaveAttribute("data-sticky-fits", "false");
  panelHeight = 650; headerHeight = 120;
  act(() => notifyResize());
  expect(panel).toHaveAttribute("data-sticky-fits", "true");
  expect(panel.style.getPropertyValue("--results-panel-top")).toBe("136px");
  vi.stubGlobal("innerHeight", 600);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(panel).toHaveAttribute("data-sticky-fits", "false");
  expect(mounted).toHaveBeenCalledOnce(); expect(unmounted).not.toHaveBeenCalled();
  unmount(); expect(disconnect).toHaveBeenCalledOnce(); expect(unmounted).toHaveBeenCalledOnce();
});

it("handles a nonsticky header and missing ResizeObserver without blocking content", () => {
  vi.stubGlobal("ResizeObserver", undefined);
  vi.stubGlobal("innerHeight", 500);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 480 } as DOMRect);
  render(<><header data-journey-header style={{ position: "static" }} /><ResultsMapPanel><button>Continue</button></ResultsMapPanel></>);
  const panel = screen.getByRole("button").parentElement!;
  expect(panel.style.getPropertyValue("--results-panel-top")).toBe("16px");
  expect(panel).toHaveAttribute("data-sticky-fits", "false");
  expect(screen.getByRole("button")).toBeEnabled();
});
