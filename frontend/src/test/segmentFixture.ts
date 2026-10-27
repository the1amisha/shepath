import type { SegmentEvidence } from "@/lib/routing/segmentEvidence";

export function segmentFixture(): SegmentEvidence {
  return {
    schema_version: "SHEPATH.segment_evidence.v1",
    target_length_metres: 150,
    route_length_metres: 300,
    buffer_metres: 100,
    method: "ordered_projected_route_proximity_not_matched_street",
    longest_facility_gap: { start_metres: 150, end_metres: 300, length_metres: 150 },
    lighting_unknown_percent: 50,
    sidewalk_unknown_percent: 100,
    segments: [0, 1].map((i) => ({
      index: i + 1,
      start_metres: i * 150,
      end_metres: (i + 1) * 150,
      length_metres: 150,
      coordinates: [
        [23.355 + i * 0.001, 85.32],
        [23.356 + i * 0.001, 85.32],
      ],
      facility_coverage: i === 0 ? "continuous" : "none",
      facility_coverage_percent: i === 0 ? 100 : 0,
      business_count: i === 0 ? 2 : 0,
      healthcare_count: 0,
      lighting_unknown_percent: i * 100,
      sidewalk_unknown_percent: 100,
    })),
  };
}
