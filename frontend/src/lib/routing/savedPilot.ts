import { z } from "zod";

// OpenAPI fixes the envelope; nested artifact dictionaries are extensible.
// Only fields consumed by the UI are narrowed, while other evidence is retained.
const dictionary = z.record(z.unknown());
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const number = z.number().finite();
const metric = z
  .object({
    availability: z.string().nullish(),
    value: number.nullish(),
    scenario_low: number.nullish(),
    scenario_high: number.nullish(),
  })
  .passthrough();
const ratio = z
  .object({ numerator: number.nullish(), denominator: number.nullish(), percent: number.nullish() })
  .passthrough();
const tag = z
  .object({
    availability_indicator: z.string().nullish(),
    usable_tag_availability: ratio.nullish(),
    actual_walked_street_coverage: number.nullish(),
  })
  .passthrough();
const profile = z.object({
  priorities: z.array(z.string()),
  method: z.string(),
  preference_fronts: z.array(z.array(z.string())),
  first_front_candidates: z.array(z.string()),
  within_front_order: z.string(),
  interpretation: z.string(),
  pairwise: z.array(
    z
      .object({
        first: z.string(),
        second: z.string(),
        preferred: z.string().nullable(),
        status: z.string(),
        explanation: z.string(),
        trace: z.array(dictionary),
      })
      .passthrough(),
  ),
});
export const savedPilotSchema = z.object({
  status: z.literal("available"),
  journey: z.object({
    id: z.string().min(1),
    origin: z.literal("Albert Ekka Chowk, Ranchi"),
    destination: z.literal("Doranda, Ranchi"),
    travelMode: z.literal("walk"),
    routeIds: z.array(z.string()).length(3),
    retrievedAtUtc: z.string(),
    savedRoutesSha256: hash,
    geometrySha256ByRoute: z.record(hash),
    geometryHashConvention: z.string().min(1),
  }),
  applicability: z.object({
    scope: z.literal("fixed_saved_journey_only"),
    appliesToNewRoutes: z.literal(false),
    routeIdsAreSnapshotLocal: z.literal(true),
    actualWalkedStreetAttribution: z.literal("unverified"),
    liveObservations: z.literal(false),
    personalSafetyRecommendation: z.literal(false),
    message: z.string(),
  }),
  integrity: z.object({
    status: z.literal("verified"),
    comparisonRun: z.string(),
    comparisonSha256: hash,
    featureDatasetSha256: hash,
    verification: z.string(),
  }),
  comparison: z.object({
    schema_version: z.literal("SHEPATH.phase5b.v1"),
    interpretation: z.string(),
    source_feature_manifest: dictionary,
    source_provenance: dictionary,
    comparison_code_sha256: z.record(z.string()),
    versions: z.record(z.string()),
    normalization: dictionary,
    dimension_comparisons: dictionary,
    profiles: z.record(profile),
    routes: z
      .array(
        z.object({
          route_id: z.string(),
          geodesic_distance_metres: number.positive(),
          backend_distance_metres: number.positive(),
          distance_denominator_km: number.positive(),
          criteria: z.record(metric.nullable()),
          context: z.record(
            z
              .object({
                raw_count: number.nullish(),
                records_per_km: number.nullish(),
                data_availability: z.string().nullish(),
              })
              .passthrough()
              .nullable(),
          ),
          availability: z
            .object({
              evidence_indicators: dictionary.nullish(),
              lighting: tag.nullish(),
              sidewalk: tag.nullish(),
              opening_hours: z
                .object({ nonblank: ratio.nullish(), currently_open: z.unknown() })
                .passthrough()
                .nullish(),
            })
            .passthrough(),
          correlation_audit: dictionary,
        }),
      )
      .length(3),
  }),
});
export type SavedPilot = z.infer<typeof savedPilotSchema>;

export function parseSavedPilot(body: unknown): SavedPilot {
  const parsed = savedPilotSchema.safeParse(body);
  if (!parsed.success)
    throw new Error(
      "Saved comparison is incomplete or has an unsupported schema. No comparison has been applied to live routes.",
    );
  const data = parsed.data;
  const ids = new Set(data.journey.routeIds);
  const routes = data.comparison.routes.map((route) => route.route_id);
  const geometryIds = Object.keys(data.journey.geometrySha256ByRoute);
  const provenance = data.comparison.source_provenance;
  const artifacts = data.comparison.source_feature_manifest["artifacts"];
  if (
    ids.size !== 3 ||
    new Set(routes).size !== 3 ||
    routes.some((id) => !ids.has(id)) ||
    geometryIds.length !== 3 ||
    geometryIds.some((id) => !ids.has(id)) ||
    provenance["saved_routes_sha256"] !== data.journey.savedRoutesSha256 ||
    provenance["route_retrieved_at_utc"] !== data.journey.retrievedAtUtc ||
    !artifacts ||
    typeof artifacts !== "object" ||
    !("route_features.json" in artifacts) ||
    artifacts["route_features.json"] !== data.integrity.featureDatasetSha256 ||
    Object.values(data.comparison.profiles).some((p) => {
      const fronts = p.preference_fronts.flat();
      return (
        fronts.length !== 3 ||
        new Set(fronts).size !== 3 ||
        fronts.some((id) => !ids.has(id)) ||
        p.first_front_candidates.length !== p.preference_fronts[0]?.length ||
        p.first_front_candidates.some((id) => !p.preference_fronts[0]?.includes(id)) ||
        p.pairwise.some(
          (pair) =>
            !ids.has(pair.first) ||
            !ids.has(pair.second) ||
            (pair.preferred !== null &&
              pair.preferred !== pair.first &&
              pair.preferred !== pair.second),
        )
      );
    })
  )
    throw new Error(
      "Saved snapshot identity mismatch. The saved artifacts cannot be shown as a consistent comparison; no live routes were changed.",
    );
  return data;
}

// Deliberately returns a separate domain type, never RouteData. The endpoint has
// fingerprints but no geometry, and POST /route has no saved-snapshot identity.
// IDs/place names cannot verify either snapshot or ordered geometry identity.
export async function fetchSavedPilot(signal?: AbortSignal): Promise<SavedPilot> {
  const baseUrl = import.meta.env["VITE_API_BASE_URL"]?.trim();
  if (!baseUrl) throw new Error("Set VITE_API_BASE_URL to load the saved pilot comparison.");
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, "")}/pilot/ranchi/comparison`, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(
      "Unable to reach the saved comparison API. Check the connection and try again.",
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const messages: Record<number, string> = {
      409: "Saved snapshot identity mismatch",
      422: "Saved comparison request is invalid",
      503: "Saved comparison artifacts are missing, corrupt or unavailable",
      404: "Saved comparison endpoint or artifacts are missing",
    };
    const detail = z.object({ detail: z.object({ message: z.string() }) }).safeParse(body);
    throw new Error(
      `${messages[response.status] ?? "Saved comparison request failed"} (HTTP ${response.status}).${detail.success ? ` ${detail.data.detail.message}` : " Please try again."}`,
    );
  }
  return parseSavedPilot(body);
}
