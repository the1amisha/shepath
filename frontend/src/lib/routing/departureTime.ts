/** Offline Ranchi solar estimates. NOAA general solar equations (no network API).
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 */
export const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;
export const RANCHI = { latitude: 23.3441, longitude: 85.3096 };

export function istInputValue(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}
// Never interpret a datetime-local input in the browser's timezone.
export function parseDeparture(value: string): Date | null {
  if (!/^(20\d{2}|2100)-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const instant = new Date(`${value}:00+05:30`);
  if (!Number.isFinite(instant.getTime()) || istInputValue(instant) !== value) return null;
  return instant;
}
export function formatIst(instant: Date): string {
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(instant) + " IST"
  );
}

export function ranchiSunTimes(date: string): { sunrise: Date; sunset: Date } | null {
  if (!parseDeparture(`${date}T12:00`)) return null;
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const year = new Date(midnight).getUTCFullYear();
  const day = (midnight - Date.UTC(year, 0, 1)) / DAY_MS + 1;
  const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS;
  const gamma = ((2 * Math.PI) / daysInYear) * (day - 1); // local noon approximation
  const eq =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const dec =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const lat = RANCHI.latitude * RAD;
  const cosine =
    Math.cos(90.833 * RAD) / (Math.cos(lat) * Math.cos(dec)) - Math.tan(lat) * Math.tan(dec);
  if (cosine < -1 || cosine > 1) return null;
  const angle = Math.acos(cosine) / RAD;
  const noon = 720 - 4 * RANCHI.longitude - eq;
  return {
    sunrise: new Date(midnight + (noon - 4 * angle) * 60_000),
    sunset: new Date(midnight + (noon + 4 * angle) * 60_000),
  };
}

export function daylightEstimate(departure: Date, durationSeconds: number) {
  if (
    !Number.isFinite(departure.getTime()) ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0 ||
    durationSeconds > 48 * 3600
  )
    return null;
  const arrival = new Date(departure.getTime() + durationSeconds * 1000);
  const firstDay = istInputValue(departure).slice(0, 10);
  const sun = ranchiSunTimes(firstDay);
  if (!sun) return null;
  let daylightMs = 0;
  // At most three IST calendar dates intersect a walk capped at 48 hours.
  const firstMidnight = Date.parse(`${firstDay}T00:00:00+05:30`);
  for (let i = 0; i < 3; i++) {
    const midnight = new Date(firstMidnight + i * DAY_MS);
    if (midnight.getTime() > arrival.getTime()) break;
    const times = ranchiSunTimes(istInputValue(midnight).slice(0, 10));
    if (!times) return null;
    daylightMs += Math.max(
      0,
      Math.min(arrival.getTime(), times.sunset.getTime()) -
        Math.max(departure.getTime(), times.sunrise.getTime()),
    );
  }
  return {
    arrival,
    sunrise: sun.sunrise,
    sunset: sun.sunset,
    nightMinutes: Math.max(0, (durationSeconds * 1000 - daylightMs) / 60_000),
  };
}
