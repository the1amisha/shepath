import { afterEach, expect, it, vi } from "vitest";
import { apiBaseUrl } from "./apiBaseUrl";
import { ApiRoutingService } from "./apiRoutingService";
import { fetchSavedPilot } from "./savedPilot";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each(["", "   ", "not-a-url", "file:///tmp/api", "https://user:secret@example.com", "https://example.com?token=secret", "https://example.com/#fragment"])("rejects unsafe/missing configuration without network or secret disclosure", async value => {
  vi.stubEnv("VITE_API_BASE_URL", value);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const service = new ApiRoutingService();
  expect(() => apiBaseUrl()).toThrow("VITE_API_BASE_URL");
  await expect(service.getRoutes({ origin: "A", destination: "B", travelMode: "walk" })).rejects.toThrow("VITE_API_BASE_URL");
  await expect(fetchSavedPilot()).rejects.toThrow("VITE_API_BASE_URL");
  expect(fetch).not.toHaveBeenCalled();
  try { apiBaseUrl(); } catch (error) { expect(String(error)).not.toContain("secret"); }
});

it("normalizes explicit configuration while preserving a path prefix", () => {
  vi.stubEnv("VITE_API_BASE_URL", "  https://example.com/api///  ");
  expect(apiBaseUrl()).toBe("https://example.com/api");
});
