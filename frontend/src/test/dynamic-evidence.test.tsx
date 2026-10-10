import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRouteEvidence } from "@/hooks/useRouteEvidence";
import { RouteEvidencePanel } from "@/components/RouteEvidencePanel";
import { evidenceFixture, evidenceRoute as route } from "./evidenceFixture";
import type { RouteEvidence } from "@/lib/routing/routeEvidence";
import type { TravelMode } from "@/lib/routing/types";
const { fetchEvidence } = vi.hoisted(() => ({ fetchEvidence: vi.fn() }));
vi.mock("@/lib/routing/routeEvidence", () => ({ fetchRouteEvidence: fetchEvidence }));
const evidence = evidenceFixture() as RouteEvidence;
beforeEach(() => { fetchEvidence.mockReset(); });
afterEach(cleanup);

it("loads routes sequentially and displays mapped context with unknowns", async () => {
  let finish!: (value: RouteEvidence) => void;
  fetchEvidence.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(evidence);
  const routes = [route, { ...route, id: "second" }];
  const { result } = renderHook(() => useRouteEvidence(routes, "walk", "journey", true));
  expect(fetchEvidence).toHaveBeenCalledOnce();
  expect(result.current['second']?.status).toBe("queued");
  await act(async () => finish(evidence));
  await waitFor(() => expect(result.current['second']?.status).toBe("complete"));
  render(<RouteEvidencePanel name="Route 1" state={result.current[route.id]} />);
  expect(screen.getByText("7 mapped records")).toBeInTheDocument();
  expect(screen.getByText(/unknown, not evidence of an unsafe route/)).toBeInTheDocument();
  expect(screen.getByText(/OpenStreetMap contributors/)).toBeInTheDocument();
  expect(screen.queryByText(/safest/i)).not.toBeInTheDocument();
});
it.each(["cycle", "drive"] as TravelMode[])("skips %s", mode => {
  renderHook(() => useRouteEvidence([route], mode, "journey", true)); expect(fetchEvidence).not.toHaveBeenCalled();
});
it("skips disabled/mock/saved pilot views", () => {
  renderHook(() => useRouteEvidence([route], "walk", "journey", false)); expect(fetchEvidence).not.toHaveBeenCalled();
});
it("ignores late evidence for changed geometry with the same ID", async () => {
  let finish!: (value: RouteEvidence) => void;
  fetchEvidence.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(evidence);
  const initial = { routes: [route], journey: "old" };
  const { result, rerender } = renderHook(props => useRouteEvidence(props.routes, "walk", props.journey, true), { initialProps: initial });
  const oldSignal = fetchEvidence.mock.calls[0]![1] as AbortSignal;
  rerender({ routes: [{ ...route, coordinates: [...route.coordinates].reverse() }], journey: "new" });
  await waitFor(() => expect(result.current[route.id]?.status).toBe("complete"));
  const current = result.current;
  await act(async () => finish({ ...evidence, status: "coverage_unavailable", route_context: null }));
  expect(oldSignal.aborted).toBe(true); expect(result.current).toBe(current);
});
it("cancels when travel mode changes or the component unmounts", () => {
  fetchEvidence.mockImplementation(() => new Promise(() => {}));
  const routes = [route];
  const { result, rerender, unmount } = renderHook(({ mode }) => useRouteEvidence(routes, mode, "journey", true), { initialProps: { mode: "walk" as TravelMode } });
  const signal = fetchEvidence.mock.calls[0]![1] as AbortSignal;
  rerender({ mode: "drive" }); expect(signal.aborted).toBe(true); expect(result.current).toEqual({});
  rerender({ mode: "walk" }); const next = fetchEvidence.mock.calls[1]![1] as AbortSignal;
  unmount(); expect(next.aborted).toBe(true);
});
it("shows no counts for coverage unavailable and keeps failures independent", async () => {
  render(<RouteEvidencePanel name="Route 1" state={{ status: "complete", evidence: { ...evidence, status: "coverage_unavailable", route_context: null } }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Coverage unavailable");
  expect(screen.queryByText(/mapped records/)).not.toBeInTheDocument(); cleanup();
  fetchEvidence.mockRejectedValue(new Error("Evidence service is busy"));
  const routes = [route];
  const { result } = renderHook(() => useRouteEvidence(routes, "walk", "journey", true));
  await waitFor(() => expect(result.current[route.id]?.status).toBe("error"));
  render(<RouteEvidencePanel name="Route 1" state={result.current[route.id]} />);
  expect(screen.getByRole("status")).toHaveTextContent("Evidence service is busy");
});
