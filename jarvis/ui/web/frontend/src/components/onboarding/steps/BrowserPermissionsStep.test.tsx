import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { StepProps } from "../OnboardingFlow";
import { BrowserPermissionsStep } from "./BrowserPermissionsStep";

vi.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
const prefix = "onboarding.permissions.browser.";
const getUserMedia = vi.fn();
const props = {
  goNext: vi.fn(), goBack: vi.fn(), skip: vi.fn(), setSummary: vi.fn(), setGap: vi.fn(),
} as unknown as StepProps;
const continueButton = () => screen.getByRole("button", { name: "onboarding.permissions.continue" }) as HTMLButtonElement;
const request = () => fireEvent.click(screen.getByRole("button", { name: prefix + "request" }));
function stream() {
  const track = { readyState: "live", stop: vi.fn() };
  return { track, media: { getAudioTracks: () => [track], getTracks: () => [track] } };
}
beforeEach(() => {
  vi.clearAllMocks();
  getUserMedia.mockReset();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("requests only after a click and releases the device before enabling Continue", async () => {
  const { track, media } = stream();
  getUserMedia.mockResolvedValue(media);
  render(<BrowserPermissionsStep {...props} />);
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(continueButton().disabled).toBe(true);
  request();
  await waitFor(() => expect(continueButton().disabled).toBe(false));
  expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  expect(track.stop).toHaveBeenCalledOnce();
  fireEvent.click(continueButton());
  expect(props.goNext).toHaveBeenCalledOnce();
});

it("keeps denial recoverable without reporting a grant", async () => {
  getUserMedia.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
  render(<BrowserPermissionsStep {...props} />);
  request();
  await screen.findByText(prefix + "denied");
  expect(continueButton().disabled).toBe(true);
  getUserMedia.mockResolvedValueOnce(stream().media);
  request();
  await waitFor(() => expect(continueButton().disabled).toBe(false));
});

it("does not attempt capture on an insecure origin", () => {
  vi.stubGlobal("isSecureContext", false);
  render(<BrowserPermissionsStep {...props} />);
  expect(screen.getByText(prefix + "unavailable")).toBeTruthy();
  request();
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(continueButton().disabled).toBe(true);
});

it("reports a missing microphone without unlocking Continue", async () => {
  getUserMedia.mockRejectedValue(new DOMException("Missing", "NotFoundError"));
  render(<BrowserPermissionsStep {...props} />);
  request();
  await screen.findByText(prefix + "no_device");
  expect(continueButton().disabled).toBe(true);
});

it("releases a late stream after leaving while permission is pending", async () => {
  let resolve!: (value: unknown) => void;
  getUserMedia.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { unmount } = render(<BrowserPermissionsStep {...props} />);
  request();
  request();
  expect(getUserMedia).toHaveBeenCalledOnce();
  unmount();
  const { media, track } = stream();
  await act(async () => { resolve(media); });
  expect(track.stop).toHaveBeenCalledOnce();
});
