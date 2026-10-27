import type { SegmentEvidence } from "@/lib/routing/segmentEvidence";
import { segmentColors, segmentLabels } from "@/lib/routing/segmentEvidence";

export function SegmentEvidencePanel({ evidence }: { evidence: SegmentEvidence }) {
  return (
    <section aria-label="Evidence along this route" className="my-4 rounded-xl bg-muted/40 p-3">
      <h3 className="font-bold">Where along the route?</h3>
      <p className="mt-2">
        Longest stretch with no mapped business or healthcare record within 100 m:{" "}
        <strong>{Math.round(evidence.longest_facility_gap.length_metres)} m</strong>.
      </p>
      <p className="mt-2">
        Route length without nearby usable lighting tags:{" "}
        <strong>{evidence.lighting_unknown_percent.toFixed(1)}%</strong>. Without nearby usable
        footpath (sidewalk) tags: <strong>{evidence.sidewalk_unknown_percent.toFixed(1)}%</strong>.
      </p>
      <p className="mt-2 text-muted-foreground">
        These measure proximity to historical OSM records, not the conditions on the street you
        walk. A recorded “no” is known tag evidence. Missing records remain unknown.
      </p>
      <div className="mt-3 flex h-4 overflow-hidden rounded" aria-hidden="true">
        {evidence.segments.map((segment) => (
          <span
            key={segment.index}
            style={{
              flex: segment.length_metres,
              backgroundColor: segmentColors[segment.facility_coverage],
            }}
          />
        ))}
      </div>
      <p className="mt-1 text-xs">Start → destination · approximately 150 m per stretch</p>
      <ul className="mt-2 space-y-1 text-xs">
        {(Object.keys(segmentColors) as Array<keyof typeof segmentColors>).map((key) => (
          <li key={key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-3 shrink-0 rounded"
              style={{ backgroundColor: segmentColors[key] }}
            />
            {segmentLabels[key]}
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer py-2 font-semibold">
          Read evidence for each stretch
        </summary>
        <p className="mb-2">
          Counts are mapped objects within 100 m of each stretch. The same object may appear in
          several stretches; do not add these counts together. Color describes business/healthcare
          proximity only.
        </p>
        <ol className="space-y-3">
          {evidence.segments.map((segment) => (
            <li key={segment.index} className="rounded-lg border border-border bg-background p-3">
              <p className="font-semibold">
                Stretch {segment.index}: {Math.round(segment.start_metres)}–
                {Math.round(segment.end_metres)} m
              </p>
              <p>
                {segmentLabels[segment.facility_coverage]} (
                {segment.facility_coverage_percent.toFixed(0)}%).
              </p>
              <p>
                {segment.business_count} business records · {segment.healthcare_count} healthcare
                records
              </p>
              <p>
                Missing nearby lighting tag evidence: {segment.lighting_unknown_percent.toFixed(0)}
                %; footpath tag evidence: {segment.sidewalk_unknown_percent.toFixed(0)}%.
              </p>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
