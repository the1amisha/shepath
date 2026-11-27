import type { LatLng } from "@/lib/routing/types";
import type { FacilityMarker } from "@/lib/routing/facilityMarkers";
export function PrintableRoute({
  points,
  markers,
}: {
  points: LatLng[];
  markers: FacilityMarker[];
}) {
  const locations = [...points, ...markers.map((m) => m.position)];
  const latitude = points[0]![0];
  const cosine = Math.cos((latitude * Math.PI) / 180);
  const projected = locations.map(([lat, lon]) => [lon * cosine, -lat] as const);
  const xs = projected.map((p) => p[0]),
    ys = projected.map((p) => p[1]);
  const left = Math.min(...xs),
    top = Math.min(...ys);
  const width = Math.max(...xs) - left,
    height = Math.max(...ys) - top;
  const scale = Math.min(590 / Math.max(width, 1e-9), 330 / Math.max(height, 1e-9));
  const xy = projected.map(([x, y]) => [
    (640 - width * scale) / 2 + (x - left) * scale,
    (380 - height * scale) / 2 + (y - top) * scale,
  ]);
  const line = xy.slice(0, points.length);
  function pin(p: number[], label: string) {
    return (
      <g key={label}>
        <circle cx={p[0]} cy={p[1]} r="11" fill="#164452" />
        <text x={p[0]} y={p[1]} dy="4" textAnchor="middle" fill="white" fontSize="12">
          {label}
        </text>
      </g>
    );
  }
  return (
    <figure>
      <svg viewBox="0 0 640 380" width="100%" aria-label="Selected route, north up">
        <rect width="640" height="380" fill="#f1f6f5" />
        <text x="12" y="20">
          ↑ N
        </text>
        <polyline
          points={line.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="#087fbd"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {markers.map((_, i) => pin(xy[points.length + i]!, String(i + 1)))}
        {pin(line[0]!, "A")}
        {pin(line[line.length - 1]!, "B")}
      </svg>
      <figcaption>
        A · Start　 B · Destination
        {markers.map((m, i) => (
          <div key={m.id}>
            {i + 1} · {m.name}
          </div>
        ))}
        <small>Route outline · © OpenStreetMap contributors</small>
      </figcaption>
    </figure>
  );
}
