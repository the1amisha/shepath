import { SharedPlan } from "@/components/SharedPlan";
import {
  preferenceIsSeparated,
  recommendationSummary,
  timeFallbackSummary,
} from "@/lib/routing/recommendationSummary";
import { ModelLab } from "@/components/ModelLab";
import {
  hybridRecommendation,
  hybridOrder,
  learnedPriorities,
} from "@/lib/routing/hybridRecommendation";
import { PriorityControls, SuitabilityScore } from "@/components/HybridScoring";
import { PlaceField as LocationField } from "@/components/PlaceField";
import { LocationPicker } from "@/components/LocationPicker";
import { TripPlanPanel } from "@/components/TripPlanPanel";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { routingService, routingProvider, type RouteData, type LatLng } from "@/lib/routing";
import { ArrowLeft, ArrowRight, ChevronRight, Clock3, Navigation, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultsMapPanel } from "@/components/ResultsMapPanel";
import { ShePathMap } from "@/components/ShePathMap";
import { SavedRanchiPilot } from "@/components/SavedRanchiPilot";
import { EvidenceStatus, RouteEvidencePanel } from "@/components/RouteEvidencePanel";
import { useRouteEvidence } from "@/hooks/useRouteEvidence";
import { useJourneyFocus, focusContent } from "@/hooks/useJourneyFocus";
import { RouteSummaryPanel } from "@/components/RouteSummaryPanel";
import { DepartureControl, DepartureTimePanel } from "@/components/DepartureTimePanel";
import { istInputValue } from "@/lib/routing/departureTime";
import { RouteComparisonTable } from "@/components/RouteComparisonTable";
import { LiveRecommendationPanel } from "@/components/LiveRecommendationPanel";
import {
  recommendRoutes,
  routeExplanation,
  type Observations,
} from "@/lib/routing/liveRecommendation";
import { EvidencePreferences } from "@/components/EvidencePreferences";
import {
  criteria,
  criterionLabels,
  emptyWeights,
  normalizedWeights,
  evidenceMatch,
  sensitivity,
  type Weights,
} from "@/lib/routing/evidenceMatch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SHEPATH — Compare routes" },
      {
        name: "description",
        content:
          "Compare walking and driving routes and explore historical mapped geographic evidence in the bounded Ranchi pilot. No personal-safety assessment.",
      },
      { property: "og:title", content: "SHEPATH — Compare routes" },
      {
        property: "og:description",
        content:
          "Compare walking and driving routes and explore historical mapped geographic evidence in the bounded Ranchi pilot. No personal-safety assessment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JourneyEntry,
});

type Screen = "welcome" | "search" | "preferences" | "results" | "details";
type RouteKey = string;
const isMock = routingProvider === "mock";

type RouteOptionData = {
  id: RouteKey;
  name: string;
  subtitle: string;
  time: string;
  distanceKm: string;
  fastest: boolean;
  tied: boolean;
  color: string;
};

function toRouteOptions(routes: RouteData[], driving = false): RouteOptionData[] {
  const shortestTime = Math.min(...routes.map((route) => route.durationSeconds));
  const tied = routes.filter((route) => route.durationSeconds === shortestTime).length > 1;
  return routes.map((route, index) => ({
    id: route.id,
    name: `${isMock ? "Demo route" : "Route"} ${index + 1}`,
    subtitle: isMock
      ? "Illustrative walking estimate"
      : driving
        ? "Estimated driving time"
        : "Estimated travel time",
    time:
      route.durationSeconds < 60
        ? "Less than 1 min"
        : `${Math.round(route.durationSeconds / 60)} min`,
    distanceKm: `${(route.distanceMeters / 1000).toFixed(1)} km`,
    fastest: route.durationSeconds === shortestTime,
    tied,
    color: ["bg-primary", "bg-warning", "bg-success"][index % 3]!,
  }));
}

const steps: Screen[] = ["welcome", "search", "preferences", "results", "details"];

function Brand() {
  return (
    <div className="flex items-center gap-2.5" aria-label="SHEPATH by She Builds">
      <div className="grid size-9 place-items-center rounded-full bg-foreground text-white">
        <Navigation className="size-5 -rotate-12" strokeWidth={2.6} />
      </div>
      <div className="leading-none">
        <div className="font-display text-2xl font-black tracking-tight">shepath</div>
      </div>
    </div>
  );
}

function JourneyEntry() {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return hash.startsWith("#plan=") ? <SharedPlan hash={hash}/> : <ShePathApp/>;
}

export function ShePathApp() {
  const [travelMode, setTravelMode] = useState<"walk" | "drive">("walk");
  const driving = travelMode === "drive";
  const [showSavedPilot, setShowSavedPilot] = useState(false);
  const [screen, setScreen] = useState<Screen>("welcome");
  const { openSaved } = useJourneyFocus(screen, showSavedPilot, () => {
    interruptRouteRequest();
    setShowSavedPilot(true);
  });
  const manuallySelected = useRef(false);
  const [selected, setSelected] = useState<RouteKey>("");
  const [summaryComparison, setSummaryComparison] = useState("");
  const [departure, setDeparture] = useState("");
  useEffect(() => {
    setDeparture(istInputValue(new Date()));
  }, []);
  const [showModelLab, setShowModelLab] = useState(false);
  const [priorities, setPriorities] = useState({ ...learnedPriorities });
  const [mlEnabled, setMlEnabled] = useState(true);
  const [maxExtra, setMaxExtra] = useState(Infinity);
  const [observations, setObservations] = useState<Observations>({});
  const [weights, setWeights] = useState<Weights>({ ...emptyWeights });
  const [from, setFrom] = useState("Albert Ekka Chowk, Ranchi");
  const [to, setTo] = useState("Ranchi Railway Station, Ranchi");
  const [originPoint, setOriginPoint] = useState<LatLng | null>(null);
  const locationPicker = useRef<{ locate: () => void }>(null);
  const [destinationPoint, setDestinationPoint] = useState<LatLng | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [interrupted, setInterrupted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const requestGeneration = useRef(0);
  function interruptRouteRequest() {
    requestGeneration.current++;
    if (inFlight.current) setInterrupted(true);
    inFlight.current = false;
    setLoading(false);
  }
  const liveJourneyVisible = !showSavedPilot && ["results", "details"].includes(screen);
  useEffect(() => {
    if (!liveJourneyVisible) {
      interruptRouteRequest();
    }
  }, [from, to, travelMode, liveJourneyVisible]);
  useEffect(
    () => () => {
      requestGeneration.current++;
    },
    [],
  );
  const routeOptions = toRouteOptions(routes, driving);
  const evidence = useRouteEvidence(
    routes,
    travelMode,
    JSON.stringify([from, to, originPoint, destinationPoint, travelMode]),
    !isMock && liveJourneyVisible,
  );
  const match = evidenceMatch(routes, evidence, weights, isMock);
  const effectiveWeights = normalizedWeights(weights);
  const mappedBounds = recommendRoutes(routes, evidence, departure, observations, maxExtra, isMock);
  const ml = hybridRecommendation(mappedBounds, priorities);
  const preferenceSummary = recommendationSummary(routes, ml, evidence, priorities);
  const orderedOptions = mlEnabled
    ? hybridOrder(routes, ml).map((r) => routeOptions.find((option) => option.id === r.id)!)
    : match.active
      ? match.rows.map((row) => routeOptions.find((route) => route.id === row.id)!)
      : routeOptions;
  const automaticFirst = orderedOptions[0]?.id;
  useEffect(() => {
    if (mlEnabled && !isMock && automaticFirst && !manuallySelected.current)
      setSelected(automaticFirst);
  }, [mlEnabled, automaticFirst]);
  const chooseRoute = (id: string) => {
    manuallySelected.current = true;
    setSelected(id);
  };
  const sensitivityNote = sensitivity(match.rows, weights);
  const currentIndex = steps.indexOf(screen);
  const findRoutes = async () => {
    if (!from.trim() || !to.trim()) {
      setSearchSubmitted(true);
      setScreen("search");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    const generation = ++requestGeneration.current;
    setLoading(true);
    setInterrupted(false);
    setError(null);
    setRoutes([]);
    setObservations({});
    manuallySelected.current = false;
    setSelected("");
    setSummaryComparison("");
    setScreen("results");
    try {
      const data = await routingService.getRoutes({
        origin: from.trim(),
        ...(!isMock && originPoint ? { originPoint } : {}),
        ...(!isMock && destinationPoint ? { destinationPoint } : {}),
        destination: to.trim(),
        travelMode,
      });
      if (generation !== requestGeneration.current) return;
      if (!data.length) return;
      setRoutes(data);
      setSelected(data[0]!.id);
    } catch (cause) {
      if (generation === requestGeneration.current)
        setError(
          cause instanceof Error ? cause.message : "Unable to fetch routes. Please try again.",
        );
    } finally {
      if (generation === requestGeneration.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  };

  const goBack = () => {
    const previous = steps[Math.max(0, currentIndex - 1)];
    if (previous) setScreen(previous);
  };
  const selectedRoute = routeOptions.find((route) => route.id === selected);

  if (showModelLab) return <ModelLab onClose={() => setShowModelLab(false)} />;

  if (showSavedPilot) return <SavedRanchiPilot onBack={() => setShowSavedPilot(false)} />;

  if (screen === "welcome") {
    return (
      <main className="welcome-canvas">
        <SkipToContent />
        <section className="welcome-sheet">
          <div className="welcome-brand">
            <Brand />
          </div>
          <div className="welcome-illustration">
            <img
              src="/images/ranchi-walk-v2.webp"
              width="1131"
              height="1391"
              alt="Illustration of a woman walking along a leafy path"
            />
          </div>
          <div className="welcome-copy">
            <p className="welcome-eyebrow">Ranchi route planner</p>
            <h1 id="journey-heading" tabIndex={-1}>
              Find your way.
              <br />
              Feel more informed.
            </h1>
            <Button
              size="lg"
              className="welcome-action"
              aria-label="Plan my journey"
              onClick={() => setScreen("search")}
            >
              Plan my journey <ArrowRight className="size-4" />
            </Button>
            {isMock && (
              <p className="welcome-disclosure">Mock mode: fixed illustrative walking routes.</p>
            )}
            <button
              type="button"
              className="mt-4 block text-sm text-primary underline"
              onClick={() => setShowModelLab(true)}
            >
              Model lab
            </button>
            <p className="welcome-credit">Made for Ranchi. Built by She Builds.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="journey-app min-h-screen bg-background" data-screen={screen}>
      <SkipToContent />
      <header
        data-journey-header
        className="sticky top-0 z-[1000] border-b border-border/70 bg-background/92 backdrop-blur-xl"
      >
        <div className="mx-auto grid min-h-20 py-3 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:flex sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Button
              aria-label="Go back"
              title="Go back"
              variant="ghost"
              size="icon"
              onClick={goBack}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <Brand />
          </div>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {steps.slice(1).map((step, index) => (
              <span
                key={step}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index <= currentIndex - 1 ? "w-8 bg-primary" : "w-3 bg-border",
                )}
              />
            ))}
          </div>
          <div className="rounded-full bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground md:ml-6">
            Step {currentIndex} of {steps.length - 1}
            <span className="sr-only">
              :{" "}
              {
                {
                  search: "Plan journey",
                  preferences: "Evidence preferences",
                  results: "Compare routes",
                  details: "Route overview",
                  welcome: "Welcome",
                }[screen]
              }
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-8">
        <Button variant="ghost" size="sm" onClick={() => setShowModelLab(true)}>
          Model lab
        </Button>
      </div>

      {screen === "search" && (
        <section className="px-4 py-6 sm:py-10">
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setSearchSubmitted(true);
              if (!from.trim() || !to.trim()) return;
              setFrom(from.trim());
              setTo(to.trim());
              setSearchSubmitted(false);
              setScreen("preferences");
            }}
            className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-5 app-shadow sm:p-8"
          >
            <h1
              id="journey-heading"
              tabIndex={-1}
              className="mb-6 font-display text-2xl font-bold sm:text-3xl"
            >
              Where are you headed?
            </h1>
            {isMock && <p className="mb-4 text-sm">Mock mode uses fixed demo routes.</p>}
            <div className="relative space-y-4 before:absolute before:left-[1.35rem] before:top-12 before:h-16 before:border-l-2 before:border-dashed before:border-primary/40">
              <LocationField
                onSelect={
                  !isMock
                    ? (place) => {
                        setFrom(place.label);
                        setOriginPoint(place.point);
                      }
                    : undefined
                }
                label="Starting from"
                onCurrentLocation={!isMock ? () => locationPicker.current?.locate() : undefined}
                shortcuts
                value={from}
                onChange={(value) => {
                  setFrom(value);
                  setOriginPoint(null);
                }}
                dot="bg-primary"
                error={searchSubmitted && !from.trim() ? "Enter a starting place." : undefined}
              />
              <LocationField
                onSelect={
                  !isMock
                    ? (place) => {
                        setTo(place.label);
                        setDestinationPoint(place.point);
                      }
                    : undefined
                }
                label="Going to"
                shortcuts
                value={to}
                onChange={(value) => {
                  setTo(value);
                  setDestinationPoint(null);
                }}
                dot="bg-foreground"
                error={searchSubmitted && !to.trim() ? "Enter a destination." : undefined}
              />
            </div>
            {!isMock && (
              <LocationPicker
                ref={locationPicker}
                compact
                locationNames={JSON.stringify([from, to])}
                origin={originPoint}
                destination={destinationPoint}
                onPick={(target, point, label) => {
                  if (target === "origin") {
                    setOriginPoint(point);
                    setFrom(label);
                  } else {
                    setDestinationPoint(point);
                    setTo(label);
                  }
                }}
              />
            )}
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5">
              <label className="min-w-0 text-sm font-bold">
                Travel mode
                <select
                  aria-label="Travel mode"
                  value={travelMode}
                  className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  onChange={(event) => {
                    interruptRouteRequest();
                    setRoutes([]);
                    setSelected("");
                    setTravelMode(event.target.value === "drive" ? "drive" : "walk");
                  }}
                >
                  <option value="walk">Walking</option>
                  <option value="drive" disabled={isMock}>
                    Driving
                  </option>
                </select>
              </label>
              {!isMock && <DepartureControl compact value={departure} onChange={setDeparture} />}
            </div>
            <Button type="submit" className="mt-8 w-full" size="lg">
              Continue to preferences <ArrowRight className="size-4" />
            </Button>
          </form>
        </section>
      )}

      {screen === "preferences" && (
        <PageFrame
          eyebrow="Evidence preferences"
          title="Choose what matters to you"
          description="Use automatic comparison, or set your own priorities."
        >
          <div className="mx-auto max-w-3xl">
            {!isMock && (
              <div className="space-y-3 rounded-2xl border bg-card p-5">
                <label className="flex items-center gap-3 font-bold">
                  <input
                    type="radio"
                    name="comparison-mode"
                    checked={mlEnabled}
                    onChange={() => setMlEnabled(true)}
                  />
                  Automatic ML comparison
                </label>
                <p className="text-sm text-muted-foreground">
                  {driving
                    ? "Driving comparisons use weights learned from the walking survey. You can also set your own weights."
                    : "Uses preferences learned from the survey."}
                </p>
                <label className="flex items-center gap-3 font-bold">
                  <input
                    type="radio"
                    name="comparison-mode"
                    checked={!mlEnabled}
                    onChange={() => {
                      setMlEnabled(false);
                    }}
                  />
                  Set my own weights
                </label>
              </div>
            )}
            {(!mlEnabled || isMock) && (
              <EvidencePreferences weights={weights} onChange={setWeights} />
            )}
          </div>
          <div className="mx-auto mt-8 max-w-3xl">
            <Button
              className="w-full"
              size="lg"
              onClick={findRoutes}
              disabled={loading || !from.trim() || !to.trim()}
            >
              Continue to routes <Sparkles className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => {
                setWeights({ ...emptyWeights });
                setMlEnabled(true);
                void findRoutes();
              }}
              disabled={loading}
            >
              Skip preferences
            </Button>
          </div>
        </PageFrame>
      )}

      {screen === "results" && (
        <div className="route-workspace mx-auto max-w-[1500px] px-4 py-6 sm:px-8">
          <div className="route-search-bar mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                {loading
                  ? "Finding routes..."
                  : `${routes.length} ${isMock ? "illustrative mock" : "available"} route${routes.length === 1 ? "" : "s"}`}
              </p>
              <h1
                id="journey-heading"
                tabIndex={-1}
                className="mt-1 break-words font-display text-2xl font-black sm:text-3xl"
              >
                {from} <span className="text-muted-foreground">to</span> {to}
              </h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => setScreen("search")}>
              Edit
            </Button>
          </div>
          <div className="route-layout grid items-start rounded-3xl bg-card app-shadow lg:grid-cols-[390px_minmax(0,1fr)]">
            <aside className="route-options-sheet min-w-0 p-5 lg:p-6">
              <div className="sheet-handle" aria-hidden="true" />
              <h2 className="mb-4 font-display text-2xl font-black">
                {driving ? "Compare driving routes" : "Compare walking routes"}
              </h2>
              <p className="text-sm text-muted-foreground">Tap a route to view it on the map.</p>
              {isMock && (
                <p className="mt-2 text-xs">Illustrative mock routes · not real directions</p>
              )}
              {!isMock && routes.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground" role="status">
                  Evidence checked:{" "}
                  {
                    routes.filter(
                      (r) =>
                        evidence[r.id]?.status === "complete" || evidence[r.id]?.status === "error",
                    ).length
                  }
                  /{routes.length}
                </p>
              )}
              {!loading && !error && !routes.length && (
                <section
                  aria-label="Route recovery"
                  className="mt-4 rounded-2xl border border-border p-4"
                >
                  <p role="status">
                    {interrupted
                      ? "Route request interrupted when you left the journey. No routes from that request will be used."
                      : "No routes are available for this journey. Check the locations or retry."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={findRoutes}>Retry route</Button>
                    <Button variant="outline" onClick={() => setScreen("search")}>
                      Edit journey
                    </Button>
                  </div>
                </section>
              )}
              <div className="mt-4">
                <details hidden={mlEnabled}>
                  <summary className="cursor-pointer font-bold mb-3">
                    Adjust evidence preferences
                  </summary>
                  <EvidencePreferences weights={weights} onChange={setWeights} />
                </details>
                {!mlEnabled && (
                  <p role="status" className="mt-3 text-sm">
                    {match.message}
                  </p>
                )}
                {!mlEnabled && sensitivityNote && (
                  <p className="mt-3 text-xs leading-5">
                    Sensitivity example:{" "}
                    {routeOptions.find((r) => r.id === sensitivityNote.id)?.name} would rank first
                    with {criterionLabels[sensitivityNote.criterion].toLowerCase()} at{" "}
                    {sensitivityNote.percent}% of total weight, keeping the other weights in their
                    current ratio.
                  </p>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {loading && <p role="status">Finding your routes...</p>}
                {error && (
                  <div role="alert" className="rounded-2xl border border-border p-4">
                    <p>{error}</p>
                    <Button className="mt-3" variant="outline" onClick={findRoutes}>
                      Try again
                    </Button>
                    <Button
                      className="mt-3 ml-2"
                      variant="ghost"
                      onClick={() => setScreen("search")}
                    >
                      Edit locations
                    </Button>
                    <Button className="mt-3" variant="outline" onClick={openSaved}>
                      Open saved comparison
                    </Button>
                    <p className="mt-2 text-xs">
                      Historical journey · needs backend access; no live routing request.
                    </p>
                  </div>
                )}
                {orderedOptions.map((route, index) => {
                  const row = ml.rows.find((row) => row.id === route.id);
                  return (
                    <div key={route.id} data-route-card={route.id}>
                      <RouteOption
                        route={route}
                        rank={index + 1}
                        preference={
                          !isMock && mlEnabled
                            ? row?.eligible === false
                              ? "Outside your time limit"
                              : ml.recommendedId === route.id
                                ? ml.rows.filter((row) => row.eligible).length === 1
                                  ? "Within time limit"
                                  : preferenceIsSeparated(ml)
                                    ? "Recommended"
                                    : "Top calculated fit"
                                : row?.score !== undefined
                                  ? "Alternative preference match"
                                  : undefined
                            : undefined
                        }
                        explanation={
                          isMock
                            ? "Illustrative demo route"
                            : mlEnabled
                              ? row?.score !== undefined
                                ? preferenceSummary?.route.id === route.id
                                  ? preferenceSummary.reason
                                  : row.reason.replace(
                                      " inputs contribute most.",
                                      " is the strongest preference factor.",
                                    )
                                : !evidence[route.id] ||
                                    evidence[route.id]?.status === "loading" ||
                                    evidence[route.id]?.status === "queued"
                                  ? "Comparing available route information…"
                                  : timeFallbackSummary(
                                      routes.find((item) => item.id === route.id)!,
                                      routes,
                                      ml,
                                    )
                              : match.active
                                ? "Ordered by your evidence preferences"
                                : "Original route order"
                        }
                        provisional={
                          !isMock &&
                          mlEnabled &&
                          (row?.coverage ?? 100) < 99.999 &&
                          row?.score !== undefined
                        }
                        selected={selected === route.id}
                        onSelect={() => chooseRoute(route.id)}
                      />
                      {!isMock && (
                        <details className="px-3 py-2 text-xs leading-5">
                          <summary className="cursor-pointer font-bold">Why this route?</summary>
                          {mlEnabled && (
                            <p className="mt-2">
                              Experimental preference model · not a safety rating
                            </p>
                          )}
                          {mlEnabled && (
                            <SuitabilityScore row={ml.rows.find((r) => r.id === route.id)} />
                          )}
                          {route.id !== selected && (
                            <EvidenceStatus name={route.name} state={evidence[route.id]} />
                          )}
                          <p className="mt-2">
                            {routeExplanation(
                              routes.find((r) => r.id === route.id)!,
                              routes,
                              { rows: ml.rows, message: ml.message },
                            )}
                          </p>
                        </details>
                      )}
                      {!mlEnabled &&
                        match.active &&
                        (() => {
                          const row = match.rows.find((r) => r.id === route.id)!;
                          return (
                            <details className="px-3 py-2 text-xs leading-5">
                              <summary className="cursor-pointer font-bold">
                                Evidence match {row.score.toFixed(1)} / 100 · Why this order?
                              </summary>
                              <p>
                                This is a weighted evidence index, not a probability or safety
                                score.
                              </p>
                              {criteria.map((key) => (
                                <p key={key}>
                                  {criterionLabels[key]}: {row.values[key].toFixed(1)} ×{" "}
                                  {(effectiveWeights[key] * 100).toFixed(1)}% ={" "}
                                  {row.contributions[key].toFixed(1)} points.
                                </p>
                              ))}
                              <p>
                                Mapped businesses: {row.businessesPerKm.toFixed(2)} records/km.
                                Unknown nearby lighting tags:{" "}
                                {(100 - row.values.lighting).toFixed(1)}
                                %; unknown sidewalk tags:{" "}
                                {(100 - row.values.infrastructure).toFixed(1)}%.
                              </p>
                              <p>
                                Nearby tags may belong to other streets. A recorded “no” counts as
                                documented evidence. Zero mapped businesses does not establish
                                physical absence.
                              </p>
                            </details>
                          );
                        })()}
                    </div>
                  );
                })}
              </div>
            </aside>
            <ResultsMapPanel>
              <section
                id="route-comparison-map"
                tabIndex={-1}
                aria-label="Route comparison map"
                className="results-map-frame relative min-w-0 overflow-hidden bg-muted lg:rounded-tr-3xl"
              >
                <ShePathMap
                  routes={routes}
                  selected={selected}
                  mock={isMock}
                  evidenceState={evidence[selected]}
                />
              </section>
              {routeOptions.length > 0 && (
                <div
                  aria-label="Route colors"
                  className="flex flex-wrap gap-3 border-t border-border bg-card px-4 py-3 text-sm font-semibold"
                >
                  {orderedOptions.map((route) => (
                    <span key={route.id} className="flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-full", route.color)} />
                      {route.name}
                    </span>
                  ))}
                </div>
              )}
              <section
                aria-label="Selected route actions"
                className="results-actions flex flex-wrap items-center justify-between gap-3 rounded-b-3xl border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-bold">
                    {selectedRoute
                      ? `Selected: ${selectedRoute.name}`
                      : "Select a route to continue"}
                  </p>
                  {selectedRoute && (
                    <p>
                      {selectedRoute.time} · {selectedRoute.distanceKm}
                      {isMock && " · illustrative"}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedRoute && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const card = Array.from(
                          document.querySelectorAll<HTMLElement>("[data-route-card]"),
                        ).find((element) => element.dataset["routeCard"] === selected);
                        focusContent(card?.querySelector<HTMLElement>("button") ?? null);
                      }}
                    >
                      Locate selected route
                    </Button>
                  )}
                  <Button disabled={!selectedRoute || loading} onClick={() => setScreen("details")}>
                    View route overview <ChevronRight className="size-4" />
                  </Button>
                </div>
              </section>
            </ResultsMapPanel>
            {!isMock && routes.length > 0 && (
              <details className="rounded-2xl border bg-card p-4 lg:col-span-2">
                <summary className="cursor-pointer font-bold">
                  Comparison settings & model details
                </summary>
                <LiveRecommendationPanel
                  settingsOnly
                  priorities={priorities}
                  routes={routes}
                  result={ml}
                  states={evidence}
                  departure={departure}
                  enabled={mlEnabled}
                  onEnabled={setMlEnabled}
                  maxExtra={maxExtra}
                  onMaxExtra={setMaxExtra}
                  observations={observations}
                  onObservations={setObservations}
                  onSelect={(id) => {
                    chooseRoute(id);
                    focusContent(document.getElementById("route-comparison-map"));
                  }}
                  priorityControls={
                    mlEnabled && <PriorityControls value={priorities} onChange={setPriorities} />
                  }
                />
              </details>
            )}
            {routes.length > 0 && !isMock && (
              <details className="w-full rounded-2xl border bg-card p-4 lg:col-span-2">
                <summary className="cursor-pointer font-bold">Compare route details</summary>
                <RouteComparisonTable
                  routes={routes}
                  orderedIds={orderedOptions.map((r) => r.id)}
                  states={evidence}
                  selected={selected}
                  onSelect={chooseRoute}
                />
              </details>
            )}
            <details className="w-full rounded-2xl border bg-card p-4 lg:col-span-2">
              <summary className="cursor-pointer font-bold">Route summary & comparison</summary>
              <div className="mt-4">
                <RouteSummaryPanel
                  routes={routes}
                  selected={selected}
                  states={evidence}
                  comparisonId={summaryComparison}
                  onComparisonChange={setSummaryComparison}
                  mock={isMock}
                />
              </div>
            </details>
            {!isMock && selectedRoute && (
              <div className="selected-evidence w-full space-y-3 lg:col-span-2">
                <details className="rounded-2xl border bg-card p-4">
                  <summary className="cursor-pointer font-bold">Departure time & daylight</summary>
                  <div className="mt-4">
                    <DepartureTimePanel
                      route={routes.find((r) => r.id === selected)}
                      name={selectedRoute.name}
                      state={evidence[selected]}
                      departure={departure}
                      onChange={setDeparture}
                    />
                  </div>
                </details>
                <details className="rounded-2xl border bg-card p-4">
                  <summary className="cursor-pointer font-bold">Street evidence & sources</summary>
                  <RouteEvidencePanel
                    route={routes.find((r) => r.id === selected)}
                    key={selectedRoute.id}
                    name={selectedRoute.name}
                    state={evidence[selectedRoute.id]}
                  />
                </details>
              </div>
            )}
          </div>
        </div>
      )}

      {screen === "details" && selectedRoute && (
        <PageFrame
          eyebrow="Route overview"
          title={`${selectedRoute.name} overview`}
          description={`${isMock ? "Illustrative" : "Estimated"} ${selectedRoute.time} ${driving ? "drive" : "walk"} from ${from} to ${to}. ${isMock ? "Fixed demo geometry." : "No personal-safety assessment."}`}
        >
          <div className="mx-auto max-w-5xl space-y-5">
            {!isMock && (
              <TripPlanPanel
                routes={routes}
                selected={selected}
                states={evidence}
                from={from}
                to={to}
                departure={departure}
                reason={mlEnabled && preferenceSummary?.route.id === selected ? preferenceSummary.reason : undefined}
                mode={travelMode}
              />
            )}
            <div className="overflow-hidden rounded-3xl border border-border bg-card app-shadow">
              <div className="grid grid-cols-3 gap-3 p-5 text-center">
                <Stat label="Estimated time" value={selectedRoute.time} />
                <Stat label="Distance" value={selectedRoute.distanceKm} />
                <Stat label="Mode" value={driving ? "Driving" : "Walking"} />
              </div>
              <div className="min-h-[360px]" data-testid="overview-map-frame">
                <ShePathMap
                  routes={routes}
                  selected={selected}
                  mock={isMock}
                  evidenceState={evidence[selected]}
                />
              </div>
            </div>
            {isMock ? (
              <p className="text-sm text-muted-foreground">
                Fixed demo route; no geographic observations or personal-safety assessments.
              </p>
            ) : (
              <details className="rounded-2xl border bg-card p-4">
                <summary className="cursor-pointer font-bold">Departure time & daylight</summary>
                <div className="mt-4">
                  <DepartureTimePanel
                    route={routes.find((r) => r.id === selected)}
                    name={selectedRoute.name}
                    state={evidence[selected]}
                    departure={departure}
                    onChange={setDeparture}
                  />
                </div>
              </details>
            )}
            <details className="rounded-2xl border bg-card p-4">
              <summary className="cursor-pointer font-bold">Route summary & comparison</summary>
              <div className="mt-4">
                <RouteSummaryPanel
                  routes={routes}
                  selected={selected}
                  states={evidence}
                  comparisonId={summaryComparison}
                  onComparisonChange={setSummaryComparison}
                  mock={isMock}
                />
              </div>
            </details>
            {!isMock && (
              <details className="rounded-2xl border bg-card p-4">
                <summary className="cursor-pointer font-bold">Map data & sources</summary>
                <RouteEvidencePanel
                  route={routes.find((r) => r.id === selected)}
                  name={selectedRoute.name}
                  state={evidence[selectedRoute.id]}
                />
              </details>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={() => setScreen("results")}>
                Compare routes
              </Button>
              <Button variant="dark" onClick={() => setScreen("welcome")}>
                Plan another journey
              </Button>
            </div>
          </div>
        </PageFrame>
      )}
    </main>
  );
}

function PageFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="px-4 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto mb-9 max-w-3xl text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h1
          id="journey-heading"
          tabIndex={-1}
          className="mt-3 font-display text-3xl font-black sm:text-5xl"
        >
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

function RouteOption({
  route,
  selected,
  onSelect,
  rank,
  preference,
  explanation,
  provisional,
}: {
  rank: number;
  preference?: string | undefined;
  explanation: string;
  provisional: boolean;
  route: RouteOptionData;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div>
      <h2 className="sr-only">{route.name}</h2>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          "w-full rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? "border-primary bg-secondary/45 shadow-sm ring-2 ring-primary/10"
            : "border-border bg-card hover:border-primary/40",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("size-2.5 shrink-0 rounded-full", route.color)} />
          <span className="font-display text-base font-black">{route.name}</span>
          <span className="text-xs font-bold">{selected ? "Selected" : "Not selected"}</span>
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-primary">
          Comparison rank {rank}
        </p>
        {preference && <p className="mt-1 text-sm font-bold">{preference}</p>}
        <p className="mt-1 text-sm text-muted-foreground">{explanation}</p>
        {provisional && (
          <p className="mt-1 text-xs text-muted-foreground">Limited data · order may change</p>
        )}
        {route.fastest && (
          <span className="mt-2 inline-block rounded-full bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground">
            {isMock ? "Fastest demo estimate" : "Fastest estimate"}
            {route.tied ? " (tied)" : ""}
          </span>
        )}
        <p className="sr-only">{route.subtitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold">
          <span className="flex items-center gap-1 text-xl">
            <Clock3 className="size-3.5 text-muted-foreground" />
            {route.time}
          </span>
          <span>{route.distanceKm}</span>
        </div>
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-lg font-black sm:text-xl">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function SkipToContent() {
  return (
    <a
      href="#journey-heading"
      className="journey-skip"
      onClick={(event) => {
        event.preventDefault();
        focusContent(document.getElementById("journey-heading"));
      }}
    >
      Skip to content
    </a>
  );
}
