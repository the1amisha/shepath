import { z } from "zod";
import { formatIst, parseDeparture } from "./departureTime";
import type { LatLng } from "./types";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export function encodePath(points: LatLng[]) {
  const previous = [0, 0];
  let encoded = "";
  for (const point of points)
    point.forEach((value, axis) => {
      const current = Math.round(value * 1e6);
      const delta = current - previous[axis]!;
      previous[axis] = current;
      let bits = delta < 0 ? -2 * delta - 1 : 2 * delta;
      while (bits >= 32) {
        encoded += alphabet[(bits % 32) + 32];
        bits = Math.floor(bits / 32);
      }
      encoded += alphabet[bits];
    });
  return encoded;
}

const metadata = z.tuple([
  z.string().max(500),
  z.string().max(500),
  z.enum(["walk", "drive"]),
  z.string().max(32),
  z.number().nonnegative().finite(),
  z.number().nonnegative().max(31536000),
]);
export type PlanInfo = z.infer<typeof metadata>;
export function planLink(info: PlanInfo, points: LatLng[]) {
  const params = new URLSearchParams({ plan: JSON.stringify(info), path: encodePath(points) });
  return window.location.origin + "/#" + params.toString();
}
export function readPlan(hash: string) {
  if (hash.length > 1000000) throw Error("Invalid plan");
  const params = new URLSearchParams(hash.slice(1));
  const info = metadata.parse(JSON.parse(params.get("plan") ?? "null"));
  const coordinates: LatLng[] = [];
  const previous = [0, 0];
  let axis = 0,
    value = 0,
    factor = 1;
  for (const char of params.get("path") ?? "") {
    const digit = alphabet.indexOf(char);
    if (digit < 0 || factor > 32 ** 5) throw Error("Invalid path");
    value += (digit % 32) * factor;
    if (digit >= 32) {
      factor *= 32;
      continue;
    }
    previous[axis]! += value % 2 ? -(value + 1) / 2 : value / 2;
    if (Math.abs(previous[axis]!) > (axis ? 180 : 90) * 1e6) throw Error("Invalid point");
    if (axis) coordinates.push([previous[0]! / 1e6, previous[1]! / 1e6]);
    axis = 1 - axis;
    value = 0;
    factor = 1;
  }
  if (axis || factor !== 1 || coordinates.length < 2) throw Error("Incomplete route");
  return { info, coordinates };
}
export function planMessage([from, to, mode, departure, distance, duration]: PlanInfo) {
  const start = parseDeparture(departure);
  return [
    `SHEPATH · ${mode === "drive" ? "Driving" : "Walking"} trip plan`,
    `${from} → ${to}`,
    `${(distance / 1000).toFixed(1)} km · about ${Math.max(1, Math.round(duration / 60))} min`,
    ...(start
      ? [
          `Leaving ${formatIst(start)} · Expected arrival ${formatIst(new Date(start.getTime() + duration * 1000))}`,
        ]
      : []),
  ].join("\n");
}
