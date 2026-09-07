# Installation progress

Evidence date: 2026-09-06. User requested autonomous local continuation and
Brazilian Portuguese conversation. Human audio acceptance is deferred and does
not block automated checks.

## Latest follow-up

- The authenticated `/consumo` view now reports 30-day cloud text-chat token
  usage and cost estimates, daily quota and incomplete attempts. Real Neon
  tests passed for account isolation, aggregation and the local-date boundary.
  The feature reads existing records without paid provider calls or schema
  changes. Production and browser acceptance are checked separately.

- Cloud text chat is implemented at `/chat`, using verified Google account
  ownership, streamed Brazilian Portuguese replies and separate PostgreSQL
  history. The configured model is Gemini 2.5 Flash-Lite. The real Neon branch
  test, Node 22 build, one-key provider call and 526 contract/core tests passed.
  GitHub publication and Vercel production READY were confirmed for `94e5b1c3f`.
  The authenticated browser completed two short turns, reloaded and selected
  the persisted conversation, then correctly recalled a synthetic keyword from
  the earlier turn. Displayed estimates were USD 0.000015 and USD 0.000014.
  Public HTTP checks rejected anonymous/forged sessions and foreign-origin
  chat mutations. Manifest, icons and installation-instruction checks passed.
  A physical phone test remains unperformed. See `CLOUD_CHAT.md`.
  Mac pairing, central desktop storage migration and the Local
  Bridge remain deferred by the user.

- Mobile installation foundation: `/instalar`, standalone Web App Manifest,
  generated 180/192/512 icons, Apple home-screen metadata and browser-supported
  installation prompt. No personal data caching or push notifications.
  Physical phone acceptance remains pending; see
  `CLOUD_MOBILE_INSTALL.md`.

- GitHub and Vercel are integrated; the public address is
  `https://jarvis-bob.vercel.app`. Neon `jarvis-db` is provisioned on the Free
  plan in Sao Paulo, linked to production, with client TLS verified.
- The cloud account foundation now has a Portuguese sign-in surface, managed
  server-side sessions and a protected account boundary. Google sign-in and
  authenticated account-page reload are verified. See `CLOUD_AUTH.md`.

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

## Historical development verification

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

## Local transport and deferred mobile voice

`127.0.0.1` is loopback, so the Mac URL is not a mobile access URL. The current
headless server stays bound to loopback. Existing Host/Origin/cookie/Bearer
guards are in `ui/web/surface_security.py`; they need deliberate remote
deployment configuration, not removal to make an IP work.

Cloud text chat uses its own authenticated HTTPS endpoint. Mobile voice still
requires a backend/WebSocket voice transport and a real phone test.
A Telegram adapter is not
proof of a connected Telegram account or cross-channel approval delivery.

Codex Remote is a separate control plane for development approvals. Its device
pairing has not been verified here and it does not publish the Jarvis UI.

## Deferred prerequisites for local/cloud unification

Trusted-domain configuration and authenticated account-page acceptance are
complete. Authenticated cloud owner pairing remains pending. The designated
Neon project is already provisioned.
The storage inventory is prepared in `STORAGE_MIGRATION_INVENTORY.md`. Unified
desktop/cloud CRUD, installation pairing and human audio acceptance remain
pending. The separate cloud text chat does not depend on these deferred steps.

## Continuation check: local source unavailable

Follow-up: the user explicitly chose a fresh history instead of recovery. The
managed macOS launcher was rebuilt and its runtime identity verified. The
default instance now serves port 47821, with permanent checkout-local data,
the recovered Gemini credential, Portuguese reply/recognition pins, Jarvis
identity and the existing Gemini 2.5 native-audio model pin. First-run completion
and the subsequent restart were verified by API and browser. Microphone,
desktop-control and global-shortcut permissions remain incomplete; wake-word
activation is disabled. The recovery prerequisite below is superseded for
this user's fresh installation, not a claim that old data was recovered.

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

## Neon branch validation

T1: a manual, synthetic SQL smoke test; no application contract changes.

After explicit approval for the Vercel-integrated Neon sign-in, a schema-only
`dev-jarvis-link` branch was created with one-day automatic expiration. Its
SQL Editor executed `scripts/ci/neon_transaction_smoke.sql`: composite keys,
owner-filtered selection, Portuguese JSONB text and savepoint restoration all
returned true. The final rollback removed the temporary table, confirmed by
`to_regclass`. No production application or authentication tables were changed.

This validates SQL behavior, not application authorization, Python adapter
network behavior or completed Mac/cloud pairing. Export of all production
environment variables was rejected by automatic approval review; no secrets
were exported. The subsequent narrow read retrieved only the database credential
into process memory and connected exclusively to the disposable branch endpoint.
With full TLS verification and Certifi roots, all 11 existing chat/identity
PostgreSQL contract tests passed. No secret file or full environment export was
created. Recreate an isolated branch if this one has expired. Authenticated
installation pairing and runtime store activation remain pending.
