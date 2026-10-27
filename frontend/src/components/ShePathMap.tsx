import { useEffect, useRef, useState } from "react";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import { segmentColors, segmentLabels } from "@/lib/routing/segmentEvidence";
import { Button } from "@/components/ui/button";
import type { RouteData } from "@/lib/routing";

export function ShePathMap({
  routes,
  selected,
  mock = false,
  evidenceState,
}: {
  routes: RouteData[];
  selected: string;
  mock?: boolean;
  evidenceState?: EvidenceState | undefined;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "initialization-error" | "tile-error">(
    "loading",
  );
  const [showSegments, setShowSegments] = useState(false);
  const segmentEvidence =
    !mock &&
    evidenceState?.status === "complete" &&
    evidenceState.evidence.route.id === selected &&
    evidenceState.evidence.status === "available"
      ? evidenceState.evidence.route_context?.segment_evidence
      : undefined;
  const activeRoute = routes.find((route) => route.id === selected);
  useEffect(() => {
    const active = routes.find((route) => route.id === selected);
    if (!active) return;
    setStatus("loading");
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    let tiles: import("leaflet").TileLayer | undefined;
    let tileFailed = false;
    const tileError = () => {
      tileFailed = true;
      if (!disposed) setStatus("tile-error");
    };
    async function mountMap() {
      try {
        const L = await import("leaflet");
        if (disposed || !containerRef.current || !active) return;
        map = L.map(containerRef.current, { zoomControl: false });
        mapRef.current = map;
        tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        });
        tiles.on("tileerror", tileError);
        tiles.addTo(map);
        L.control.zoom({ position: "bottomright" }).addTo(map);
        const colors = ["#087fbd", "#a57835", "#237c61"];
        const draw = (route: RouteData) =>
          L.polyline(route.coordinates, {
            color: colors[routes.indexOf(route) % colors.length],
            opacity: route.id === selected ? 1 : 0.32,
            weight: route.id === selected ? 7 : 4,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map!);
        routes.filter((route) => route.id !== selected).forEach(draw);
        draw(active);
        if (showSegments && segmentEvidence) {
          for (const segment of segmentEvidence.segments) {
            L.polyline(segment.coordinates, {
              color: segmentColors[segment.facility_coverage],
              weight: 8,
              opacity: 1,
              lineCap: "butt",
              lineJoin: "round",
            })
              .bindTooltip(
                `Stretch ${segment.index}: ${Math.round(segment.start_metres)}–${Math.round(segment.end_metres)} m. ${segmentLabels[segment.facility_coverage]}. ${segment.business_count} business and ${segment.healthcare_count} healthcare records.`,
              )
              .addTo(map);
          }
        }
        const markerIcon = (label: string) =>
          L.divIcon({
            className: "shepath-marker",
            html: `<span>${label}</span>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });
        L.marker(active.startPoint, { icon: markerIcon("A") }).addTo(map);
        L.marker(active.endPoint, { icon: markerIcon("B") }).addTo(map);
        map.fitBounds(L.latLngBounds([...active.coordinates, active.startPoint, active.endPoint]), {
          padding: [44, 44],
          maxZoom: 17,
        });
        if (!disposed) setStatus(tileFailed ? "tile-error" : "ready");
      } catch {
        if (disposed) return;
        tiles?.off("tileerror", tileError);
        map?.remove();
        map = undefined;
        mapRef.current = undefined;
        if (!disposed) setStatus("initialization-error");
      }
    }
    void mountMap();
    return () => {
      disposed = true;
      tiles?.off("tileerror", tileError);
      map?.remove();
      mapRef.current = undefined;
    };
  }, [routes, selected, attempt, showSegments, segmentEvidence]);
  // Status messages change the space available to Leaflet; keep controls within it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeRoute) return;
    const resize = () => {
      map.invalidateSize({ pan: false, animate: false });
      map.fitBounds(activeRoute.coordinates, { padding: [44, 44], maxZoom: 17, animate: false });
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize);
    if (containerRef.current) observer?.observe(containerRef.current);
    return () => observer?.disconnect();
  }, [status, showSegments, segmentEvidence, activeRoute]);
  const failed = status === "initialization-error" || status === "tile-error";
  return (
    <div className="flex min-h-[360px] w-full flex-col">
      {!activeRoute ? (
        <p className="p-4 text-sm">The map will appear when a route is available.</p>
      ) : (
        status !== "ready" && (
          <div className="shrink-0 border-b border-border bg-card p-3 text-sm leading-5">
            <p role="status">
              {status === "loading"
                ? "Loading route map…"
                : status === "tile-error"
                  ? `Some OpenStreetMap basemap tiles could not load. The basemap may be incomplete or unavailable; ${mock ? "the illustrative route preview remains a mock example" : "returned route information remains usable"}.`
                  : "The map could not be initialized. Route information and navigation remain available outside the map."}
            </p>
            {failed && (
              <>
                <p className="mt-1">
                  Basemap source: © OpenStreetMap contributors. No replacement route has been
                  generated.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={attempt >= 2}
                  onClick={() => setAttempt((value) => Math.min(2, value + 1))}
                >
                  Retry map
                </Button>
                <span className="ml-2">
                  {attempt >= 2
                    ? "Map retry limit reached for this view."
                    : `${2 - attempt} manual map retries remaining.`}
                </span>
              </>
            )}
          </div>
        )
      )}
      {segmentEvidence && (
        <div className="shrink-0 border-b border-border bg-card p-3 text-xs">
          <Button
            variant="outline"
            size="sm"
            aria-pressed={showSegments}
            onClick={() => setShowSegments((value) => !value)}
          >
            {showSegments ? "Hide segment evidence" : "Show segment evidence"}
          </Button>
          {showSegments && (
            <>
              <p className="mt-2 font-semibold">Business and healthcare proximity within 100 m</p>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {(Object.keys(segmentColors) as Array<keyof typeof segmentColors>).map((key) => (
                  <li key={key} className="flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-3 rounded"
                      style={{ backgroundColor: segmentColors[key] }}
                    />
                    {segmentLabels[key]}
                  </li>
                ))}
              </ul>
              <p className="mt-1">
                Historical mapped evidence, not safety. Read each stretch and missing-tag
                percentages in the evidence panel.
              </p>
            </>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="h-[360px] min-h-[300px] w-full"
        aria-label={
          mock
            ? "Illustrative Ranchi mock route map; not verified walking routes"
            : "Route map with start and destination markers"
        }
      />
    </div>
  );
}
