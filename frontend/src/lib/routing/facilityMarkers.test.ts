import { afterEach, describe, expect, it, vi } from "vitest";
import { evidenceFixture, evidenceRoute } from "@/test/evidenceFixture";
import { extractFacilityMarkers } from "./facilityMarkers";
import { fetchRouteEvidence } from "./routeEvidence";
const feature = {
  id: "node/12",
  geometry: { type: "Point", coordinates: [85.32, 23.356] },
  properties: {
    categories: ["shops_and_businesses", "healthcare_facilities"],
    tags: { name: "Pharmacy <test>", amenity: "pharmacy", opening_hours: "24/7" },
  },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("facility markers", () => {
  it("deduplicates typed OSM identities and converts coordinate order", () => {
    expect(extractFacilityMarkers([feature, feature], evidenceRoute)).toEqual([
      {
        id: "node/12",
        name: "Pharmacy <test>",
        kind: "pharmacy",
        position: [23.356, 85.32],
        outline: false,
        openingHours: "24/7",
      },
    ]);
  });
  it("distinguishes missing geometry from empty or malformed records", () => {
    expect(extractFacilityMarkers(undefined, evidenceRoute)).toBeUndefined();
    expect(
      extractFacilityMarkers(
        [{ ...feature, geometry: { type: "Point", coordinates: [999, 23] } }],
        evidenceRoute,
      ),
    ).toEqual([]);
  });
  it("uses a recorded outline point for areas rather than inventing an entrance", () => {
    const area = {
      ...feature,
      id: "way/12",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [85.32, 23.356],
            [85.325, 23.356],
            [85.325, 23.357],
            [85.32, 23.356],
          ],
        ],
      },
    };
    expect(extractFacilityMarkers([area], evidenceRoute)?.[0]).toMatchObject({
      outline: true,
      position: [23.356, 85.32],
    });
  });
  it("retains compact display points only after matching the response route", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://test.example");
    const payload = {
      ...evidenceFixture(),
      route_context: { ...evidenceFixture().route_context, source_features: [feature] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => new Response(JSON.stringify(payload))),
    );
    const compact = await fetchRouteEvidence(evidenceRoute, new AbortController().signal);
    expect(compact.route_context?.facility_markers).toHaveLength(1);
    expect(compact.route_context).not.toHaveProperty("source_features");
    payload.route.coordinates = [...payload.route.coordinates].reverse();
    await expect(
      fetchRouteEvidence(evidenceRoute, new AbortController().signal),
    ).rejects.toMatchObject({ code: "response" });
  });
});
