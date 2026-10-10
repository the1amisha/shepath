import { z } from "zod";
import type { RouteData, RouteRequest, RoutingService } from "./types";

const coordinate = z.tuple([z.number().finite().min(-90).max(90), z.number().finite().min(-180).max(180)]);
const responseSchema = z.object({ routes: z.array(z.object({
  id: z.string().min(1),
  distanceMeters: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().nonnegative(),
  coordinates: z.array(coordinate).min(1),
  startPoint: coordinate,
  endPoint: coordinate,
})).min(1) });

export class ApiRoutingService implements RoutingService {
  constructor(private readonly baseUrl = import.meta.env["VITE_API_BASE_URL"] || "http://127.0.0.1:8000") {}

  async getRoutes(request: RouteRequest): Promise<RouteData[]> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      throw new Error("Unable to reach the routing backend. Check that it is running and allows this frontend origin in its CORS configuration.");
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body && typeof body === "object" && "detail" in body && typeof body.detail === "string" ? body.detail : `Request failed (HTTP ${response.status}). Check the locations and try again.`;
      throw new Error(detail);
    }
    if (body && typeof body === "object" && "routes" in body && Array.isArray(body.routes) && body.routes.length === 0) {
      throw new Error("No routes were returned. Check the locations and try again.");
    }
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success || new Set(parsed.data.routes.map(route => route.id)).size !== parsed.data.routes.length) {
      throw new Error("The routing backend returned invalid route data. Please try again.");
    }
    return parsed.data.routes;
  }
}
