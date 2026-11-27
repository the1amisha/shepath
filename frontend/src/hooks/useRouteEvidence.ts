import { useEffect, useRef, useState } from "react";
import type { RouteData, TravelMode } from "@/lib/routing/types";
import { fetchRouteEvidence, type RouteEvidence } from "@/lib/routing/routeEvidence";

export type EvidenceState =
  | { status: "queued" | "loading" }
  | { status: "error"; message: string }
  | { status: "complete"; evidence: RouteEvidence };

export function useRouteEvidence(
  routes: RouteData[],
  mode: TravelMode,
  journey: string,
  enabled: boolean,
) {
  const cache = useRef(new Map<string, { expires: number; evidence: RouteEvidence }>());
  const [batch, setBatch] = useState<{
    routes: RouteData[];
    journey: string;
    states: Record<string, EvidenceState>;
  }>();
  useEffect(() => {
    if (!enabled || mode === "cycle" || !routes.length) return;
    const controller = new AbortController();
    const states: Record<string, EvidenceState> = Object.fromEntries(
      routes.map((r) => [r.id, { status: "queued" }]),
    );
    const publish = () => {
      if (!controller.signal.aborted) setBatch({ routes, journey, states: { ...states } });
    };
    publish();
    void (async () => {
      for (const route of routes) {
        if (controller.signal.aborted) break;
        states[route.id] = { status: "loading" };
        publish();
        try {
          const key = JSON.stringify([
            mode,
            route.id,
            route.coordinates,
            route.distanceMeters,
            route.durationSeconds,
          ]);
          for (const [cachedKey, entry] of cache.current) {
            if (entry.expires <= Date.now()) cache.current.delete(cachedKey);
          }
          const cached = cache.current.get(key);
          const evidence = cached
            ? structuredClone(cached.evidence)
            : await fetchRouteEvidence(route, controller.signal);
          if (controller.signal.aborted) break;
          if (!cached && evidence.status === "available") {
            // Memory only, bounded to twelve routes and five minutes. Failures remain retryable.
            if (cache.current.size >= 12) cache.current.delete(cache.current.keys().next().value!);
            cache.current.set(key, {
              expires: Date.now() + 300000,
              evidence: structuredClone(evidence),
            });
          }
          states[route.id] = { status: "complete", evidence };
        } catch (cause) {
          states[route.id] = {
            status: "error",
            message:
              cause instanceof Error
                ? cause.message
                : "Evidence unavailable. Your route is still usable.",
          };
        }
        publish();
      }
    })();
    return () => controller.abort();
  }, [routes, mode, journey, enabled]);
  return enabled && mode !== "cycle" && batch?.routes === routes && batch.journey === journey
    ? batch.states
    : {};
}
