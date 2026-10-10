import { useEffect, useRef } from "react";
import type { RouteData } from "@/lib/routing";

export function ShePathMap({ routes, selected, mock = false }: { routes: RouteData[]; selected: string; mock?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = routes.find(route => route.id === selected);
    if (!active) return;
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    async function mountMap() {
      const L = await import("leaflet");
      if (disposed || !containerRef.current || !active) return;
      map = L.map(containerRef.current, { zoomControl: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      const colors = ["#72558d", "#d78368", "#5d8b77"];
      const draw = (route: RouteData) => L.polyline(route.coordinates, {
        color: colors[routes.indexOf(route) % colors.length],
        opacity: route.id === selected ? 1 : 0.32,
        weight: route.id === selected ? 7 : 4,
        lineCap: "round", lineJoin: "round",
      }).addTo(map!);
      routes.filter(route => route.id !== selected).forEach(draw);
      draw(active);
      const markerIcon = (label: string) => L.divIcon({ className: "shepath-marker", html: `<span>${label}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
      L.marker(active.startPoint, { icon: markerIcon("A") }).addTo(map);
      L.marker(active.endPoint, { icon: markerIcon("B") }).addTo(map);
      map.fitBounds(L.latLngBounds([...active.coordinates, active.startPoint, active.endPoint]), { padding: [44, 44], maxZoom: 17 });
    }
    void mountMap();
    return () => { disposed = true; map?.remove(); };
  }, [routes, selected]);
  return <div ref={containerRef} className="h-full min-h-[360px] w-full" aria-label={mock ? "Illustrative Ranchi mock route map; not verified walking routes" : "Route map with start and destination markers"} />;
}
