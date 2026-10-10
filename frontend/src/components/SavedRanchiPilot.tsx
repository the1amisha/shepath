import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchSavedPilot, type SavedPilot } from "@/lib/routing/savedPilot";

const label = (value: string) => value.replaceAll("_", " ");
const amount = (value: unknown, suffix = "") =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`
    : "Unknown";
const text = (value: unknown) => (typeof value === "string" && value ? value : "Unknown");
const criteria = [
  ["business_proximity_percent", "Shops and businesses"],
  ["healthcare_proximity_percent", "Healthcare"],
  ["police_proximity_percent", "Police stations"],
  ["pedestrian_proximity_percent", "Pedestrian infrastructure"],
] as const;

export function SavedRanchiPilot({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<SavedPilot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [profileKey, setProfileKey] = useState("distance_first");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    fetchSavedPilot(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Unable to load the saved comparison.");
      });
    return () => controller.abort();
  }, [attempt]);
  const profile = data?.comparison.profiles[profileKey];
  const routeName = (id: string) => `Saved route ${(data?.journey.routeIds.indexOf(id) ?? -1) + 1}`;
  const explain = (value: string) =>
    data
      ? data.journey.routeIds.reduce((copy, id) => copy.replaceAll(id, routeName(id)), value)
      : value;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-5 sm:px-8">
          <Button variant="ghost" size="icon" aria-label="Back to journey" onClick={onBack}>
            <ArrowLeft className="size-5" />
          </Button>
          <span className="font-display text-lg font-black">SHEPATH</span>
          <span className="ml-auto rounded-full bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground">
            Saved pilot
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
            Fixed walking journey
          </p>
          <h1 className="mt-2 font-display text-3xl font-black">Saved Ranchi Pilot Comparison</h1>
          <p className="mt-2 text-muted-foreground">
            Albert Ekka Chowk → Doranda, Ranchi · Walking
          </p>
        </div>
        <div className="space-y-2 rounded-2xl bg-secondary p-5 text-sm leading-6 text-secondary-foreground">
          <p>
            <b>Measured geographic context, not verified personal safety.</b> These saved
            observations are not live and are not personal-safety recommendations.
          </p>
          <p>
            Missing lighting or sidewalk tags mean unknown, not unsafe. Nearby mapped facilities do
            not establish access, operating status, pedestrian activity or conditions on the street
            you walk.
          </p>
          <p>
            Separate saved snapshot: snapshot and geometry identity cannot be verified against newly
            generated routes. Matching IDs or places is insufficient. The API supplies no saved
            coordinates, so this comparison is not attached to a live map.
          </p>
        </div>
        {!data && !error && <p role="status">Loading saved pilot comparison…</p>}
        {error && (
          <div role="alert" className="rounded-2xl border border-border bg-card p-5">
            <p>{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </Button>
          </div>
        )}
        {data && (
          <>
            <section
              aria-label="Source timestamps"
              className="rounded-2xl border border-border bg-card p-5 text-sm"
            >
              <h2 className="font-display text-lg font-black">Saved sources</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Routes retrieved (UTC)</dt>
                  <dd className="break-words">{text(data.journey.retrievedAtUtc)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">OSM snapshot (UTC)</dt>
                  <dd className="break-words">
                    {text(data.comparison.source_provenance["OSM_snapshot_timestamp"])}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Features created (UTC)</dt>
                  <dd className="break-words">
                    {text(data.comparison.source_feature_manifest["created_at_utc"])}
                  </dd>
                </div>
              </dl>
              <p className="mt-3">
                {text(data.comparison.source_provenance["attribution"])} ·{" "}
                {text(data.comparison.source_provenance["license"])}
              </p>
            </section>
            <section aria-label="Three saved routes" className="grid gap-4 lg:grid-cols-3">
              {data.comparison.routes.map((route) => (
                <article
                  key={route.route_id}
                  className="min-w-0 space-y-4 rounded-3xl border border-border bg-card p-5 app-shadow"
                >
                  <h2 className="font-display text-xl font-black text-primary">
                    {routeName(route.route_id)}
                  </h2>
                  <p className="break-all text-xs text-muted-foreground">{route.route_id}</p>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt>Measured geodesic distance</dt>
                      <dd className="mt-1 font-bold">
                        {amount(route.geodesic_distance_metres, " m")}
                      </dd>
                    </div>
                    <div>
                      <dt>Saved backend distance</dt>
                      <dd className="mt-1 font-bold">
                        {amount(route.backend_distance_metres, " m")}
                      </dd>
                    </div>
                  </dl>
                  <h3 className="font-bold">Mapped proximity observations</h3>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Share of projected route length within 100 m of mapped category geometry. Zero
                    means no matching mapped feature, not physical absence.
                  </p>
                  <dl className="space-y-3 text-sm">
                    {criteria.map(([key, title]) => {
                      const metric = route.criteria[key];
                      return (
                        <div key={key}>
                          <dt>{title}</dt>
                          <dd className="font-bold">{amount(metric?.value, "%")}</dd>
                          <dd className="text-xs text-muted-foreground">
                            {label(text(metric?.availability))} · Scenario range:{" "}
                            {amount(metric?.scenario_low, "%")} –{" "}
                            {amount(metric?.scenario_high, "%")}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    Scenario ranges cover flagged duplicate ambiguities; they are not confidence
                    intervals.
                  </p>
                  <h3 className="font-bold">Missing data and verification</h3>
                  <dl className="space-y-3 text-sm">
                    {(["lighting", "sidewalk"] as const).map((key) => (
                      <div key={key}>
                        <dt className="capitalize">{key} tag availability</dt>
                        <dd>{label(text(route.availability[key]?.availability_indicator))}</dd>
                        <dd className="text-xs text-muted-foreground">
                          Usable tags:{" "}
                          {amount(route.availability[key]?.usable_tag_availability?.numerator)} /{" "}
                          {amount(route.availability[key]?.usable_tag_availability?.denominator)}{" "}
                          nearby road objects (
                          {amount(route.availability[key]?.usable_tag_availability?.percent, "%")}).
                          Actual walked-street coverage:{" "}
                          {amount(route.availability[key]?.actual_walked_street_coverage, "%")}
                        </dd>
                      </div>
                    ))}
                    <div>
                      <dt>Business hours tags</dt>
                      <dd>
                        {amount(route.availability.opening_hours?.nonblank?.numerator)} /{" "}
                        {amount(route.availability.opening_hours?.nonblank?.denominator)} business
                        objects
                      </dd>
                      <dd>Currently open: Unknown — not observed</dd>
                    </div>
                  </dl>
                  <details className="text-sm">
                    <summary className="cursor-pointer font-bold">
                      Mapped records and evidence indicators
                    </summary>
                    <dl className="mt-3 space-y-2">
                      {Object.entries(route.context).map(([key, context]) => (
                        <div key={key}>
                          <dt className="capitalize">{label(key)}</dt>
                          <dd>
                            {amount(context?.raw_count)} OSM records ·{" "}
                            {amount(context?.records_per_km)} per km ·{" "}
                            {label(text(context?.data_availability))}
                          </dd>
                        </div>
                      ))}
                      {Object.entries(route.availability.evidence_indicators ?? {}).map(
                        ([key, value]) => (
                          <div key={key}>
                            <dt>{label(key)}</dt>
                            <dd>{label(text(value))}</dd>
                          </div>
                        ),
                      )}
                    </dl>
                    <p className="mt-3">
                      Counts describe mapped records, not verified facilities. Overlapping
                      categories must not be added together.
                    </p>
                  </details>
                </article>
              ))}
            </section>
            <section className="space-y-4 rounded-3xl border border-border bg-card p-5 app-shadow sm:p-8">
              <h2 className="font-display text-xl font-black">Preference-based comparisons</h2>
              <p className="text-sm text-muted-foreground">
                {data.comparison.interpretation} These saved profiles are independent of your live
                journey preferences.
              </p>
              <label className="block text-sm font-bold" htmlFor="saved-profile">
                Saved preference profile
              </label>
              <select
                id="saved-profile"
                className="w-full rounded-xl border border-border bg-background p-3 sm:max-w-md"
                value={profile ? profileKey : ""}
                onChange={(event) => setProfileKey(event.target.value)}
              >
                {!profile && <option value="">Choose an available saved profile</option>}
                {Object.keys(data.comparison.profiles).map((key) => (
                  <option key={key} value={key}>
                    {label(key)}
                  </option>
                ))}
              </select>
              {profile ? (
                <div className="space-y-3 text-sm">
                  <p>Priorities: {profile.priorities.map(label).join(" → ")}</p>
                  <p>Method: {label(profile.method)}</p>
                  <p>{profile.interpretation}</p>
                  <p>
                    <b>First preference group:</b>{" "}
                    {profile.first_front_candidates.map(routeName).join(", ") || "Unknown"}
                  </p>
                  <ol className="list-inside list-decimal space-y-2">
                    {profile.preference_fronts.map((front, index) => (
                      <li key={index}>Preference group: {front.map(routeName).join(", ")}</li>
                    ))}
                  </ol>
                  <p>{profile.within_front_order}</p>
                  <h3 className="font-bold">Why these comparisons?</h3>
                  <ul className="list-disc space-y-2 pl-5">
                    {profile.pairwise.map((pair, index) => (
                      <li key={index}>{explain(pair.explanation)}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p>Saved preference comparison: Unknown. No profile is selected or available.</p>
              )}
            </section>
            <details className="rounded-2xl border border-border bg-card p-5 text-sm">
              <summary className="cursor-pointer font-bold">
                Snapshot identity and methodology
              </summary>
              <div className="mt-4 space-y-3 break-words">
                <p>{data.applicability.message}</p>
                <p>
                  API-reported artifact integrity: {data.integrity.status}. This does not verify
                  personal safety.
                </p>
                <p>{data.integrity.verification}</p>
                <p>Journey: {data.journey.id}</p>
                <p>Saved routes SHA-256: {data.journey.savedRoutesSha256}</p>
                <p>Comparison SHA-256: {data.integrity.comparisonSha256}</p>
                <p>Comparison run: {data.integrity.comparisonRun}</p>
                <p>{data.journey.geometryHashConvention}</p>
                {Object.entries(data.journey.geometrySha256ByRoute).map(([id, hash]) => (
                  <p key={id}>
                    {routeName(id)} geometry SHA-256: {hash}
                  </p>
                ))}
                {Object.entries(data.comparison.normalization).map(([key, value]) => (
                  <p key={key}>
                    <b>{label(key)}:</b> {typeof value === "number" ? value : text(value)}
                  </p>
                ))}
              </div>
            </details>
          </>
        )}
      </div>
    </main>
  );
}
