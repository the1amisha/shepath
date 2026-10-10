import { useEffect, useState } from "react";
import type { RouteData, TravelMode } from "@/lib/routing/types";
import { fetchRouteEvidence, type RouteEvidence } from "@/lib/routing/routeEvidence";

export type EvidenceState = { status: "queued" | "loading" } | { status: "error"; message: string }
  | { status: "complete"; evidence: RouteEvidence };

export function useRouteEvidence(routes: RouteData[], mode: TravelMode, journey: string, enabled: boolean) {
  const [batch, setBatch] = useState<{ routes: RouteData[]; journey: string; states: Record<string, EvidenceState> }>();
  useEffect(() => {
    if (!enabled || mode !== "walk" || !routes.length) return;
    const controller = new AbortController();
    const states: Record<string, EvidenceState> = Object.fromEntries(routes.map(r => [r.id, { status: "queued" }]));
    const publish = () => {
      if (!controller.signal.aborted) setBatch({ routes, journey, states: { ...states } });
    };
    publish();
    void (async () => {
      for (const route of routes) {
        if (controller.signal.aborted) break;
        states[route.id] = { status: "loading" }; publish();
        try { states[route.id] = { status: "complete", evidence: await fetchRouteEvidence(route, controller.signal) }; }
        catch (cause) {
          states[route.id] = { status: "error", message: cause instanceof Error ? cause.message : "Evidence unavailable. Your route is still usable." };
        }
        publish();
      }
    })();
    return () => controller.abort();
  }, [routes, mode, journey, enabled]);
  return enabled && mode === "walk" && batch?.routes === routes && batch.journey === journey ? batch.states : {};
}
