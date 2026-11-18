import { z } from "zod";
import type { LatLng, RouteData } from "./types";

const point = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const line = z.array(point).min(2).max(20000);
const geometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: point }),
  z.object({ type: z.literal("LineString"), coordinates: line }),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(line).min(1).max(1000) }),
  z.object({ type: z.literal("MultiLineString"), coordinates: z.array(line).max(1000) }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(line).min(1).max(1000)).max(1000),
  }),
]);
const feature = z.object({
  id: z.string().regex(/^(node|way|relation)\/\d+$/),
  geometry,
  properties: z.object({
    categories: z.array(z.string()),
    tags: z.object({
      name: z.string().optional(),
      amenity: z.string().optional(),
      opening_hours: z.string().optional(),
    }),
  }),
});
export const facilityStyles = {
  business: { label: "Shops & businesses", color: "#986321", symbol: "S" },
  pharmacy: { label: "Pharmacy", color: "#9b3e83", symbol: "Rx" },
  healthcare: { label: "Healthcare", color: "#257963", symbol: "+" },
  police: { label: "Police", color: "#465f9a", symbol: "P" },
};
export type FacilityMarker = {
  id: string;
  name: string;
  kind: keyof typeof facilityStyles;
  position: LatLng;
  outline: boolean;
  openingHours: string | null;
};

/** Compact display points from verified response features. Never synthesize locations.
 * For lines/areas use the nearest recorded outline vertex, not an invented entrance.
 */
export function extractFacilityMarkers(
  raw: unknown,
  route: RouteData,
): FacilityMarker[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const markers: FacilityMarker[] = [];
  const seen = new Set<string>();
  const anchor = route.coordinates[0];
  if (!anchor) return [];
  const scale = Math.cos((anchor[0] * Math.PI) / 180);
  const distance = ([lon, lat]: [number, number]) => {
    let best = Infinity;
    for (let i = 1; i < route.coordinates.length; i++) {
      const a = route.coordinates[i - 1]!,
        b = route.coordinates[i]!;
      const dx = (b[1] - a[1]) * scale,
        dy = b[0] - a[0];
      const px = (lon - a[1]) * scale,
        py = lat - a[0];
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, (px - t * dx) ** 2 + (py - t * dy) ** 2);
    }
    return best;
  };
  for (const input of raw) {
    const parsed = feature.safeParse(input);
    if (!parsed.success) continue;
    const f = parsed.data;
    if (seen.has(f.id)) continue;
    const categories = f.properties.categories,
      tags = f.properties.tags;
    const kind = categories.includes("healthcare_facilities")
      ? tags.amenity === "pharmacy"
        ? "pharmacy"
        : "healthcare"
      : categories.includes("police_stations")
        ? "police"
        : categories.includes("shops_and_businesses")
          ? "business"
          : null;
    if (!kind) continue;
    const g = f.geometry;
    const vertices =
      g.type === "Point"
        ? [g.coordinates]
        : g.type === "LineString"
          ? g.coordinates
          : g.type === "Polygon"
            ? g.coordinates[0]!
            : g.type === "MultiPolygon"
              ? g.coordinates.flatMap((polygon) => polygon[0]!)
              : g.coordinates.flat();
    let nearest: [number, number] | undefined;
    let bestDistance = Infinity;
    for (const p of vertices) {
      const candidateDistance = distance(p);
      if (!nearest || candidateDistance < bestDistance) {
        nearest = p;
        bestDistance = candidateDistance;
      }
    }
    if (!nearest) continue;
    seen.add(f.id);
    markers.push({
      id: f.id,
      name: tags.name?.trim() || facilityStyles[kind].label,
      kind,
      position: [nearest[1], nearest[0]],
      outline: g.type !== "Point",
      openingHours: tags.opening_hours?.trim() || null,
    });
  }
  return markers;
}
