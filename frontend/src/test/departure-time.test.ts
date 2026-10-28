import { expect, it } from "vitest";
import {
  daylightEstimate,
  istInputValue,
  parseDeparture,
  ranchiSunTimes,
} from "@/lib/routing/departureTime";
import {
  openingState,
  summarizeHours,
  facilityHoursSchema,
  type FacilityHours,
} from "@/lib/routing/facilityHours";
const at = (value: string) => parseDeparture(value)!;
it("uses IST and rejects invalid dates instead of normalizing them", () => {
  expect(at("2026-10-28T18:00").toISOString()).toBe("2026-10-28T12:30:00.000Z");
  expect(istInputValue(new Date("2026-10-28T20:00:00Z"))).toBe("2026-10-29T01:30");
  for (const v of [
    "",
    "2026-02-30T12:00",
    "2026-13-01T12:00",
    "2026-10-28T24:00",
    "2026-10-28T18:00Z",
    "1999-12-31T12:00",
    "2101-01-01T12:00",
  ])
    expect(parseDeparture(v)).toBeNull();
  expect(parseDeparture("2028-02-29T12:00")).not.toBeNull();
});
it.each([
  ["24/7", "2026-10-28T02:00", "likely_open"],
  [null, "2026-10-28T12:00", "missing"],
  ["  ", "2026-10-28T12:00", "missing"],
  ["Mo-Fr 09:00-18:00", "2026-10-28T09:00", "likely_open"],
  ["Mo-Fr 09:00-18:00", "2026-10-28T18:00", "likely_closed"],
  ["Mo-Fr 09:00-18:00", "2026-11-01T12:00", "likely_closed"],
  ["Mo-Fr 09:00-12:00,13:00-18:00; Sa 10:00-14:00; Su off", "2026-10-28T12:30", "likely_closed"],
  ["Mo-Fr 09:00-12:00,13:00-18:00; Sa 10:00-14:00; Su off", "2026-10-31T12:30", "likely_open"],
  ["Fr-Mo 10:00-15:00", "2026-11-01T12:00", "likely_open"],
  ["Su 22:00-02:00", "2026-11-02T01:59", "likely_open"],
  ["Su 22:00-02:00", "2026-11-02T02:00", "likely_closed"],
  ["00:00-24:00", "2026-10-28T23:59", "likely_open"],
  ["closed", "2026-10-28T12:00", "likely_closed"],
] as const)("evaluates %s at %s as %s", (hours, time, result) =>
  expect(openingState(hours, at(time))).toBe(result),
);
it.each([
  "Mo-Fr 09:00-18:00; PH off",
  "sunrise-sunset",
  "09:00+",
  "by appointment",
  '09:00-18:00 "call first"',
  "24/7 || unknown",
  "Feb 01-28 09:00-18:00",
  "Mo-Fr 09:00-18:00; We 10:00-12:00",
  "Mo 22:00-02:00; Tu off",
  "25:00-26:00",
  "09:61-18:00",
  "09:00-09:00",
  "24:00-02:00",
  "Su 09:00-18:00;",
  "x".repeat(513),
])("keeps unsupported schedules unknown: %s", (value) =>
  expect(openingState(value, at("2026-10-28T12:00"))).toBe("unsupported"),
);
it("counts objects in overlapping categories once and separates unknown reasons", () => {
  const records = ["24/7", "off", null, "PH off"].map((opening_hours, i) => ({
    osm_id: `node/${i}`,
    name: null,
    business: true,
    healthcare: true,
    opening_hours,
  }));
  const hours: FacilityHours = { schema_version: "SHEPATH.facility_hours.v1", records };
  expect(summarizeHours(hours, at("2026-10-28T12:00")).counts).toEqual({
    likely_open: 1,
    likely_closed: 1,
    missing: 1,
    unsupported: 1,
  });
  expect(
    facilityHoursSchema.safeParse({ ...hours, records: [records[0], records[0]] }).success,
  ).toBe(false);
});
it("has longer summer daylight and handles night portions across midnight", () => {
  const summer = ranchiSunTimes("2026-06-21")!,
    winter = ranchiSunTimes("2026-12-21")!;
  expect(summer.sunset.getTime() - summer.sunrise.getTime()).toBeGreaterThan(
    winter.sunset.getTime() - winter.sunrise.getTime(),
  );
  expect(ranchiSunTimes("2026-02-30")).toBeNull();
  const sun = ranchiSunTimes("2026-10-28")!;
  expect(daylightEstimate(at("2026-10-28T12:00"), 3600)!.nightMinutes).toBeCloseTo(0);
  expect(daylightEstimate(at("2026-10-28T20:00"), 3600)!.nightMinutes).toBeCloseTo(60);
  expect(daylightEstimate(new Date(sun.sunset.getTime() - 600000), 1800)!.nightMinutes).toBeCloseTo(
    20,
  );
  expect(
    daylightEstimate(new Date(sun.sunrise.getTime() - 600000), 1800)!.nightMinutes,
  ).toBeCloseTo(10);
  expect(daylightEstimate(at("2026-10-28T23:30"), 7200)!.nightMinutes).toBeCloseTo(120);
  expect(daylightEstimate(at("2026-10-28T12:00"), 0)!.nightMinutes).toBe(0);
  const twoDays = daylightEstimate(at("2026-10-28T12:00"), 48 * 3600)!;
  expect(twoDays.nightMinutes).toBeGreaterThan(1200);
  expect(twoDays.nightMinutes).toBeLessThan(1800);
  expect(daylightEstimate(at("2026-10-28T12:00"), 49 * 3600)).toBeNull();
  expect(daylightEstimate(at("2026-10-28T12:00"), NaN)).toBeNull();
});

// Independent Astral 3.2 reference (Ranchi centre, zero elevation, Asia/Kolkata).
// NOAA's compact fractional-year formula is an approximation; allow three minutes.
it.each([
  ["2026-03-20", "2026-03-20T05:53:18+05:30", "2026-03-20T17:59:34+05:30"],
  ["2026-06-21", "2026-06-21T05:03:31+05:30", "2026-06-21T18:37:33+05:30"],
  ["2026-10-28", "2026-10-28T05:51:58+05:30", "2026-10-28T17:12:47+05:30"],
  ["2026-12-21", "2026-12-21T06:25:56+05:30", "2026-12-21T17:07:30+05:30"],
  ["2028-02-29", "2028-02-29T06:11:24+05:30", "2028-02-29T17:51:20+05:30"],
])("agrees within three minutes with independent solar reference for %s", (day, rise, set) => {
  const result = ranchiSunTimes(day)!;
  expect(Math.abs(result.sunrise.getTime() - Date.parse(rise))).toBeLessThan(180000);
  expect(Math.abs(result.sunset.getTime() - Date.parse(set))).toBeLessThan(180000);
});

it("accepts whitespace in the actual Ranchi snapshot schedule", () => {
  expect(openingState("Mo-Su 10:00- 16:00", at("2026-10-28T15:00"))).toBe("likely_open");
  expect(openingState("Mo-Su 10:00- 16:00", at("2026-10-28T16:00"))).toBe("likely_closed");
});
