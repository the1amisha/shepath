import { useEffect, useId, useState } from "react";
import { z } from "zod";
import { apiBaseUrl } from "@/lib/routing/apiBaseUrl";
import type { LatLng } from "@/lib/routing/types";
import { cn } from "@/lib/utils";
const schema = z.object({
  places: z
    .array(
      z.object({
        label: z.string().min(1).max(500),
        point: z.tuple([
          z.number().finite().min(-90).max(90),
          z.number().finite().min(-180).max(180),
        ]),
      }),
    )
    .max(5),
});
type Place = { label: string; point: LatLng };
export function PlaceField({
  label,
  value,
  onChange,
  dot,
  error,
  onSelect,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dot: string;
  error: string | undefined;
  onSelect?: ((place: Place) => void) | undefined;
}) {
  const id = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(-1);
  const enabled = !!onSelect;
  const searching =
    enabled && focused && query === value && value.trim().length >= 3 && value.trim().length <= 200;
  useEffect(() => {
    setPlaces([]);
    setActive(-1);
    setMessage("");
    if (!searching) return;
    let disposed = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setMessage("Looking for places…");
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`${apiBaseUrl().replace(/\/+$/, "")}/places/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value.trim() }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Suggestions unavailable");
        const result = schema.parse(await response.json());
        if (disposed) return;
        setPlaces(result.places);
        setMessage(
          result.places.length
            ? `${result.places.length} suggestions. Use arrow keys and Enter to choose.`
            : "No matching places found. Add the area and city, or choose on the map.",
        );
      } catch {
        if (!disposed)
          setMessage("Suggestions unavailable. Type a full address or choose on the map.");
      } finally {
        window.clearTimeout(timeout);
      }
    }, 500);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, searching]);
  function choose(place: Place) {
    setQuery(null);
    setPlaces([]);
    setMessage("");
    setActive(-1);
    onSelect?.(place);
  }
  const visible = searching && places.length > 0;
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
            value={value}
            autoComplete="off"
            role={enabled ? "combobox" : undefined}
            aria-autocomplete={enabled ? "list" : undefined}
            aria-expanded={enabled ? visible : undefined}
            aria-controls={visible ? `${id}-list` : undefined}
            aria-activedescendant={visible && active >= 0 ? `${id}-option-${active}` : undefined}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setPlaces([]);
            }}
            onChange={(event) => {
              const text = event.target.value;
              setPlaces([]);
              setActive(-1);
              setQuery(text);
              onChange(text);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery(null);
                setPlaces([]);
                setMessage("");
              }
              if (visible && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                setActive((i) =>
                  event.key === "ArrowDown"
                    ? (i + 1) % places.length
                    : i <= 0
                      ? places.length - 1
                      : i - 1,
                );
              }
              if (visible && event.key === "Enter" && active >= 0) {
                event.preventDefault();
                choose(places[active]!);
              }
            }}
            className="mt-1 w-full bg-transparent text-base font-bold text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Enter a place"
          />
        </span>
      </label>
      {visible && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="relative z-20 mt-1 max-h-64 overflow-auto rounded-2xl border border-border bg-card p-1 shadow-lg"
        >
          {places.map((place, i) => (
            <li
              key={`${place.label}-${i}`}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={active === i}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(place)}
              className={cn(
                "cursor-pointer break-words rounded-xl px-4 py-3 text-sm hover:bg-secondary",
                active === i && "bg-secondary",
              )}
            >
              <span className="font-semibold">{place.label}</span>
            </li>
          ))}
        </ul>
      )}
      {enabled && focused && (
        <p className="mt-2 text-xs text-muted-foreground">
          Type at least 3 characters. Suggestions search India, prioritising Ranchi. Typed searches
          are sent to the location service.
        </p>
      )}
      {enabled && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          {focused && query === value ? message : ""}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
