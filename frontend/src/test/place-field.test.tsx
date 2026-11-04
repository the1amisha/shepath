import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { PlaceField } from "@/components/PlaceField";
vi.mock("@/lib/routing/apiBaseUrl", () => ({ apiBaseUrl: () => "http://test" }));
function Form({
  selected = vi.fn(),
}: {
  selected?: (place: { label: string; point: [number, number] }) => void;
}) {
  const [value, setValue] = useState("Initial place");
  return (
    <PlaceField
      label="Destination"
      value={value}
      onChange={setValue}
      dot="bg-primary"
      error={undefined}
      onSelect={(place) => {
        selected(place);
        setValue(place.label);
      }}
    />
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("debounces edits, selects with keyboard, and does not search the selected label", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ places: [{ label: "Bridgeford School, Ranchi", point: [23.3, 85.3] }] }),
  });
  vi.stubGlobal("fetch", fetcher);
  const selected = vi.fn();
  render(<Form selected={selected} />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "Br" } });
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "Bri" } });
  fireEvent.change(input, { target: { value: "Brid" } });
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("option")).toHaveTextContent("Bridgeford");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(selected).toHaveBeenCalledWith({
    label: "Bridgeford School, Ranchi",
    point: [23.3, 85.3],
  });
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("ignores a late response after a new edit and provides an empty-results fallback", async () => {
  vi.useFakeTimers();
  let resolveOld: (value: unknown) => void = () => {};
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValue({ ok: true, json: async () => ({ places: [] }) });
  vi.stubGlobal("fetch", fetcher);
  render(<Form />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "First" } });
  await act(() => vi.advanceTimersByTimeAsync(500));
  fireEvent.change(input, { target: { value: "Second" } });
  await act(async () =>
    resolveOld({
      ok: true,
      json: async () => ({ places: [{ label: "Old result", point: [23, 85] }] }),
    }),
  );
  expect(screen.queryByRole("option")).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(screen.getByRole("status")).toHaveTextContent("No matching places");
});
