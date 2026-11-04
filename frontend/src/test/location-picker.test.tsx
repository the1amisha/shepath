import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LocationPicker } from "@/components/LocationPicker";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("handles denied geolocation and ignores a late response after cancellation", () => {
  let success: PositionCallback = () => {};
  let failure: PositionErrorCallback = () => {};
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
    success = ok;
    failure = fail;
  });
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  const onPick = vi.fn();
  render(<LocationPicker origin={null} destination={null} onPick={onPick} />);
  fireEvent.click(screen.getByRole("button", { name: "Use my location as start" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel location request" }));
  success({ coords: { latitude: 23, longitude: 85, accuracy: 10 } } as GeolocationPosition);
  expect(onPick).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Use my location as start" }));
  act(() => failure({ code: 1 } as GeolocationPositionError));
  expect(screen.getByRole("status")).toHaveTextContent("Could not get your location");
});
