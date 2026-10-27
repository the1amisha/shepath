import { z } from "zod";

const distance = z.number().finite().nonnegative();
const percent = z.number().finite().min(0).max(100);
export const segmentEvidenceSchema = z
  .object({
    schema_version: z.literal("SHEPATH.segment_evidence.v1"),
    target_length_metres: z.literal(150),
    route_length_metres: z.number().finite().positive(),
    buffer_metres: z.literal(100),
    method: z.literal("ordered_projected_route_proximity_not_matched_street"),
    longest_facility_gap: z.object({
      start_metres: distance,
      end_metres: distance,
      length_metres: distance,
    }),
    lighting_unknown_percent: percent,
    sidewalk_unknown_percent: percent,
    segments: z
      .array(
        z.object({
          index: z.number().int().positive(),
          start_metres: distance,
          end_metres: distance,
          length_metres: z.number().finite().positive(),
          coordinates: z
            .array(
              z.tuple([
                z.number().finite().min(-90).max(90),
                z.number().finite().min(-180).max(180),
              ]),
            )
            .min(2),
          facility_coverage: z.enum(["none", "partial", "continuous"]),
          facility_coverage_percent: percent,
          business_count: z.number().int().nonnegative(),
          healthcare_count: z.number().int().nonnegative(),
          lighting_unknown_percent: percent,
          sidewalk_unknown_percent: percent,
        }),
      )
      .min(1)
      .max(2000),
  })
  .superRefine((value, ctx) => {
    const close = (a: number, b: number) => Math.abs(a - b) < 0.01;
    let cursor = 0;
    for (const [index, segment] of value.segments.entries()) {
      if (
        segment.index !== index + 1 ||
        !close(segment.start_metres, cursor) ||
        !close(segment.end_metres - segment.start_metres, segment.length_metres)
      ) {
        ctx.addIssue({ code: "custom", message: "Invalid ordered segment distances" });
      }
      cursor = segment.end_metres;
    }
    const gap = value.longest_facility_gap;
    if (
      !close(cursor, value.route_length_metres) ||
      gap.end_metres > cursor + 0.01 ||
      !close(gap.end_metres - gap.start_metres, gap.length_metres)
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid route or gap length" });
    }
  });

export type SegmentEvidence = z.infer<typeof segmentEvidenceSchema>;
export const segmentColors = { none: "#64748b", partial: "#9063b0", continuous: "#087fbd" };
export const segmentLabels = {
  none: "No nearby facility coverage",
  partial: "Partial nearby facility coverage",
  continuous: "Continuous nearby facility coverage",
};
