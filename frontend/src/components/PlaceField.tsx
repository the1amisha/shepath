import { useEffect, useId, useState, useRef } from "react";
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
  onFocus,
  shortcuts = false,
  onCurrentLocation,
}: {
  shortcuts?: boolean;
  onCurrentLocation?: (() => void) | undefined;
  label: string;
  value: string;
  onChange: (value: string) => void;
  dot: string;
  error: string | undefined;
  onSelect?: ((place: Place) => void) | undefined;
  onFocus?: () => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
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
    setFocused(false);
    onSelect?.(place);
  }
  const options: { label: string; choose: () => void }[] = searching
    ? places.map((place) => ({ label: place.label, choose: () => choose(place) }))
    : shortcuts
      ? [
          ...(onCurrentLocation ? [{ label: "Current location", choose: onCurrentLocation }] : []),
          ...(enabled
            ? [
                {
                  label: "Sarala Birla University",
                  choose: () =>
                    choose({
                      label: "Sarala Birla University, Ara, Mahilong, Ranchi",
                      point: [23.3473466, 85.4174703],
                    }),
                },
              ]
            : []),
          ...[
            "Albert Ekka Chowk, Ranchi",
            "Ranchi Railway Station, Ranchi",
            "Lalpur, Ranchi",
            "Morabadi, Ranchi",
            "Doranda, Ranchi",
          ].map((name) => ({ label: name, choose: () => onChange(name) })),
        ]
      : [];
  const visible = focused && options.length > 0;
  function selectOption(index: number) {
    options[index]?.choose();
    setFocused(false);
    setQuery(null);
    setActive(-1);
  }
  return (
    <div className="relative">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 rounded-2xl border border-input bg-background p-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
        <span className={cn("mt-4 size-3 rounded-full ring-4 ring-card", dot)} />
        <span className="min-w-0">
          <label
            htmlFor={id}
            className="block text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground"
          >
            {label}
          </label>
          <input
            ref={input}
            id={id}
            value={value}
            autoComplete="off"
            role={enabled || shortcuts ? "combobox" : undefined}
            aria-autocomplete={enabled ? "list" : undefined}
            aria-expanded={enabled || shortcuts ? visible : undefined}
            aria-controls={visible ? `${id}-list` : undefined}
            aria-activedescendant={visible && active >= 0 ? `${id}-option-${active}` : undefined}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onFocus={() => {
              setFocused(true);
              onFocus?.();
            }}
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
                setFocused(false);
                setQuery(null);
                setPlaces([]);
                setMessage("");
              }
              if (visible && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                setActive((i) =>
                  event.key === "ArrowDown"
                    ? (i + 1) % options.length
                    : i <= 0
                      ? options.length - 1
                      : i - 1,
                );
              }
              if (visible && event.key === "Enter" && active >= 0) {
                event.preventDefault();
                selectOption(active);
              }
            }}
            className="mt-1 w-full bg-transparent text-base font-bold text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Enter a place"
          />
        </span>
        {shortcuts && (
          <button
            type="button"
            aria-label={`Show ${label.toLowerCase()} locations`}
            aria-expanded={visible}
            className="self-center rounded-lg p-2 text-muted-foreground hover:bg-secondary"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (visible) setFocused(false);
              else {
                input.current?.focus();
                setQuery(null);
                setFocused(true);
              }
            }}
          >
            <span aria-hidden="true">⌄</span>
          </button>
        )}
      </div>
      {visible && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-2xl border border-border bg-card p-1 shadow-lg"
        >
          {options.map((place, i) => (
            <li
              key={`${place.label}-${i}`}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={active === i}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(i)}
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
      {enabled && focused && query === value && message && (
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
