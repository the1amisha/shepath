import { z } from "zod";
import { IST_OFFSET_MS } from "./departureTime";

export const facilityHoursSchema = z
  .object({
    schema_version: z.literal("SHEPATH.facility_hours.v1"),
    records: z
      .array(
        z
          .object({
            osm_id: z.string().regex(/^(node|way|relation)\/\d+$/),
            name: z.string().nullable(),
            business: z.boolean(),
            healthcare: z.boolean(),
            opening_hours: z.string().nullable(),
          })
          .refine((r) => r.business || r.healthcare),
      )
      .max(10000),
  })
  .refine(
    (v) => new Set(v.records.map((r) => r.osm_id)).size === v.records.length,
    "Duplicate facility identity",
  );
export type FacilityHours = z.infer<typeof facilityHoursSchema>;
export type HoursState = "likely_open" | "likely_closed" | "missing" | "unsupported";
const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
type Rule = { days: Set<number>; spans: [number, number][] };

function clock(value: string, end: boolean): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number) as [number, number];
  return m < 60 && (h < 24 || (end && h === 24 && m === 0)) ? h * 60 + m : null;
}

/** Deliberately bounded weekly subset. Anything outside this grammar stays unknown.
 * In particular, no holiday calendar, solar times, comments, open ends, fallback,
 * date selectors or overlapping normal-rule day selectors are guessed.
 */
function weeklyRules(value: string): Rule[] | null {
  if (value.length > 512) return null;
  const parts = value.split(";").map((s) => s.trim());
  if (parts.length > 14) return null;
  const seen = new Set<number>();
  const rules: Rule[] = [];
  for (const part of parts) {
    const match =
      /^(?:((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+)?(off|closed|\d{2}:\d{2}-\d{2}:\d{2}(?:,\s*\d{2}:\d{2}-\d{2}:\d{2})*)$/.exec(
        part,
      );
    if (!match) return null;
    const selected = new Set<number>();
    if (!match[1]) days.forEach((_, i) => selected.add(i));
    else
      for (const range of match[1].split(",")) {
        const [start, finish = start] = range.split("-");
        let day = days.indexOf(start!);
        const end = days.indexOf(finish!);
        for (let i = 0; i < 7; i++) {
          selected.add(day);
          if (day === end) break;
          day = (day + 1) % 7;
        }
      }
    if ([...selected].some((d) => seen.has(d))) return null;
    selected.forEach((d) => seen.add(d));
    const spans: [number, number][] = [];
    if (match[2] !== "off" && match[2] !== "closed") {
      for (const span of match[2]!.split(",")) {
        const [a, b] = span.trim().split("-");
        const start = clock(a!, false),
          end = clock(b!, true);
        if (start === null || end === null || start === end) return null;
        // Avoid ambiguous cross-rule overnight overrides: only single-rule overnights.
        if (end < start && parts.length > 1) return null;
        spans.push([start, end]);
      }
    }
    rules.push({ days: selected, spans });
  }
  return rules;
}

export function openingState(raw: string | null, departure: Date): HoursState {
  if (!Number.isFinite(departure.getTime())) return "unsupported";
  if (!raw?.trim()) return "missing";
  const value = raw.trim();
  if (value === "24/7") return "likely_open";
  const rules = weeklyRules(value.replace(/[ \t]*-[ \t]*/g, "-").replace(/[ \t]*,[ \t]*/g, ","));
  if (!rules) return "unsupported";
  const ist = new Date(departure.getTime() + IST_OFFSET_MS);
  const today = (ist.getUTCDay() + 6) % 7;
  const previous = (today + 6) % 7;
  const minute = ist.getUTCHours() * 60 + ist.getUTCMinutes() + ist.getUTCSeconds() / 60;
  for (const rule of rules)
    for (const [start, end] of rule.spans) {
      if (end > start && rule.days.has(today) && minute >= start && minute < end)
        return "likely_open";
      if (
        end < start &&
        ((rule.days.has(today) && minute >= start) || (rule.days.has(previous) && minute < end))
      )
        return "likely_open";
    }
  return "likely_closed";
}
export function summarizeHours(hours: FacilityHours, departure: Date) {
  const records = hours.records.map((record) => ({
    ...record,
    state: openingState(record.opening_hours, departure),
  }));
  const counts: Record<HoursState, number> = {
    likely_open: 0,
    likely_closed: 0,
    missing: 0,
    unsupported: 0,
  };
  for (const record of records) counts[record.state]++;
  return { records, counts };
}
