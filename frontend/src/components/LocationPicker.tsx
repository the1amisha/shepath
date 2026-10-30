import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/routing/types";
import { Button } from "@/components/ui/button";

type Target = "origin" | "destination";
type Props = {
  locationNames?: string;
  origin: LatLng | null;
  destination: LatLng | null;
  onPick: (target: Target, point: LatLng, label: string) => void;
};

export function LocationPicker(props: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target>("origin");
  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    generation.current++;
    setLocating(false);
  }, [props.locationNames]);
  function locate() {
    if (!navigator.geolocation) {
      setStatus(
        "Location is unavailable in this browser. Choose a point on the map or type a place.",
      );
      return;
    }
    const current = ++generation.current;
    setLocating(true);
    setStatus("Waiting for your location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (current !== generation.current) return;
        const point: LatLng = [position.coords.latitude, position.coords.longitude];
        props.onPick(
          "origin",
          point,
          `Current location (${point[0].toFixed(5)}, ${point[1].toFixed(5)})`,
        );
        setLocating(false);
        setStatus(
          `Start set to your current location. Reported accuracy: about ${Math.round(position.coords.accuracy)} m. Check it on the map.`,
        );
        setOpen(true);
      },
      () => {
        if (current !== generation.current) return;
        setLocating(false);
        setStatus(
          "Could not get your location. Allow location access, choose on the map, or type a place.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }
  return (
    <section className="mt-5 space-y-3" aria-label="Choose locations on a map">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide location map" : "Choose on map"}
        </Button>
        <Button type="button" variant="outline" disabled={locating} onClick={locate}>
          Use my location as start
        </Button>
        {locating && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              generation.current++;
              setLocating(false);
              setStatus("Location request cancelled.");
            }}
          >
            Cancel location request
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Your browser asks permission for current location. The selected coordinates are sent for
        routing when you find routes. No live tracking.
      </p>
      {open && (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Location to select">
            <Button
              type="button"
              variant={target === "origin" ? "primary" : "outline"}
              aria-pressed={target === "origin"}
              onClick={() => {
                generation.current++;
                setLocating(false);
                setTarget("origin");
              }}
            >
              Set start
            </Button>
            <Button
              type="button"
              variant={target === "destination" ? "primary" : "outline"}
              aria-pressed={target === "destination"}
              onClick={() => {
                generation.current++;
                setLocating(false);
                setTarget("destination");
              }}
            >
              Set destination
            </Button>
          </div>
          <p className="text-sm">
            Select a point for your {target === "origin" ? "start" : "destination"}. Click the map,
            or focus it and use arrow keys to pan, then choose its centre. A = start; B =
            destination. Routing may snap to a nearby walkable road.
          </p>
          <PickerMap
            {...props}
            target={target}
            onPick={(which, point, label) => {
              generation.current++;
              setLocating(false);
              props.onPick(which, point, label);
              setStatus(
                `${which === "origin" ? "Start" : "Destination"} selected at ${point[0].toFixed(5)}, ${point[1].toFixed(5)}.`,
              );
            }}
          />
        </>
      )}
      <p role="status" className="text-sm">
        {status}
      </p>
    </section>
  );
}

function PickerMap({ origin, destination, target, onPick }: Props & { target: Target }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const selectedPoints = useRef({ origin, destination });
  selectedPoints.current = { origin, destination };
  const callback = useRef({ target, onPick });
  callback.current = { target, onPick };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const initial = useRef(origin ?? destination ?? ([23.36, 85.33] as LatLng));
  function pick(point: LatLng) {
    const { target: which, onPick: choose } = callback.current;
    choose(
      which,
      point,
      `Map ${which === "origin" ? "start" : "destination"} (${point[0].toFixed(5)}, ${point[1].toFixed(5)})`,
    );
  }
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    let resize: ResizeObserver | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed || !container.current) return;
        map = L.map(container.current, { worldCopyJump: true }).setView(initial.current, 14);
        mapRef.current = map;
        resize = new ResizeObserver(() => {
          if (!map || disposed) return;
          map.invalidateSize();
          const { origin: start, destination: end } = selectedPoints.current;
          if (start && end)
            map.fitBounds(L.latLngBounds([start, end]), { padding: [30, 30], maxZoom: 16 });
        });
        resize.observe(container.current);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        })
          .on("tileerror", () => {
            if (!disposed)
              setError("Map tiles could not load. You can still type a place instead.");
          })
          .addTo(map);
        map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
          const ll = event.latlng.wrap();
          pickRef.current([ll.lat, ll.lng]);
        });
        setReady(true);
      })
      .catch(() => {
        if (!disposed) setError("Map could not load. Type a place instead.");
      });
    return () => {
      disposed = true;
      resize?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    const markers: import("leaflet").Marker[] = [];
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (disposed || !map) return;
      for (const [point, label] of [
        [origin, "A"],
        [destination, "B"],
      ] as const) {
        if (point)
          markers.push(
            L.marker(point, {
              icon: L.divIcon({
                className: "",
                html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#173f3b;color:white;border:3px solid white;font-weight:bold">${label}</span>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              }),
              title: label === "A" ? "Selected start" : "Selected destination",
            }).addTo(map),
          );
      }
      const points = [origin, destination].filter((p): p is LatLng => p !== null);
      if (points.length === 2)
        map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 16 });
      else if (points[0]) map.setView(points[0], 16);
    });
    return () => {
      disposed = true;
      markers.forEach((m) => m.remove());
    };
  }, [origin, destination, ready]);
  return (
    <div className="space-y-2">
      <div
        ref={container}
        role="region"
        aria-label="Location selection map"
        tabIndex={0}
        className="h-72 w-full rounded-xl border border-border"
      />
      <Button
        type="button"
        variant="secondary"
        disabled={!ready}
        onClick={() => {
          const point = mapRef.current?.getCenter().wrap();
          if (point) pick([point.lat, point.lng]);
        }}
      >
        Use map centre as {target === "origin" ? "start" : "destination"}
      </Button>
      {error && (
        <p role="status" className="text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
