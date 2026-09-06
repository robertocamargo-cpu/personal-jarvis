# Installation progress

Evidence date: 2026-09-06. User requested autonomous local continuation and
Brazilian Portuguese conversation. Human audio acceptance is deferred and does
not block automated checks.

## Latest follow-up

- User requested only a cheaper Live model change. The existing API saved
  `gemini-2.5-flash-native-audio-preview-12-2025`; a subsequent runtime read
  confirmed it active, voice selection unchanged, no restart required and no
  microphone session active. No paid model test was run for this change.
- Explicit identity migration now resolves Jarvis in the existing API and UI.
- PostgreSQL identity adapter implemented and tested against an isolated real
  PostgreSQL 15.19 instance. 541 combined tests passed. Neon cloud activation
  and the remaining storage domains are still pending; see
  `POSTGRES_FOUNDATION.md`.

## Verified

- Headless dev instance at `http://127.0.0.1:18765`: health OK after restart.
- Gemini configured; reply and recognition pins remain Portuguese. Gemini Live
  is the selected realtime provider. No active microphone session.
- Existing front-page chat retained after restart: same session, 12 events.
- Real `gemini-live/realtime-voice-preview` request with `language=pt-BR` and
  voice `Puck` returned a valid WAV: mono, 24,000 Hz, 181,440 frames, 7.56 seconds.
  This verifies generation/transport, not human listening or pronunciation.
- Browser fallback preserves `pt-BR`; the standard scrubbed-error message is
  Portuguese. Voice preview uses Portuguese text as well as its locale pin.
- Identity foundation is implemented as an opt-in service and transactional
  local repository. Runtime name migration remains separate.
- Identity plus required guards: 535 tests passed. Browser voice/language plus
  guards after the locale fix: 565 passed. Preview/language tests: 19 passed.

Changes were committed locally. No release, cloud deployment or new channel
connection is claimed.

## Mobile access remains unconfigured

`127.0.0.1` is loopback, so the Mac URL is not a mobile access URL. The current
headless server stays bound to loopback. Existing Host/Origin/cookie/Bearer
guards are in `ui/web/surface_security.py`; they need deliberate remote
deployment configuration, not removal to make an IP work.

Project mobile access requires an authenticated HTTPS origin and a route to the
backend/WebSocket voice transport, followed by a real phone test. The roadmap
places this after storage and cloud foundations. A Telegram adapter is not
proof of a connected Telegram account or cross-channel approval delivery.

Codex Remote is a separate control plane for development approvals. Its device
pairing has not been verified here and it does not publish the Jarvis UI.

## Next prerequisites

Continue identity integration with explicit migration and API/frontend parity;
then establish the app's authenticated cloud owner and designated Neon project.
The storage inventory is prepared in `STORAGE_MIGRATION_INVENTORY.md`. Cloud
CRUD, deployment, mobile pairing and human audio acceptance remain pending.
