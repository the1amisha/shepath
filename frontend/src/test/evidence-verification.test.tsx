import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EvidenceVerification } from "@/components/EvidenceVerification";
import { fetchRouteEvidence, type RouteEvidence } from "@/lib/routing/routeEvidence";
import { evidenceFingerprint } from "@/lib/routing/evidenceFingerprint";
import { evidenceFixture, evidenceRoute } from "./evidenceFixture";
vi.mock("@/lib/routing/routeEvidence", () => ({ fetchRouteEvidence: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function fixture() {
  const e = evidenceFixture();
  const { coordinates: _coordinates, ...route } = e.route;
  return { ...e, route } as RouteEvidence;
}
function open() {
  fireEvent.click(screen.getByRole("button", { name: "Verify this evidence" }));
}
function check() {
  fireEvent.click(screen.getByRole("button", { name: "Recheck evidence" }));
}
it("reveals full hashes without requesting and rechecks original geometry", async () => {
  const e = fixture();
  vi.mocked(fetchRouteEvidence).mockResolvedValue(e);
  render(<EvidenceVerification evidence={e} route={evidenceRoute} />);
  open();
  expect(screen.getByText("a".repeat(64))).toBeInTheDocument();
  expect(screen.getByText("b".repeat(64))).toBeInTheDocument();
  expect(fetchRouteEvidence).not.toHaveBeenCalled();
  check();
  expect(screen.getByRole("button", { name: "Rechecking…" })).toBeDisabled();
  expect(await screen.findByText(/Recheck matched at/)).toBeInTheDocument();
  expect(fetchRouteEvidence).toHaveBeenCalledWith(evidenceRoute, expect.any(AbortSignal));
  expect(fetchRouteEvidence).toHaveBeenCalledTimes(1);
});
it.each(["counts", "source", "identity", "coverage"])("detects changed %s", async (field) => {
  const e = fixture(),
    next = fixture();
  if (field === "counts") next.route_context!.categories.shops_and_businesses.count++;
  if (field === "source") next.source_provenance.manifest_sha256 = "f".repeat(64);
  if (field === "identity") next.evidence_identity_sha256 = "f".repeat(64);
  if (field === "coverage") {
    next.status = "coverage_unavailable";
    next.route_context = null;
    next.coverage.full_buffer_covered = false;
  }
  vi.mocked(fetchRouteEvidence).mockResolvedValue(next);
  render(<EvidenceVerification evidence={e} route={evidenceRoute} />);
  open();
  check();
  expect(await screen.findByText(/Evidence changed at/)).toBeInTheDocument();
  expect(screen.getByText("c".repeat(64))).toBeInTheDocument();
});
it("allows retry after failure", async () => {
  vi.mocked(fetchRouteEvidence)
    .mockRejectedValueOnce(new Error("Backend unavailable"))
    .mockResolvedValue(fixture());
  render(<EvidenceVerification evidence={fixture()} route={evidenceRoute} />);
  open();
  check();
  expect(await screen.findByText(/Recheck could not be completed/)).toBeInTheDocument();
  check();
  expect(await screen.findByText(/Recheck matched at/)).toBeInTheDocument();
});
it("aborts on route change and discards late results", async () => {
  let resolve!: (e: RouteEvidence) => void;
  vi.mocked(fetchRouteEvidence).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = render(<EvidenceVerification evidence={fixture()} route={evidenceRoute} />);
  open();
  check();
  const signal = vi.mocked(fetchRouteEvidence).mock.calls[0]![1];
  const other = { ...evidenceRoute, id: "other" };
  const e = fixture();
  e.route.id = "other";
  view.rerender(<EvidenceVerification evidence={e} route={other} />);
  expect(signal.aborted).toBe(true);
  resolve(fixture());
  open();
  await waitFor(() => expect(screen.getByRole("status")).toBeEmptyDOMElement());
});
it("requires original route and compares objects independent of key order", () => {
  render(<EvidenceVerification evidence={fixture()} />);
  open();
  expect(screen.queryByRole("button", { name: "Recheck evidence" })).not.toBeInTheDocument();
  expect(evidenceFingerprint({ b: 2, a: [1, 2] })).toBe(evidenceFingerprint({ a: [1, 2], b: 2 }));
  expect(evidenceFingerprint([1, 2])).not.toBe(evidenceFingerprint([2, 1]));
});
