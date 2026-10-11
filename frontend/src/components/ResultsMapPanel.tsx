import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Stick the entire map/legend/actions column only when it fits below the header. */
export function ResultsMapPanel({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ fits: false, top: 0 });

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const header = document.querySelector<HTMLElement>("[data-journey-header]");
    const measure = () => {
      const headerHeight = header && getComputedStyle(header).position === "sticky"
        ? header.getBoundingClientRect().height : 0;
      const top = headerHeight + 16;
      const fits = element.getBoundingClientRect().height <= window.innerHeight - top - 16;
      setLayout(previous => previous.fits === fits && previous.top === top ? previous : { fits, top });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    if (header) observer?.observe(header);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  return <div ref={panel} className="results-map-panel min-w-0" data-sticky-fits={layout.fits}
    style={{ "--results-panel-top": `${layout.top}px` } as CSSProperties}>{children}</div>;
}
