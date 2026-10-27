import { useId } from "react";
import { SegmentEvidencePanel } from "./SegmentEvidencePanel";
import type { EvidenceState } from "@/hooks/useRouteEvidence";

export function RouteEvidencePanel({
  state,
  name,
  headingLevel = 2,
  compact = false,
}: {
  state: EvidenceState | undefined;
  name: string;
  headingLevel?: 2 | 3;
  compact?: boolean;
}) {
  const heading = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const evidence = state?.status === "complete" ? state.evidence : null;
  const context = evidence?.status === "available" ? evidence.route_context : null;
  return (
    <section
      aria-labelledby={heading}
      className="evidence-panel mt-2 rounded-2xl border border-border bg-background p-4 text-sm leading-6"
    >
      <Heading id={heading} className="font-bold text-foreground">
        Mapped geographic evidence · {name}
      </Heading>
      <p role="status" aria-live="polite" className="mt-2 text-muted-foreground">
        <EvidenceStatus state={state} name={name} />
      </p>
      <p className="mt-3 text-muted-foreground">
        Historical mapped data, not live observations. No personal-safety assessment or safety
        ranking is provided. Missing data is unknown, not unsafe.
      </p>
      {context && (
        <p className="mt-2">
          Mapped records and tag availability are available for this route's 100 m buffer;
          conditions on the walked street remain unverified.
        </p>
      )}
      {context?.segment_evidence && <SegmentEvidencePanel evidence={context.segment_evidence} />}
      {context && (
        <details open={compact ? undefined : true} className="mt-3">
          <summary className="cursor-pointer rounded-lg py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Geographic metrics and methodology for {name}
          </summary>
          <dl className="evidence-metrics mt-3 grid grid-cols-2 gap-3">
            {(
              [
                ["Nearby businesses", context.categories.shops_and_businesses.count],
                ["Healthcare facilities", context.categories.healthcare_facilities.count],
                ["Police facilities", context.categories.police_stations.count],
                ["Pedestrian infrastructure", context.categories.pedestrian_infrastructure.count],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{value} mapped records</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3">
            Lighting tags: {context.lighting.usable_tag_availability.numerator}/
            {context.lighting.usable_tag_availability.denominator} nearby road records have usable
            tags. Yes: {context.lighting.states.yes.object_availability.numerator}; no:{" "}
            {context.lighting.states.no.object_availability.numerator}; other recorded:{" "}
            {context.lighting.states.other_recorded.object_availability.numerator}; unknown:{" "}
            {context.lighting.states.unknown.object_availability.numerator}.
          </p>
          <p className="mt-2">
            Sidewalk tags: {context.sidewalk.usable_tag_availability.numerator}/
            {context.sidewalk.usable_tag_availability.denominator} nearby road records have usable
            tags. Availability does not establish sidewalk presence or continuity.
          </p>
          <p>
            Unknown sidewalk tags:{" "}
            {context.sidewalk.usable_tag_availability.denominator -
              context.sidewalk.usable_tag_availability.numerator}{" "}
            nearby road records.
            {context.sidewalk.usable_tag_availability.denominator === 0 &&
              " No nearby road records; tag completeness is unknown."}
          </p>
          <p className="mt-2">
            Opening-hours tags: {context.opening_hours.nonblank.numerator}/
            {context.opening_hours.nonblank.denominator} business records. Current operation and
            pedestrian activity are unknown.
          </p>
          <p className="mt-2 text-muted-foreground">
            Zero records does not establish absence. Missing tags are unknown, not evidence of an
            unsafe route. Counts are OSM objects; uncertain duplicate establishments remain
            separate. Categories may overlap.
          </p>
        </details>
      )}
      {evidence && (
        <p className="mt-3 break-words text-muted-foreground">
          Source snapshot: {evidence.source_provenance.source_snapshot_timestamp}.{" "}
          {evidence.source_provenance.attribution}, {evidence.source_provenance.license}. Mapping
          completeness is unknown.
        </p>
      )}
    </section>
  );
}

export function EvidenceStatus({
  state,
  name,
}: {
  state: EvidenceState | undefined;
  name: string;
}) {
  const evidence = state?.status === "complete" ? state.evidence : null;
  return (
    <>
      {name}:{" "}
      {!state || state.status === "queued"
        ? "Waiting for analysis. Routes are processed one at a time."
        : state.status === "loading"
          ? "Analysis requested… This may include service waiting and bounded retries. The route remains usable."
          : state.status === "error"
            ? state.message
            : evidence?.status === "coverage_unavailable"
              ? "Coverage unavailable: the entire route and its 100 m buffer must fit inside the Ranchi pilot. No facility counts are reported."
              : "Mapped evidence available · 100 m buffer"}
    </>
  );
}
