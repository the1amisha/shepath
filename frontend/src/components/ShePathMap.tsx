import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RouteData } from "@/lib/routing";

export function ShePathMap({
  routes,
  selected,
  mock = false,
}: {
  routes: RouteData[];
  selected: string;
  mock?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "initialization-error" | "tile-error">(
    "loading",
  );
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
  }, [routes, selected, attempt]);
  // Status messages change the space available to Leaflet; keep controls within it.
  useEffect(() => {
    mapRef.current?.invalidateSize({ pan: false, animate: false });
  }, [status]);
  const failed = status === "initialization-error" || status === "tile-error";
  return (
    <div className="flex h-full min-h-[360px] w-full flex-col">
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
      <div
        ref={containerRef}
        className="min-h-0 w-full flex-1"
        aria-label={
          mock
            ? "Illustrative Ranchi mock route map; not verified walking routes"
            : "Route map with start and destination markers"
        }
      />
    </div>
  );
}
