import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
import { routingService, routingProvider, type RouteData } from "@/lib/routing";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Clock3,
  Footprints,
  Info,
  Lightbulb,
  MapPin,
  Navigation,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Sun,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShePathMap } from "@/components/ShePathMap";
import { SavedRanchiPilot } from "@/components/SavedRanchiPilot";
import { mockPreviewRoutes } from "@/lib/routing/mockRoutingService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SHEPATH — Safer routes, made for you" },
      { name: "description", content: "Compare safety-aware routes with clear scores and practical street-level context." },
      { property: "og:title", content: "SHEPATH — Safer routes, made for you" },
      { property: "og:description", content: "Compare safety-aware routes with clear scores and practical street-level context." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShePathApp,
});

type Screen = "welcome" | "search" | "preferences" | "results" | "details" | "report";
type RouteKey = string;
const isMock = routingProvider === "mock";

type RouteOptionData = { id: RouteKey; name: string; subtitle: string; minutes: number; distanceKm: string; score?: number; color: string };

/** Presentation metadata per route; timing/distance come from the routing service. */
const routePresentation: Record<RouteKey, { name: string; subtitle: string; score: number; color: string }> = {
  recommended: { name: "Best balance", subtitle: "Well-lit · Active streets", score: 92, color: "bg-primary" },
  quick: { name: "Fastest", subtitle: "Main roads · Busy crossings", score: 78, color: "bg-warning" },
  calm: { name: "Quiet & open", subtitle: "Parks · Fewer shops", score: 84, color: "bg-success" },
};

function toRouteOptions(routes: RouteData[]): RouteOptionData[] {
  return routes.map((route) => {
    const meta = (isMock ? routePresentation[route.id] : undefined) ?? { name: route.durationSeconds === Math.min(...routes.map(r => r.durationSeconds)) ? "Fastest" : `Route ${routes.indexOf(route) + 1}`, subtitle: "Safety analysis not available yet", color: ["bg-primary", "bg-warning", "bg-success"][routes.indexOf(route) % 3]! };
    return { id: route.id as RouteKey, ...meta, minutes: Math.round(route.durationSeconds / 60), distanceKm: `${(route.distanceMeters / 1000).toFixed(1)} km` };
  });
}

const steps: Screen[] = ["welcome", "search", "preferences", "results", "details", "report"];

function Brand() {
  return (
    <div className="flex items-center gap-2.5" aria-label="SHEPATH by She Builds">
      <div className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground soft-shadow">
        <Navigation className="size-5 -rotate-12" strokeWidth={2.6} />
      </div>
      <div className="leading-none">
        <div className="font-display text-lg font-black">SHEPATH</div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">by She Builds</div>
      </div>
    </div>
  );
}

function SafetyScore({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full border-[5px] border-success bg-card font-display font-black text-foreground", size === "sm" && "size-12 border-[4px] text-sm", size === "md" && "size-16 text-lg", size === "lg" && "size-24 border-[7px] text-2xl")}>
      <span className="flex flex-col items-center leading-none">{score}<small className="mt-1 text-[8px] font-bold text-muted-foreground">/ 100</small></span>
    </div>
  );
}

export function ShePathApp() {
  const [showSavedPilot, setShowSavedPilot] = useState(false);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [selected, setSelected] = useState<RouteKey>("");
  const [preferences, setPreferences] = useState(["Well-lit streets", "Active areas", "Open businesses"]);
  const [from, setFrom] = useState("Albert Ekka Chowk, Ranchi");
  const [to, setTo] = useState("Ranchi Railway Station, Ranchi");
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const routeOptions = toRouteOptions(routes);
  const currentIndex = steps.indexOf(screen);
  const findRoutes = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setError(null); setRoutes([]); setSelected(""); setScreen("results");
    try {
      const data = await routingService.getRoutes({origin: from.trim(), destination: to.trim(), travelMode: "walk"});
      if (!data.length) throw new Error("No routes were returned. Check the locations and try again.");
      setRoutes(data); setSelected(data[0]!.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to fetch routes. Please try again."); }
    finally { inFlight.current = false; setLoading(false); }
  };

  const goBack = () => {
    const previous = steps[Math.max(0, currentIndex - 1)];
    if (previous) setScreen(previous);
  };
  const selectedRoute = routeOptions.find(route => route.id === selected);

  if (showSavedPilot) return <SavedRanchiPilot onBack={() => setShowSavedPilot(false)} />;

  if (screen === "welcome") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background">
        <div className="absolute inset-x-0 top-0 h-2 bg-primary" />
        <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
          <section className="max-w-xl">
            <Brand />
            <div className="mt-16 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground">
              <Sparkles className="size-4" /> Ranchi, Jharkhand, India pilot prototype
            </div>
            <h1 className="mt-7 font-display text-5xl font-black leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">
              Move through your city with more confidence.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
              SHEPATH helps you compare routes through the things that matter—lighting, activity, visibility, and nearby support.
            </p>
            <Button size="lg" className="mt-9" onClick={() => setScreen("search")}>
              Plan a safer route <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" className="mt-3 block" onClick={() => setShowSavedPilot(true)}>Saved Ranchi Pilot Comparison</Button>
            <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ShieldCheck className="size-4 text-primary" /> Illustrative routes and mock safety data</p>
          </section>

          <section className="relative mx-auto w-full max-w-xl" aria-label="SHEPATH route preview">
            <div className="absolute -left-5 top-16 hidden rounded-2xl bg-card p-4 soft-shadow sm:block">
              <div className="flex items-center gap-3"><Sun className="size-5 text-warning-foreground" /><div><b className="block text-sm">Mock lighting</b><span className="text-xs text-muted-foreground">86% of demo route</span></div></div>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-border bg-card p-3 app-shadow">
              <div className="relative h-[480px] overflow-hidden rounded-[1.4rem] bg-secondary">
                <ShePathMap routes={mockPreviewRoutes} selected="recommended" mock />
                <div className="absolute inset-x-4 bottom-4 z-[500] rounded-2xl bg-card/95 p-5 shadow-xl backdrop-blur">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                    <div className="min-w-0"><span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-primary">Mock preview route</span><h2 className="mt-1 truncate font-display text-xl font-black">Best balance</h2><p className="mt-1 text-xs text-muted-foreground">22 min - mock walking estimate</p></div>
                    <SafetyScore score={92} size="sm" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 top-10 rounded-2xl bg-foreground px-4 py-3 text-background soft-shadow"><span className="text-xs font-bold">92 mock safety score</span></div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-[1000] border-b border-border/70 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto grid h-20 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:flex sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Button aria-label="Go back" title="Go back" variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="size-5" /></Button>
            <Brand />
          </div>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {steps.slice(1).map((step, index) => <span key={step} className={cn("h-1.5 rounded-full transition-all", index <= currentIndex - 1 ? "w-8 bg-primary" : "w-3 bg-border")} />)}
          </div>
          <div className="rounded-full bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground md:ml-6">Step {currentIndex} of 5</div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-8"><Button variant="outline" size="sm" onClick={() => setShowSavedPilot(true)}>Saved Ranchi Pilot Comparison</Button></div>

      {screen === "search" && (
        <PageFrame eyebrow="Plan your journey" title="Where are you headed?" description={isMock ? "Add your start and destination. Mock mode uses fixed demo routes." : "Add your start and destination. Safety analysis is not available yet."}>
          <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-5 app-shadow sm:p-8">
            <div className="relative space-y-4 before:absolute before:left-[1.35rem] before:top-12 before:h-16 before:border-l-2 before:border-dashed before:border-primary/40">
              <LocationField label="Starting from" value={from} onChange={setFrom} dot="bg-primary" />
              <LocationField label="Going to" value={to} onChange={setTo} dot="bg-foreground" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Lalpur, Ranchi", "Morabadi, Ranchi", "Doranda, Ranchi"].map(place => <Button key={place} variant="secondary" size="sm" onClick={() => setTo(place)}><MapPin className="size-3.5" />{place}</Button>)}
            </div>
            <Button className="mt-8 w-full" size="lg" onClick={() => setScreen("preferences")} disabled={!from || !to}>Choose safety preferences <ArrowRight className="size-4" /></Button>
          </div>
        </PageFrame>
      )}

      {screen === "preferences" && (
        <PageFrame eyebrow="Make it yours" title="What helps you feel safer?" description={isMock ? "Choose what you value most. Mock safety context is illustrative." : "Choose what you value most. Safety analysis is not available yet; these preferences do not affect routing."}>
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
            {([
              ["Well-lit streets", Sun, "Prioritise consistently lit roads"],
              ["Active areas", Users, "Prefer streets with more people around"],
              ["Open businesses", Store, "Stay close to shops and cafés"],
              ["Fewer quiet stretches", Footprints, "Avoid long isolated segments"],
            ] as const).map(([label, Icon, copy]) => {
              const active = preferences.includes(label);
              return <button key={label} onClick={() => setPreferences(active ? preferences.filter(p => p !== label) : [...preferences, label])} className={cn("grid min-h-36 grid-cols-[auto_1fr_auto] items-start gap-4 rounded-2xl border bg-card p-5 text-left transition-all", active ? "border-primary shadow-md ring-2 ring-primary/10" : "border-border hover:border-primary/40")}><span className={cn("grid size-11 place-items-center rounded-2xl", active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}><Icon className="size-5" /></span><span className="min-w-0"><b className="font-display text-base font-black">{label}</b><span className="mt-2 block text-sm leading-5 text-muted-foreground">{copy}</span></span><span className={cn("grid size-6 place-items-center rounded-full border", active ? "border-primary bg-primary text-primary-foreground" : "border-border")}><BadgeCheck className={cn("size-4", !active && "opacity-0")} /></span></button>;
            })}
          </div>
          <div className="mx-auto mt-8 max-w-3xl"><Button className="w-full" size="lg" onClick={findRoutes} disabled={loading || !from.trim() || !to.trim()}>Find my routes <Sparkles className="size-4" /></Button></div>
        </PageFrame>
      )}

      {screen === "results" && (
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8">
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{loading ? "Finding routes..." : `${routes.length} ${isMock ? "illustrative mock" : "available"} route${routes.length === 1 ? "" : "s"}`}</p><h1 className="mt-1 truncate font-display text-2xl font-black sm:text-3xl">{from} <span className="text-muted-foreground">to</span> {to}</h1></div>
            <Button variant="outline" size="sm" onClick={() => setScreen("search")}>Edit</Button>
          </div>
          <div className="grid min-h-[calc(100vh-9rem)] overflow-hidden rounded-3xl border border-border bg-card app-shadow lg:grid-cols-[390px_minmax(0,1fr)]">
            <aside className="order-2 border-t border-border p-4 lg:order-1 lg:border-r lg:border-t-0 lg:p-5">
              <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4"><Sparkles className="mt-0.5 size-5 shrink-0 text-primary"/><p className="text-sm leading-5 text-secondary-foreground">{isMock ? <><b>Mock route comparison.</b> Fixed Ranchi demo paths for any inputs; not verified walking routes. All times and safety signals are illustrative.</> : <><b>Safety analysis not available yet.</b> Backend travel estimates; routes are not ranked by safety.</>}</p></div>
              <div className="mt-4 space-y-3">{loading && <p role="status">Finding your routes...</p>}{error && <div role="alert" className="rounded-2xl border border-border p-4"><p>{error}</p><Button className="mt-3" variant="outline" onClick={findRoutes}>Try again</Button></div>}
                {routeOptions.map(route => <RouteOption key={route.id} route={route} selected={selected === route.id} onSelect={() => setSelected(route.id)} />)}
              </div>
              <Button className="mt-5 w-full" size="lg" disabled={!selectedRoute || loading} onClick={() => setScreen("details")}>View route details <ChevronRight className="size-4" /></Button>
            </aside>
            <section className="relative order-1 min-h-[52vh] overflow-hidden bg-muted lg:order-2 lg:min-h-full">
              <ShePathMap routes={routes} selected={selected} mock={isMock} />
              {selectedRoute && <div className="absolute left-4 top-4 z-[500] flex items-center gap-2 rounded-full bg-card/95 px-4 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur"><span className={cn("size-2.5 rounded-full route-pulse", selectedRoute.color)} />{selectedRoute.name} · {selectedRoute.minutes} min</div>}
              {routeOptions.length > 0 && <div className="absolute bottom-5 left-1/2 z-[500] flex max-w-full -translate-x-1/2 flex-wrap gap-3 rounded-full bg-card/95 px-4 py-2 text-[11px] font-semibold shadow-lg">{routeOptions.map(route => <span key={route.id} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", route.color)} />{route.name}</span>)}</div>}
            </section>
          </div>
        </div>
      )}

      {screen === "details" && selectedRoute && (
        <PageFrame eyebrow="Route details" title={`${selectedRoute.name}, step by step`} description={isMock ? `Mock ${selectedRoute.minutes} minute estimate from ${from} to ${to}. Fixed demo geometry.` : `${selectedRoute.minutes} minute estimate from ${from} to ${to}. Safety analysis not available yet.`}>
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="overflow-hidden rounded-3xl border border-border bg-card app-shadow"><div className="h-72"><ShePathMap routes={routes} selected={selected} mock={isMock} /></div><div className="p-6"><div className="grid grid-cols-3 gap-4 text-center"><Stat label="Travel time" value={`${selectedRoute.minutes} min`} /><Stat label="Distance" value={selectedRoute.distanceKm} /><Stat label="Safety" value={selectedRoute.score === undefined ? "Not available yet" : `${selectedRoute.score}/100 (mock)`} /></div></div></div>
            <div className="rounded-3xl border border-border bg-card p-6 app-shadow">{isMock ? <><h2 className="font-display text-xl font-black">Why this mock route?</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">This mock explanation illustrates active, visible roads and nearby businesses. Lighting, activity, business counts, and risk are prototype data, not real observations.</p><div className="mt-6 space-y-4">{([[Sun,"Street lighting","Mock: strong for 86% of the route"],[Users,"Street activity","Mock: footfall until 9:30 PM"],[Store,"Nearby support","Mock: 14 open businesses"]] as const).map(([Icon,label,copy]) => <div key={label} className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Icon className="size-4" /></span><div><b className="text-sm">{label}</b><p className="mt-0.5 text-xs text-muted-foreground">{copy}</p></div></div>)}</div></> : <><h2 className="font-display text-xl font-black">Safety analysis not available yet</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Travel estimates and geometry come from the backend. Lighting, activity, and nearby support have not been assessed.</p></>}<Button className="mt-7 w-full" onClick={() => setScreen("report")}>View full safety report <ArrowRight className="size-4" /></Button></div>
          </div>
        </PageFrame>
      )}

      {screen === "report" && selectedRoute && (
        <PageFrame eyebrow="Safety report" title={isMock ? "The context behind your score" : "Safety analysis not available yet"} description={isMock ? "A transparent breakdown of the mock signals used for this route." : "No safety score or safety factors have been calculated for this route."}>
          <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-card app-shadow">
            {isMock && selectedRoute.score !== undefined ? <><div className="grid items-center gap-6 border-b border-border bg-secondary/55 p-6 sm:grid-cols-[auto_1fr]"><SafetyScore score={selectedRoute.score} size="lg"/><div><h2 className="font-display text-2xl font-black">Mock overall safety context</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">This demo assigns high mock lighting and activity scores. All scores and signals are illustrative, not verified safety assessments.</p></div></div>
            <div className="grid gap-7 p-6 sm:grid-cols-2 sm:p-8">
              <Factor name="Street lighting" score={94} icon={Sun} />
              <Factor name="Area activity" score={91} icon={Users} />
              <Factor name="Open businesses" score={88} icon={Store} />
              <Factor name="Route visibility" score={90} icon={ShieldCheck} />
            </div>
            <div className="mx-6 mb-6 flex items-start gap-3 rounded-2xl border border-border bg-muted p-4 sm:mx-8 sm:mb-8"><Info className="mt-0.5 size-5 shrink-0 text-primary"/><p className="text-xs leading-5 text-muted-foreground"><b className="text-foreground">Prototype note:</b> All route names, scores, factors, and explanations shown here are mock data for demonstrating the SHEPATH interface.</p></div></> : <div className="p-8 text-sm text-muted-foreground">Safety analysis not available yet. This route is not ranked by safety.</div>}
          </div>
          <div className="mx-auto mt-6 flex max-w-4xl justify-center"><Button variant="dark" size="lg" onClick={() => setScreen("welcome")}>Plan another journey</Button></div>
        </PageFrame>
      )}
    </main>
  );
}

function PageFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="px-4 py-10 sm:px-8 sm:py-14"><div className="mx-auto mb-9 max-w-3xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{eyebrow}</p><h1 className="mt-3 font-display text-3xl font-black sm:text-5xl">{title}</h1><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p></div>{children}</div>;
}

function LocationField({ label, value, onChange, dot }: { label: string; value: string; onChange: (value: string) => void; dot: string }) {
  return <label className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-input bg-background p-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10"><span className={cn("mt-4 size-3 rounded-full ring-4 ring-card", dot)} /><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{label}</span><input className="mt-1 w-full bg-transparent text-base font-bold text-foreground outline-none placeholder:text-muted-foreground" value={value} onChange={event => onChange(event.target.value)} placeholder="Enter a place" /></span></label>;
}

function RouteOption({ route, selected, onSelect }: { route: RouteOptionData; selected: boolean; onSelect: () => void }) {
  return <button onClick={onSelect} className={cn("w-full rounded-2xl border p-4 text-left transition-all", selected ? "border-primary bg-secondary/45 shadow-sm ring-2 ring-primary/10" : "border-border bg-card hover:border-primary/40")}><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={cn("size-2.5 shrink-0 rounded-full", route.color)} /><h3 className="truncate font-display text-base font-black">{route.name}</h3>{route.score !== undefined && route.id === "recommended" && <span className="rounded-full bg-primary px-2 py-1 text-[8px] font-black uppercase text-primary-foreground">Best</span>}</div><p className="mt-2 text-xs text-muted-foreground">{route.subtitle}</p><div className="mt-3 flex items-center gap-3 text-xs font-bold"><span className="flex items-center gap-1"><Clock3 className="size-3.5 text-muted-foreground" />{route.minutes} min</span>{route.score !== undefined && <span className="flex items-center gap-1"><Star className="size-3.5 text-primary" />{route.score} mock safety</span>}</div></div>{route.score !== undefined && <SafetyScore score={route.score} size="sm" />}</div></button>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><div className="font-display text-lg font-black sm:text-xl">{value}</div><div className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</div></div>; }

function Factor({ name, score, icon: Icon }: { name: string; score: number; icon: typeof Lightbulb }) {
  return <div><div className="mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Icon className="size-4" /></span><b className="truncate text-sm">{name}</b><span className="text-sm font-black">{score}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} /></div></div>;
}
