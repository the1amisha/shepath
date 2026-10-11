import { useEffect, useRef } from "react";

// Use actual header height, including wrapped/zoomed text, rather than a fixed offset.
export function focusContent(target: HTMLElement | null) {
  if (!target) return;
  target.focus({ preventScroll: true });
  const header = document.querySelector<HTMLElement>("[data-journey-header]");
  const offset = (header && getComputedStyle(header).position === "sticky" ? header.getBoundingClientRect().height : 0) + 16;
  window.scrollTo({ top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset), behavior: "instant" });
}

export function useJourneyFocus(screen: string, saved: boolean, showSaved: () => void) {
  const savedTrigger = useRef<HTMLButtonElement>(null);
  const restoreSaved = useRef(false);
  const previousSaved = useRef(false);
  const openSaved = () => { restoreSaved.current = true; showSaved(); };

  useEffect(() => {
    if (previousSaved.current && !saved && restoreSaved.current) {
      // The original node was unmounted; the ref now identifies its replacement.
      focusContent(savedTrigger.current ?? document.getElementById("journey-heading"));
      restoreSaved.current = false;
    } else {
      focusContent(document.getElementById("journey-heading"));
    }
    previousSaved.current = saved;
  }, [screen, saved]);
  return { savedTrigger, openSaved };
}
