# Installation progress

Evidence date: 2026-09-06. User requested autonomous local continuation and
Brazilian Portuguese conversation. Human audio acceptance is deferred and does
not block automated checks.

## Latest follow-up

- Mobile installation foundation: `/instalar`, standalone Web App Manifest,
  generated 180/192/512 icons, Apple home-screen metadata and browser-supported
  installation prompt. No personal data caching, push or remote conversation
  activation. Physical phone acceptance remains pending; see
  `CLOUD_MOBILE_INSTALL.md`.

- GitHub and Vercel are integrated; the public address is
  `https://jarvis-bob.vercel.app`. Neon `jarvis-db` is provisioned on the Free
  plan in Sao Paulo, linked to production, with client TLS verified.
- The cloud account foundation now has a Portuguese sign-in surface, managed
  server-side sessions and a protected account boundary. Login remains gated
  until Neon accepts the callback domain; opening its settings via Vercel
  currently requires the user's 2FA. See `CLOUD_AUTH.md` for evidence and limits.

- Optional PostgreSQL conversation store and atomic snapshot import are now
  implemented. Real database tests verify parity with SQLite, owner isolation,
  concurrent event ordering, rollback and import conflict handling. Initial
  combined run: 545 passed; final import/core/parity run: 43 passed. No real
  conversations moved and no paid provider tests ran. See
  `POSTGRES_CONVERSATIONS.md`.

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

Earlier changes were committed locally and subsequently pushed during the
authorized GitHub/Vercel integration. The cloud address is deployed. No release
or completed remote chat/voice channel connection is claimed.

## Mobile conversation remains unconfigured

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

Trusted-domain configuration and authenticated account-page acceptance are
complete. Authenticated cloud owner pairing remains pending. The designated
Neon project is already provisioned.
The storage inventory is prepared in `STORAGE_MIGRATION_INVENTORY.md`. Cloud
CRUD, deployment, mobile pairing and human audio acceptance remain pending.

## Continuation check: local source unavailable

The production deployment remains Ready at the Google sign-in commit. Public
HTTP authentication and PWA checks passed again without paid provider calls.
Earlier local health and history evidence above is historical: the development
listener on port 18765 is no longer reachable, and its previously configured
temporary runtime directory is absent in the current environment. The checkout's
default data directory contains other state but does not establish the location
of that chat history.

Do not initialize an empty replacement and report it as recovered history.
Locate the original runtime or a consistent backup before importing real
conversations or assigning their cloud owner. Once recovered, put durable
runtime state outside temporary storage, preserve a consistent SQLite backup,
and reconcile snapshot counts and digests before any cutover. Cloud login
availability does not establish local worker health or completed migration.
