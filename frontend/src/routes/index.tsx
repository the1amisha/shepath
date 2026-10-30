import { PlaceField as LocationField } from "@/components/PlaceField";
import { LocationPicker } from "@/components/LocationPicker";
import { TripPlanPanel } from "@/components/TripPlanPanel";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { routingService, routingProvider, type RouteData, type LatLng } from "@/lib/routing";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock3,
  MapPin,
  Navigation,
  Sparkles,
} from "lucide-react";
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
      { title: "SHEPATH — Compare walking routes" },
      {
        name: "description",
        content:
          "Compare walking routes and explore historical mapped geographic evidence in the bounded Ranchi pilot. No personal-safety assessment.",
      },
      { property: "og:title", content: "SHEPATH — Compare walking routes" },
      {
        property: "og:description",
        content:
          "Compare walking routes and explore historical mapped geographic evidence in the bounded Ranchi pilot. No personal-safety assessment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShePathApp,
});

type Screen = "welcome" | "search" | "preferences" | "results" | "details" | "report";
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

function toRouteOptions(routes: RouteData[]): RouteOptionData[] {
  const shortestTime = Math.min(...routes.map((route) => route.durationSeconds));
  const tied = routes.filter((route) => route.durationSeconds === shortestTime).length > 1;
  return routes.map((route, index) => ({
    id: route.id,
    name: `${isMock ? "Demo route" : "Route"} ${index + 1}`,
    subtitle: isMock ? "Illustrative walking estimate" : "Estimated walking time",
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

const steps: Screen[] = ["welcome", "search", "preferences", "results", "details", "report"];

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

export function ShePathApp() {
  const [showSavedPilot, setShowSavedPilot] = useState(false);
  const [screen, setScreen] = useState<Screen>("welcome");
  const { savedTrigger, openSaved } = useJourneyFocus(screen, showSavedPilot, () => {
    interruptRouteRequest();
    setShowSavedPilot(true);
  });
  const [selected, setSelected] = useState<RouteKey>("");
  const [summaryComparison, setSummaryComparison] = useState("");
  const [departure, setDeparture] = useState("");
  useEffect(() => {
    setDeparture(istInputValue(new Date()));
  }, []);
  const [weights, setWeights] = useState<Weights>({ ...emptyWeights });
  const [from, setFrom] = useState("Albert Ekka Chowk, Ranchi");
  const [to, setTo] = useState("Ranchi Railway Station, Ranchi");
  const [originPoint, setOriginPoint] = useState<LatLng | null>(null);
  const [shortcutTarget, setShortcutTarget] = useState<"origin" | "destination">("destination");
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
  const liveJourneyVisible = !showSavedPilot && ["results", "details", "report"].includes(screen);
  useEffect(() => {
    if (!liveJourneyVisible) {
      interruptRouteRequest();
    }
  }, [from, to, liveJourneyVisible]);
  useEffect(
    () => () => {
      requestGeneration.current++;
    },
    [],
  );
  const routeOptions = toRouteOptions(routes);
  const evidence = useRouteEvidence(
    routes,
    "walk",
    JSON.stringify([from, to, originPoint, destinationPoint]),
    !isMock && liveJourneyVisible,
  );
  const match = evidenceMatch(routes, evidence, weights, isMock);
  const effectiveWeights = normalizedWeights(weights);
  const orderedOptions = match.active
    ? match.rows.map((row) => routeOptions.find((route) => route.id === row.id)!)
    : routeOptions;
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
    setSelected("");
    setSummaryComparison("");
    setScreen("results");
    try {
      const data = await routingService.getRoutes({
        origin: from.trim(),
        ...(!isMock && originPoint ? { originPoint } : {}),
        ...(!isMock && destinationPoint ? { destinationPoint } : {}),
        destination: to.trim(),
        travelMode: "walk",
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
            <p className="welcome-eyebrow">Ranchi walking pilot</p>
            <h1 id="journey-heading" tabIndex={-1}>
              Find your way.
              <br />
              Feel more informed.
            </h1>
            <p className="welcome-description">
              A little local context
              <br className="lg:hidden" /> for every walk you take.
            </p>
            <Button
              size="lg"
              className="welcome-action"
              aria-label="Plan my walk"
              onClick={() => setScreen("search")}
            >
              Plan my walk <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              className="welcome-saved"
              ref={savedTrigger}
              onClick={openSaved}
            >
              Saved Ranchi Pilot Comparison
            </Button>
            <p className="welcome-disclosure">
              {isMock
                ? "Mock mode: fixed illustrative walking routes"
                : "Live walking routes with historical mapped context where covered"}
              . No personal-safety assessment is provided.
            </p>
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
            Step {currentIndex} of 5
            <span className="sr-only">
              :{" "}
              {
                {
                  search: "Plan journey",
                  preferences: "Evidence preferences",
                  results: "Compare routes",
                  details: "Route overview",
                  report: "Geographic evidence",
                  welcome: "Welcome",
                }[screen]
              }
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-8">
        <Button variant="outline" size="sm" ref={savedTrigger} onClick={openSaved}>
          Saved Ranchi Pilot Comparison
        </Button>
      </div>

      {screen === "search" && (
        <PageFrame
          eyebrow="Plan your journey"
          title="Where are you headed?"
          description={
            isMock
              ? "Add your start and destination. Mock mode uses fixed demo routes."
              : "Add your start and destination to compare walking routes."
          }
        >
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
            <p className="mb-5 text-sm leading-6 text-muted-foreground">
              Historical mapped evidence is limited to a bounded Ranchi pilot. The entire route and
              its 100 m buffer must fit inside it; a Ranchi place name does not guarantee coverage.
              Walking routes remain usable when evidence is unavailable.
            </p>
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
            <label className="mt-5 flex items-center gap-3 text-sm">
              Use shortcuts for
              <select
                aria-label="Use shortcuts for"
                className="rounded-full border border-border bg-background px-3 py-2"
                value={shortcutTarget}
                onChange={(event) =>
                  setShortcutTarget(event.target.value === "origin" ? "origin" : "destination")
                }
              >
                <option value="origin">Starting point</option>
                <option value="destination">Destination</option>
              </select>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {!isMock && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    // Campus listing pin supplied by the user; not a verified entrance.
                    if (shortcutTarget === "origin") {
                      setFrom("Sarala Birla University, Ara, Mahilong, Ranchi");
                      setOriginPoint([23.3473466, 85.4174703]);
                    } else {
                      setTo("Sarala Birla University, Ara, Mahilong, Ranchi");
                      setDestinationPoint([23.3473466, 85.4174703]);
                    }
                  }}
                >
                  <MapPin className="size-3.5" />
                  Sarala Birla University
                </Button>
              )}
              {["Lalpur, Ranchi", "Morabadi, Ranchi", "Doranda, Ranchi"].map((place) => (
                <Button
                  type="button"
                  key={place}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (shortcutTarget === "origin") {
                      setFrom(place);
                      setOriginPoint(null);
                    } else {
                      setTo(place);
                      setDestinationPoint(null);
                    }
                  }}
                >
                  <MapPin className="size-3.5" />
                  {place}
                </Button>
              ))}
            </div>
            {!isMock && (
              <div className="mt-6">
                <DepartureControl value={departure} onChange={setDeparture} />
              </div>
            )}
            <Button type="submit" className="mt-8 w-full" size="lg">
              Continue to preferences <ArrowRight className="size-4" />
            </Button>
          </form>
        </PageFrame>
      )}

      {screen === "preferences" && (
        <PageFrame
          eyebrow="Evidence preferences"
          title="Choose what matters to you"
          description="Set optional weights for the mapped evidence you want to compare. All weights start at zero; you can change them again beside the results."
        >
          <div className="mx-auto max-w-3xl">
            <EvidencePreferences weights={weights} onChange={setWeights} />
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
          <RouteSummaryPanel
            routes={routes}
            selected={selected}
            states={evidence}
            comparisonId={summaryComparison}
            onComparisonChange={setSummaryComparison}
            mock={isMock}
          />
          <div className="route-layout grid items-start rounded-3xl bg-card app-shadow lg:grid-cols-[390px_minmax(0,1fr)]">
            <aside className="route-options-sheet min-w-0 p-5 lg:p-6">
              <div className="sheet-handle" aria-hidden="true" />
              <h2 className="mb-4 font-display text-2xl font-black">Find your fit</h2>
              <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
                <p className="text-sm leading-5 text-secondary-foreground">
                  {isMock ? (
                    <>
                      <b>Mock route comparison.</b> Fixed Ranchi demo paths for any inputs; not
                      verified walking routes. All times and distances are illustrative.
                    </>
                  ) : (
                    <>
                      <b>Walking-route comparison.</b> Backend travel estimates with historical
                      mapped evidence where covered; no personal-safety assessment.
                    </>
                  )}
                </p>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                The first returned route is selected initially for viewing, not as a recommendation.
                Routes are not ranked by safety.
              </p>
              {!isMock && routes.length > 0 && (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Evidence is processed one route at a time.{" "}
                  {
                    routes.filter(
                      (route) =>
                        evidence[route.id]?.status === "complete" ||
                        evidence[route.id]?.status === "error",
                    ).length
                  }{" "}
                  of {routes.length} routes have finished an attempt. Waiting or retries can take
                  time; you can select a route and continue without evidence.
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
                <details>
                  <summary className="cursor-pointer font-bold mb-3">
                    Adjust evidence preferences
                  </summary>
                  <EvidencePreferences weights={weights} onChange={setWeights} />
                </details>
                <p role="status" className="mt-3 text-sm">
                  {match.message}
                </p>
                {sensitivityNote && (
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
                  </div>
                )}
                {orderedOptions.map((route) => (
                  <div key={route.id} data-route-card={route.id}>
                    <RouteOption
                      route={route}
                      selected={selected === route.id}
                      onSelect={() => setSelected(route.id)}
                    />
                    {match.active &&
                      (() => {
                        const row = match.rows.find((r) => r.id === route.id)!;
                        return (
                          <details className="px-3 py-2 text-xs leading-5">
                            <summary className="cursor-pointer font-bold">
                              Evidence match {row.score.toFixed(1)} / 100 · Why this order?
                            </summary>
                            <p>
                              This is a weighted evidence index, not a probability or safety score.
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
                              Unknown nearby lighting tags: {(100 - row.values.lighting).toFixed(1)}
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
                    {!isMock && route.id !== selected && (
                      <p
                        className="px-3 pt-2 text-xs leading-5 text-muted-foreground"
                        role="status"
                      >
                        <EvidenceStatus name={route.name} state={evidence[route.id]} />
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </aside>
            <ResultsMapPanel>
              <section
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
            {!isMock && selectedRoute && (
              <div className="selected-evidence w-full lg:col-span-2">
                <DepartureTimePanel
                  route={routes.find((r) => r.id === selected)}
                  name={selectedRoute.name}
                  state={evidence[selected]}
                  departure={departure}
                  onChange={setDeparture}
                />
                <RouteEvidencePanel
                  route={routes.find((r) => r.id === selected)}
                  key={selectedRoute.id}
                  name={selectedRoute.name}
                  state={evidence[selectedRoute.id]}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {screen === "details" && selectedRoute && (
        <PageFrame
          eyebrow="Route overview"
          title={`${selectedRoute.name} overview`}
          description={`${isMock ? "Illustrative" : "Estimated"} ${selectedRoute.time} walk from ${from} to ${to}. ${isMock ? "Fixed demo geometry." : "No personal-safety assessment."}`}
        >
          <div className="mx-auto max-w-5xl">
            <RouteSummaryPanel
              routes={routes}
              selected={selected}
              states={evidence}
              comparisonId={summaryComparison}
              onComparisonChange={setSummaryComparison}
              mock={isMock}
            />
          </div>
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="overflow-hidden rounded-3xl border border-border bg-card app-shadow">
              <div className="min-h-[360px]" data-testid="overview-map-frame">
                <ShePathMap
                  routes={routes}
                  selected={selected}
                  mock={isMock}
                  evidenceState={evidence[selected]}
                />
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
                  <Stat label="Estimated time" value={selectedRoute.time} />
                  <Stat label="Distance" value={selectedRoute.distanceKm} />
                  <Stat label="Mode" value="Walking" />
                </div>
              </div>
            </div>
            <div className="rounded-3xl bg-card p-6 app-shadow">
              <div className="overview-identity">
                <img src="/images/ranchi-walk-v2.webp" width="94" height="106" alt="" />
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Walking route</p>
                  <p className="font-display text-2xl font-black">{selectedRoute.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRoute.time} · {selectedRoute.distanceKm}
                  </p>
                </div>
              </div>
              <h2 className="font-display text-xl font-black">
                {isMock ? "Illustrative route" : "About this route"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {isMock
                  ? "Mock mode uses fixed demo geometry, times and distances for any inputs. These are not verified walking routes; no geographic observations or personal-safety assessments are supplied."
                  : "Travel estimates and geometry come from the backend. Historical mapped geographic context is shown below where covered. Actual lighting, activity and personal safety remain unverified."}
              </p>
            </div>
          </div>
          {!isMock && (
            <div className="mx-auto mt-6 max-w-4xl">
              <DepartureTimePanel
                route={routes.find((r) => r.id === selected)}
                name={selectedRoute.name}
                state={evidence[selected]}
                departure={departure}
                onChange={setDeparture}
              />
              <RouteEvidencePanel
                route={routes.find((r) => r.id === selected)}
                name={selectedRoute.name}
                state={evidence[selectedRoute.id]}
              />
            </div>
          )}
          {!isMock && (
            <div className="mx-auto max-w-4xl">
              <TripPlanPanel
                routes={routes}
                selected={selected}
                states={evidence}
                from={from}
                to={to}
                departure={departure}
              />
            </div>
          )}
          <div className="mx-auto mt-7 max-w-4xl">
            <Button className="w-full" onClick={() => setScreen("report")}>
              View geographic evidence <ArrowRight className="size-4" />
            </Button>
          </div>
        </PageFrame>
      )}

      {screen === "report" && selectedRoute && (
        <PageFrame
          eyebrow="Route context"
          title="Geographic evidence"
          description={
            isMock
              ? "This is an illustrative journey. No geographic evidence has been analyzed for this demo route."
              : `Historical mapped evidence for ${selectedRoute.name}, analyzed against its exact route geometry. This is not a personal-safety assessment.`
          }
        >
          <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-card app-shadow">
            {isMock ? (
              <div className="p-8">
                <h2 className="font-display text-xl font-black">
                  No evidence for illustrative routes
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Mock routes demonstrate the interface only. No lighting, activity, current-open
                  status or safety scores are calculated. The Saved Ranchi Pilot Comparison is a
                  separate historical snapshot and is not evidence for this demo route.
                </p>
              </div>
            ) : (
              <RouteEvidencePanel
                route={routes.find((r) => r.id === selected)}
                name={selectedRoute.name}
                state={evidence[selectedRoute.id]}
              />
            )}
          </div>
          <div className="mx-auto mt-6 flex max-w-4xl justify-center">
            <Button variant="dark" size="lg" onClick={() => setScreen("welcome")}>
              Plan another journey
            </Button>
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
}: {
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
        {route.fastest && (
          <span className="mt-2 inline-block rounded-full bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground">
            {isMock ? "Fastest demo estimate" : "Fastest estimate"}
            {route.tied ? " (tied)" : ""}
          </span>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{route.subtitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold">
          <span className="flex items-center gap-1">
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
