# Browser microphone onboarding correction

Tier: T2 — existing browser onboarding surface; no backend permission contract changes.

## Problem and behavior

Chrome connecting to the macOS headless development server was shown native macOS
permission rows. The unstable Python app identity left Microphone unavailable and
Continue disabled, although browser microphone permission belongs to Chrome and
the current origin.

The permissions step now uses the existing embedded-desktop bridge detector.
Embedded macOS clients retain native permission requests and readiness checks.
Browser clients shown this step request `getUserMedia({ audio: true, video: false })`
on an explicit button click. Continue becomes available only after a live audio
track is obtained. All tracks are immediately stopped, including responses that
arrive after the user leaves the step. No audio is recorded or transmitted by
this probe. Denial, unavailable capture, missing devices, and capture errors keep
Continue disabled and provide recovery instructions. Text-only setup remains
available. Browser access does not grant native wake-word or desktop permissions.

Windows/Linux step visibility remains unchanged. Native macOS behavior is covered
by the existing snapshot tests; an installed app was not exercised in this change.

## Executed files

- Process entry point: `jarvis/ui/web/launcher.py` (`python -m jarvis.ui.web.launcher`).
- HTTP SPA handler: `jarvis/ui/web/server.py`.
- Served HTML: `jarvis/ui/web/dist/index.html`, referencing compiled JavaScript assets.
- Permission source: `jarvis/ui/web/frontend/src/components/onboarding/steps/PermissionsStep.tsx`
  and `BrowserPermissionsStep.tsx`.

Editing generated HTML is insufficient for this React permission flow; rebuild
with Node 22 using `npm run build` in the frontend directory.

## Validation

- Node 22: 62 onboarding and locale parity tests passed, including five new browser
  capture tests. Existing unrelated tests emit React act warnings.
- BrowserRealtimeControl: 16 existing tests passed; the five new capture tests
  passed again after correcting a TypeScript-only test option.
- `npm run build`: TypeScript, production bundle, and realtime-worklet guard passed.
  Vite reports existing large chunk and mixed dynamic/static import warnings.
- Local HTTP check: served index exactly matches the rebuilt index, and the served
  entry bundle contains the new browser permission interface.
- Chrome loaded the rebuilt application. Live microphone verification is pending:
  reloading returned onboarding to Terms of Use, and automatic approval review
  rejected resubmission without a renewed action-time confirmation. No permission
  was forged and no native permission setting was modified.
