import { useId } from "react";
import type { EvidenceState } from "@/hooks/useRouteEvidence";

export function RouteEvidencePanel({ state, name, headingLevel = 2 }: { state: EvidenceState | undefined; name: string; headingLevel?: 2 | 3 }) {
  const heading = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const evidence = state?.status === "complete" ? state.evidence : null;
  const context = evidence?.status === "available" ? evidence.route_context : null;
  return <section aria-labelledby={heading} className="mt-2 rounded-2xl border border-border bg-background p-4 text-xs leading-5">
    <Heading id={heading} className="font-bold text-foreground">Mapped geographic evidence · {name}</Heading>
    <p role="status" aria-live="polite" className="mt-2 text-muted-foreground">
      {!state || state.status === "queued" ? "Waiting for analysis…" : state.status === "loading" ? "Analyzing mapped context… The route remains usable." :
        state.status === "error" ? state.message : evidence?.status === "coverage_unavailable" ?
          "Coverage unavailable: the entire route and its 100 m buffer must fit inside the Ranchi pilot. No facility counts are reported." : "Mapped evidence available · 100 m buffer"}
    </p>
    {context && <>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        {([
          ["Nearby businesses", context.categories.shops_and_businesses.count],
          ["Healthcare facilities", context.categories.healthcare_facilities.count],
          ["Police facilities", context.categories.police_stations.count],
          ["Pedestrian infrastructure", context.categories.pedestrian_infrastructure.count],
        ] as const).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value} mapped records</dd></div>)}
      </dl>
      <p className="mt-3">Lighting tags: {context.lighting.usable_tag_availability.numerator}/{context.lighting.usable_tag_availability.denominator} nearby road records have usable tags.
        {" "}Yes: {context.lighting.states.yes.object_availability.numerator}; no: {context.lighting.states.no.object_availability.numerator}; other recorded: {context.lighting.states.other_recorded.object_availability.numerator}; unknown: {context.lighting.states.unknown.object_availability.numerator}.</p>
      <p className="mt-2">Sidewalk tags: {context.sidewalk.usable_tag_availability.numerator}/{context.sidewalk.usable_tag_availability.denominator} nearby road records have usable tags. Availability does not establish sidewalk presence or continuity.</p>
      <p>Unknown sidewalk tags: {context.sidewalk.usable_tag_availability.denominator - context.sidewalk.usable_tag_availability.numerator} nearby road records.{context.sidewalk.usable_tag_availability.denominator === 0 && " No nearby road records; tag completeness is unknown."}</p>
      <p className="mt-2">Opening-hours tags: {context.opening_hours.nonblank.numerator}/{context.opening_hours.nonblank.denominator} business records. Current operation and pedestrian activity are unknown.</p>
      <p className="mt-2 text-muted-foreground">Zero records does not establish absence. Missing tags are unknown, not evidence of an unsafe route. Counts are OSM objects; uncertain duplicate establishments remain separate. Categories may overlap.</p>
    </>}
    <p className="mt-3 text-muted-foreground">Nearby mapped facilities are not verified personal safety or attributes of the exact street being walked. No safety ranking is provided.</p>
    {evidence && <p className="mt-3 break-words text-muted-foreground">Source snapshot: {evidence.source_provenance.source_snapshot_timestamp}. {evidence.source_provenance.attribution}, {evidence.source_provenance.license}. Mapping completeness is unknown.</p>}
  </section>;
}
