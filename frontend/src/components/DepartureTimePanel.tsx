import { useId } from "react";
import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteData } from "@/lib/routing/types";
import {
  daylightEstimate,
  formatIst,
  istInputValue,
  parseDeparture,
} from "@/lib/routing/departureTime";
import { summarizeHours, type HoursState } from "@/lib/routing/facilityHours";

export function DepartureControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const valid = parseDeparture(value);
  return (
    <div className="space-y-2 min-w-0">
      <label htmlFor={id} className="block text-sm font-bold">
        Departure date and time (IST)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={id}
          type="datetime-local"
          min="2000-01-01T00:00"
          max="2100-12-31T23:59"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-help`}
          aria-invalid={!valid}
          className="w-full min-w-0 max-w-xs rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="rounded-xl border px-3 py-2 text-sm"
          onClick={() => onChange(istInputValue(new Date()))}
        >
          Use current IST time
        </button>
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {valid
          ? "Ranchi time (UTC+05:30), regardless of your device timezone. Changing it does not request new routes."
          : "Enter a valid IST date and time between 2000 and 2100."}
      </p>
    </div>
  );
}
const labels: Record<HoursState, string> = {
  likely_open: "Likely open",
  likely_closed: "Likely closed",
  missing: "Hours unknown: no tag",
  unsupported: "Hours unknown: schedule not supported",
};

export function DepartureTimePanel({
  route,
  name,
  state,
  departure,
  onChange,
}: {
  route: RouteData | undefined;
  name: string;
  state: EvidenceState | undefined;
  departure: string;
  onChange: (value: string) => void;
}) {
  const instant = parseDeparture(departure);
  const evidence =
    state?.status === "complete" &&
    state.evidence.route.id === route?.id &&
    state.evidence.status === "available" &&
    state.evidence.coverage.full_buffer_covered
      ? state.evidence
      : null;
  const sun =
    instant && evidence && route ? daylightEstimate(instant, route.durationSeconds) : null;
  const hours =
    instant && evidence?.route_context?.facility_hours
      ? summarizeHours(evidence.route_context.facility_hours, instant)
      : null;
  const heading = useId();
  return (
    <section
      aria-labelledby={heading}
      className="mb-6 rounded-3xl border border-border bg-card p-5 sm:p-7"
    >
      <h2 id={heading} className="mb-4 font-display text-xl font-bold">
        At your departure · {name}
      </h2>
      <DepartureControl value={departure} onChange={onChange} />
      {!instant ? (
        <p className="mt-4 text-sm">Time estimates are hidden until the departure time is valid.</p>
      ) : !evidence ? (
        <p className="mt-4 text-sm">
          Departure-time evidence is unavailable until matching Ranchi route evidence loads
          successfully.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-secondary p-4 text-sm leading-6">
              <h3 className="font-bold">Daylight estimate</h3>
              {sun ? (
                <>
                  <p>Estimated arrival: {formatIst(sun.arrival)}</p>
                  <p>Sunset on departure date: about {formatIst(sun.sunset)}</p>
                  <p>Sunrise on departure date: about {formatIst(sun.sunrise)}</p>
                  <p className="mt-2 font-bold">
                    {sun.nightMinutes < 0.01
                      ? "Your estimated walk falls between sunrise and sunset."
                      : `About ${Math.max(1, Math.round(sun.nightMinutes))} min of this walk falls between sunset and sunrise.`}
                  </p>
                </>
              ) : (
                <p>Daylight estimate unavailable. Supported walking durations are 0–48 hours.</p>
              )}
              <p className="mt-2 text-xs">
                Offline estimate for central Ranchi, using the route's travel duration. Twilight,
                terrain, weather, stops and actual lighting are not modeled.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary p-4 text-sm leading-6">
              <h3 className="font-bold">Mapped facilities at departure</h3>
              {hours ? (
                hours.records.length ? (
                  <>
                    <p>
                      {hours.counts.likely_open} likely open · {hours.counts.likely_closed} likely
                      closed
                    </p>
                    <p className="font-bold">
                      {hours.counts.missing + hours.counts.unsupported} hours unknown
                    </p>
                    <p>
                      {hours.counts.missing} missing hours · {hours.counts.unsupported} unsupported
                      schedules
                    </p>
                    <p>
                      {hours.records.length} mapped business or healthcare records within 100 m;
                      objects in both categories counted once.
                    </p>
                  </>
                ) : (
                  <p>
                    No mapped business or healthcare records in this route's buffer. This does not
                    establish absence on the street.
                  </p>
                )
              ) : (
                <p>
                  Facility schedules are unavailable in this response. Restart the updated backend
                  and search again.
                </p>
              )}
              <p className="mt-2 text-xs">
                Based on historical opening_hours tags, not confirmed operation. Evaluated at
                departure, not when you pass each facility. Missing or unsupported schedules stay
                unknown.
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Source snapshot: {evidence.source_provenance.source_snapshot_timestamp}. Holiday
            exceptions and changes since the snapshot may affect actual opening. No safety
            assessment.
          </p>
          {hours && hours.records.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-bold">Read opening-hours evidence</summary>
              <p className="my-3 text-xs">
                Supports 24/7 and simple weekly schedules. Complex rules, holiday calendars and
                ambiguous schedules are not evaluated. Showing {Math.min(50, hours.records.length)}{" "}
                of {hours.records.length} records; totals include all records.
              </p>
              <ul className="space-y-2">
                {hours.records.slice(0, 50).map((record) => (
                  <li key={record.osm_id} className="rounded-xl border p-3 break-words">
                    <b>{record.name || record.osm_id}</b> · {record.osm_id}: {labels[record.state]}
                    <p className="text-xs mt-1">
                      Recorded hours: {record.opening_hours?.trim() || "Not recorded"}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
