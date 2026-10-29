import { useState } from "react";
import type { SegmentEvidence } from "@/lib/routing/segmentEvidence";

export function FixMapPanel({ evidence }: { evidence: SegmentEvidence }) {
  return <FixMapList key={JSON.stringify(evidence)} evidence={evidence} />;
}
function FixMapList({ evidence }: { evidence: SegmentEvidence }) {
  const [limit, setLimit] = useState(10);
  const stretches = evidence.segments.filter(
    (s) => s.lighting_unknown_percent > 0 || s.sidewalk_unknown_percent > 0,
  );
  const percent = (n: number) => (n > 0 && n < 0.1 ? "less than 0.1%" : `${n.toFixed(1)}%`);
  return (
    <details className="mt-4 border-t border-border pt-3">
      <summary className="cursor-pointer rounded py-2 font-semibold focus-visible:ring-2 focus-visible:ring-ring">
        Fix the map · {stretches.length} stretches to review
      </summary>
      <div className="space-y-3 mt-2">
        <p>
          Review missing nearby lighting or footpath tag evidence in OpenStreetMap. These are gaps
          in a historical snapshot, not confirmed missing street features. Nearby tags may belong to
          another street.
        </p>
        <p className="text-xs text-muted-foreground">
          Each link opens an area around a point on the stretch, not a matched road object or the
          complete route. Check the current map and the correct street before editing. Add only
          observations you can verify; do not infer “no” from missing data. Opening the editor makes
          no changes. OSM may ask you to sign in.
        </p>
        <p className="text-xs text-muted-foreground">
          OSM edits do not update this app’s pinned snapshot automatically. A refreshed dataset is
          needed before changes appear here.
        </p>
        {stretches.length === 0 ? (
          <p>
            No stretches have missing nearby tag evidence in this snapshot. This does not establish
            complete or accurate mapping of the walked street.
          </p>
        ) : (
          <>
            <p role="status" className="text-xs">
              Showing {Math.min(limit, stretches.length)} of {stretches.length} stretches, in route
              order.
            </p>
            <ol className="space-y-3">
              {stretches.slice(0, limit).map((s) => {
                // A recorded vertex stays on the supplied stretch; it is not a road match.
                const point = s.coordinates[Math.floor((s.coordinates.length - 1) / 2)]!;
                const position = `18/${point[0].toFixed(6)}/${point[1].toFixed(6)}`;
                return (
                  <li key={s.index} className="rounded-lg border border-border bg-background p-3">
                    <p className="font-semibold">
                      Stretch {s.index}: {Math.round(s.start_metres)}–{Math.round(s.end_metres)} m
                    </p>
                    <p className="text-xs">
                      Missing nearby lighting tag evidence: {percent(s.lighting_unknown_percent)};
                      footpath tag evidence: {percent(s.sidewalk_unknown_percent)}.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      <a
                        className="underline rounded focus-visible:ring-2 focus-visible:ring-ring"
                        href={`https://www.openstreetmap.org/#map=${position}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View stretch ${s.index} on OSM`}
                      >
                        View on OSM
                      </a>
                      <a
                        className="underline rounded focus-visible:ring-2 focus-visible:ring-ring"
                        href={`https://www.openstreetmap.org/edit?editor=id#map=${position}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open OSM editor for stretch ${s.index}`}
                      >
                        Open OSM editor
                      </a>
                    </div>
                  </li>
                );
              })}
            </ol>
            {limit < stretches.length && (
              <button
                type="button"
                className="rounded-xl border border-border px-4 py-2 font-semibold focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setLimit((n) => n + 10)}
              >
                Show more stretches
              </button>
            )}
          </>
        )}
      </div>
    </details>
  );
}
