import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { routingService, routingProvider, type RouteData } from "@/lib/routing";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Clock3,
  Footprints,
  MapPin,
  Navigation,
  Sparkles,
  Store,
  Sun,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultsMapPanel } from "@/components/ResultsMapPanel";
import { ShePathMap } from "@/components/ShePathMap";
import { SavedRanchiPilot } from "@/components/SavedRanchiPilot";
import { EvidenceStatus, RouteEvidencePanel } from "@/components/RouteEvidencePanel";
import { useRouteEvidence } from "@/hooks/useRouteEvidence";
import { useJourneyFocus, focusContent } from "@/hooks/useJourneyFocus";
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
  const [preferences, setPreferences] = useState<string[]>([]);
  const [from, setFrom] = useState("Albert Ekka Chowk, Ranchi");
  const [to, setTo] = useState("Ranchi Railway Station, Ranchi");
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
    JSON.stringify([from, to]),
    !isMock && liveJourneyVisible,
  );
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
    setScreen("results");
    try {
      const data = await routingService.getRoutes({
        origin: from.trim(),
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
              src="/images/ranchi-walk.svg"
              width="315"
              height="355"
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
                  preferences: "Preference preview",
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
                label="Starting from"
                value={from}
                onChange={setFrom}
                dot="bg-primary"
                error={searchSubmitted && !from.trim() ? "Enter a starting place." : undefined}
              />
              <LocationField
                label="Going to"
                value={to}
                onChange={setTo}
                dot="bg-foreground"
                error={searchSubmitted && !to.trim() ? "Enter a destination." : undefined}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Lalpur, Ranchi", "Morabadi, Ranchi", "Doranda, Ranchi"].map((place) => (
                <Button
                  type="button"
                  key={place}
                  variant="secondary"
                  size="sm"
                  onClick={() => setTo(place)}
                >
                  <MapPin className="size-3.5" />
                  {place}
                </Button>
              ))}
            </div>
            <Button type="submit" className="mt-8 w-full" size="lg">
              Continue to preference preview <ArrowRight className="size-4" />
            </Button>
          </form>
        </PageFrame>
      )}

      {screen === "preferences" && (
        <PageFrame
          eyebrow="Prototype preferences"
          title="Preview your interests"
          description="These optional choices are a prototype preview only. They do not affect routing, route order or geographic evidence in either live or mock mode."
        >
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
            {(
              [
                [
                  "Lighting",
                  Sun,
                  "Interest in mapped lighting tags; actual lighting is unverified",
                ],
                [
                  "Street activity",
                  Users,
                  "Interest in activity context; pedestrian activity is not observed",
                ],
                [
                  "Nearby businesses",
                  Store,
                  "Interest in mapped businesses; current operation is unknown",
                ],
                [
                  "Walking infrastructure",
                  Footprints,
                  "Interest in mapped sidewalk tags; continuity is unverified",
                ],
              ] as const
            ).map(([label, Icon, copy]) => {
              const active = preferences.includes(label);
              return (
                <button
                  type="button"
                  aria-pressed={active}
                  key={label}
                  onClick={() =>
                    setPreferences(
                      active ? preferences.filter((p) => p !== label) : [...preferences, label],
                    )
                  }
                  className={cn(
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring grid min-h-36 grid-cols-[auto_1fr_auto] items-start gap-4 rounded-2xl border bg-card p-5 text-left transition-all",
                    active
                      ? "border-primary shadow-md ring-2 ring-primary/10"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-11 place-items-center rounded-2xl",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <b className="font-display text-base font-black">{label}</b>
                    <span className="mt-2 block text-sm leading-5 text-muted-foreground">
                      {copy}
                    </span>
                    <span className="mt-2 block text-xs font-bold">
                      {active ? "Selected" : "Not selected"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full border",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    <BadgeCheck className={cn("size-4", !active && "opacity-0")} />
                  </span>
                </button>
              );
            })}
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
              onClick={findRoutes}
              disabled={loading}
            >
              Skip preference preview
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
                {routeOptions.map((route) => (
                  <div key={route.id} data-route-card={route.id}>
                    <RouteOption
                      route={route}
                      selected={selected === route.id}
                      onSelect={() => setSelected(route.id)}
                    />
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
                <ShePathMap routes={routes} selected={selected} mock={isMock} />
              </section>
              {routeOptions.length > 0 && (
                <div
                  aria-label="Route colors"
                  className="flex flex-wrap gap-3 border-t border-border bg-card px-4 py-3 text-sm font-semibold"
                >
                  {routeOptions.map((route) => (
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
                <RouteEvidencePanel
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
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="overflow-hidden rounded-3xl border border-border bg-card app-shadow">
              <div className="h-[360px]" data-testid="overview-map-frame">
                <ShePathMap routes={routes} selected={selected} mock={isMock} />
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
                <img src="/images/ranchi-walk.svg" width="94" height="106" alt="" />
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
              <RouteEvidencePanel name={selectedRoute.name} state={evidence[selectedRoute.id]} />
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
              <RouteEvidencePanel name={selectedRoute.name} state={evidence[selectedRoute.id]} />
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

function LocationField({
  label,
  value,
  onChange,
  dot,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dot: string;
  error: string | undefined;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-input bg-background p-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10"
      >
        <span className={cn("mt-4 size-3 rounded-full ring-4 ring-card", dot)} />
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">
            {label}
          </span>
          <input
            id={id}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className="mt-1 w-full bg-transparent text-base font-bold text-foreground outline-none placeholder:text-muted-foreground"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Enter a place"
          />
        </span>
      </label>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm font-semibold text-foreground">
          {error}
        </p>
      )}
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
