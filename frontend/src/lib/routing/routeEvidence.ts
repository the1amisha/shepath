import { z } from "zod";
import { apiBaseUrl } from "./apiBaseUrl";
import type { RouteData } from "./types";

const count = z.number().finite().int().nonnegative();
const ratio = z.object({ numerator: count, denominator: count, percent: z.number().finite().nullable() });
const tag = z.object({ usable_tag_availability: ratio });
const category = z.object({ count });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
// Zod strips audit geometries, IDs and other unneeded nested fields after JSON parsing.
const schema = z.object({
  schema_version: z.literal("SHEPATH.dynamic_route_evidence.v1"),
  status: z.enum(["available", "coverage_unavailable"]),
  route: z.object({ id: z.string(), geometry_sha256: hash, coordinates: z.array(z.tuple([z.number(), z.number()])) }),
  evidence_identity_sha256: hash,
  analysis: z.object({ buffer_metres: z.literal(100) }),
  coverage: z.object({ full_buffer_covered: z.boolean(), reason: z.string().nullable() }),
  evidence_completeness: z.object({ status: z.string() }),
  uncertainty_flags: z.array(z.string()),
  source_provenance: z.object({ source_snapshot_timestamp: z.string(), manifest_sha256: hash,
    source_pbf_sha256: hash, attribution: z.string(), license: z.string() }),
  route_context: z.object({
    categories: z.object({ shops_and_businesses: category, healthcare_facilities: category,
      police_stations: category, pedestrian_infrastructure: category }),
    lighting: tag.extend({ states: z.object({ yes: z.object({ object_availability: ratio }),
      no: z.object({ object_availability: ratio }), unknown: z.object({ object_availability: ratio }),
      other_recorded: z.object({ object_availability: ratio }) }) }),
    sidewalk: tag,
    opening_hours: z.object({ nonblank: ratio }),
  }).nullable(),
});
type Parsed = z.infer<typeof schema>;
export type RouteEvidence = Omit<Parsed, "route"> & { route: Omit<Parsed["route"], "coordinates"> };
export type EvidenceErrorCode = "busy" | "dataset" | "timeout" | "invalid" | "network" | "response" | "service";
export class EvidenceError extends Error {
  constructor(public code: EvidenceErrorCode, message: string, public retryMs = 5000) { super(message); }
}

function aborted(signal: AbortSignal) { signal.throwIfAborted(); }
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    aborted(signal);
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

async function requestEvidence(route: RouteData, signal: AbortSignal): Promise<RouteEvidence> {
  if (route.coordinates.length < 2) throw new EvidenceError("invalid", "This route has insufficient geometry for evidence analysis.");
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("Evidence deadline")), 75000);
  try {
    aborted(signal);
    const response = await fetch(`${apiBaseUrl()}/pilot/ranchi/route-evidence`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ route_id: route.id, coordinates: route.coordinates,
        distance_metres: route.distanceMeters, duration_seconds: route.durationSeconds }),
    });
    const body: unknown = await response.json().catch(() => null);
    aborted(signal);
    if (controller.signal.aborted) throw new EvidenceError("timeout", "Evidence analysis timed out. Your route is still usable.");
    if (!response.ok) {
      const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
      const code = detail && typeof detail === "object" && "code" in detail ? detail.code : null;
      if (response.status === 503 && code === "analysis_busy") {
        const seconds = Number(response.headers.get("Retry-After") || 5);
        throw new EvidenceError("busy", "Evidence service is busy. Try this journey again later.",
          Number.isFinite(seconds) ? Math.min(15000, Math.max(5000, seconds * 1000)) : 5000);
      }
      if (response.status === 503 && code === "dataset_unavailable") throw new EvidenceError("dataset", "The verified Ranchi dataset is unavailable.");
      if (response.status === 504) throw new EvidenceError("timeout", "Evidence analysis timed out. Your route is still usable.");
      if (response.status === 422) throw new EvidenceError("invalid", "The evidence service could not analyze this route geometry.");
      throw new EvidenceError("service", `Evidence unavailable (HTTP ${response.status}). Your route is still usable.`);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new EvidenceError("response", "The evidence response could not be verified.");
    const value = parsed.data;
    if (value.route.id !== route.id || JSON.stringify(value.route.coordinates) !== JSON.stringify(route.coordinates)
      || (value.status === "available" && (!value.route_context || !value.coverage.full_buffer_covered))
      || (value.status === "coverage_unavailable" && value.route_context !== null)) {
      throw new EvidenceError("response", "Evidence does not match this route geometry or coverage state.");
    }
    const { coordinates: _coordinates, ...identity } = value.route;
    return { ...value, route: identity };
  } catch (cause) {
    aborted(signal);
    if (cause instanceof EvidenceError) throw cause;
    if (controller.signal.aborted) throw new EvidenceError("timeout", "Evidence analysis timed out. Your route is still usable.");
    throw new EvidenceError("network", "Cannot reach the evidence service. Check the backend connection and CORS configuration. Your route is still usable.");
  } finally { clearTimeout(timer); signal.removeEventListener("abort", cancel); }
}

// One queue across component lifetimes, including busy retries. Aborted queued jobs do no I/O.
let queue: Promise<unknown> = Promise.resolve();
export function fetchRouteEvidence(route: RouteData, signal: AbortSignal): Promise<RouteEvidence> {
  const job = queue.then(async () => {
    for (let attempt = 0; ; attempt++) {
      aborted(signal);
      try { return await requestEvidence(route, signal); }
      catch (cause) {
        if (!(cause instanceof EvidenceError) || cause.code !== "busy" || attempt >= 2) throw cause;
        await delay(cause.retryMs, signal);
      }
    }
  });
  queue = job.catch(() => undefined);
  return job;
}
