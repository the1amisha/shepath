import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteData } from "@/lib/routing/types";

export function RouteComparisonTable({
  routes,
  orderedIds,
  states,
  selected,
  onSelect,
}: {
  routes: RouteData[];
  orderedIds: string[];
  states: Record<string, EvidenceState>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4" aria-label="Quick route comparison">
      <h2 className="font-display text-lg font-bold">At a glance</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Historical map records · unknown does not mean absent
      </p>
      <div
        className="mt-3 overflow-x-auto rounded-xl border"
        role="region"
        aria-label="Scrollable route comparison"
        tabIndex={0}
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Walking estimates and nearby mapped records for each route
          </caption>
          <thead className="bg-secondary text-xs">
            <tr>
              {["Route", "Walk", "Distance", "Businesses", "Lighting tags", "Footpath tags"].map(
                (label) => (
                  <th key={label} scope="col" className="whitespace-nowrap px-3 py-3">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {orderedIds.map((id) => {
              const route = routes.find((r) => r.id === id)!;
              const state = states[id];
              const e =
                state?.status === "complete" &&
                state.evidence.route.id === id &&
                state.evidence.status === "available" &&
                state.evidence.coverage.full_buffer_covered
                  ? state.evidence
                  : null;
              const c = e?.route_context;
              const unavailable =
                !state || state.status === "queued" || state.status === "loading"
                  ? "Loading…"
                  : "Unavailable";
              const tagged = (ratio: { numerator: number; denominator: number } | undefined) =>
                ratio && ratio.denominator > 0
                  ? `${ratio.numerator}/${ratio.denominator} recorded`
                  : "Unknown";
              return (
                <tr key={id} className={selected === id ? "border-t bg-secondary/40" : "border-t"}>
                  <th scope="row" className="px-3 py-3">
                    <button
                      type="button"
                      aria-pressed={selected === id}
                      onClick={() => onSelect(id)}
                      className="whitespace-nowrap rounded px-1 py-2 font-bold text-primary underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      View Route {routes.indexOf(route) + 1}
                    </button>
                  </th>
                  <td className="whitespace-nowrap px-3 py-3">
                    {route.durationSeconds < 60 ? "<1" : Math.round(route.durationSeconds / 60)} min
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {(route.distanceMeters / 1000).toFixed(1)} km
                  </td>
                  <td className="px-3 py-3">
                    {c ? `${c.categories.shops_and_businesses.count} mapped` : unavailable}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {c ? tagged(c.lighting.usable_tag_availability) : unavailable}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {c ? tagged(c.sidewalk.usable_tag_availability) : unavailable}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details className="mt-3 text-xs leading-5">
        <summary className="cursor-pointer font-semibold">What do these numbers mean?</summary>
        <p className="mt-2">
          Tag counts show documented nearby road records, including recorded “no” values. They do
          not prove working lights or usable footpaths. Business counts do not establish current
          opening. See Street evidence & sources for each route’s snapshot and coverage.
        </p>
      </details>
    </section>
  );
}
