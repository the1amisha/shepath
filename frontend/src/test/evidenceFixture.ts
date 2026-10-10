import type { RouteData } from "@/lib/routing/types";
export const evidenceRoute: RouteData = { id: "new-route", coordinates: [[23.355, 85.32], [23.36, 85.32]],
  distanceMeters: 553, durationSeconds: 400, startPoint: [23.355, 85.32], endPoint: [23.36, 85.32] };
export function evidenceFixture(route = evidenceRoute) {
  const ratio = (n: number, d = 10) => ({ numerator: n, denominator: d, percent: d ? 100 * n / d : null });
  return {
    schema_version: "SHEPATH.dynamic_route_evidence.v1", status: "available",
    route: { id: route.id, coordinates: route.coordinates, geometry_sha256: "a".repeat(64) },
    evidence_identity_sha256: "b".repeat(64), analysis: { buffer_metres: 100 },
    coverage: { full_buffer_covered: true, reason: null }, evidence_completeness: { status: "mapped_snapshot_analyzed" },
    uncertainty_flags: ["OSM_real_world_completeness_unknown"],
    source_provenance: { source_snapshot_timestamp: "2026-10-08T20:21:06Z", manifest_sha256: "c".repeat(64),
      source_pbf_sha256: "d".repeat(64), attribution: "© OpenStreetMap contributors", license: "ODbL 1.0" },
    route_context: { categories: { shops_and_businesses: { count: 7 }, healthcare_facilities: { count: 2 },
      police_stations: { count: 0 }, pedestrian_infrastructure: { count: 4 } },
      lighting: { usable_tag_availability: ratio(3), states: { yes: { object_availability: ratio(1) },
        no: { object_availability: ratio(1) }, other_recorded: { object_availability: ratio(1) }, unknown: { object_availability: ratio(7) } } },
      sidewalk: { usable_tag_availability: ratio(2) }, opening_hours: { nonblank: ratio(1, 7) },
      source_features: [{ geometry: { type: "LineString", coordinates: [[85.32, 23.35]] } }],
    },
  };
}
