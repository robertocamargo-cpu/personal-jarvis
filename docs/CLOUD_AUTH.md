# Cloud account foundation

Tier T3: a new cloud authentication surface, isolated in `cloud/`. Desktop
credentials, Python startup and the local voice runtime are unchanged.

The Vercel application now uses Next.js and the official managed Neon Auth
server SDK. `/api/auth/*` proxies authentication through the application origin;
the SDK manages signed, HTTP-only session cookies. `/conta` is protected by
the SDK middleware and checks the verified session again when rendering.
`/api/account` returns only the current session's user ID, name, email and
verification status. It does not accept a requested owner ID, expose session
tokens, or query any local history.

## Configuration and rollout

- `NEON_AUTH_BASE_URL`: provided by the existing Vercel Neon integration.
- `NEON_AUTH_COOKIE_SECRET`: generated independently and stored as a sensitive
  production variable in Vercel; at least 32 characters are required.
- `JARVIS_CLOUD_LOGIN_ENABLED=true`: enable only after the callback origin is
  registered and verified. Missing configuration fails closed, with an honest
  setup message rather than a broken sign-in button.
- Trusted origin and callback destination: `https://jarvis-bob.vercel.app`.
  No preview wildcard is trusted; preview environments need their own Neon
  branch and explicit callback configuration before enabling login.

State-changing proxy requests require the exact production Origin. Local
development allows only localhost/127.0.0.1 on port 3000 outside production.
Account responses are private and non-cacheable. No service worker caches
authentication or personal data.

## Current evidence, 2026-09-06

Follow-up: the user completed Vercel 2FA and explicitly confirmed adding
`https://jarvis-bob.vercel.app` to Neon's trusted domains. The console lists the
saved domain and Google Shared keys. The direct Google initiation probe now
returns HTTP 200 instead of `INVALID_CALLBACKURL`. Production login is enabled
through `JARVIS_CLOUD_LOGIN_ENABLED=true`; actual account acceptance remains
separate from successful OAuth initiation.

- Production build completed with Node 22 on macOS, using Next's official WASM
  compiler after the optional native packages were omitted to reduce disk use.
- Three policy tests passed. The HTTP contract passed against the production
  server locally: public pages, anonymous/forged cookie denial, ignored owner
  injection, account redirect, Origin denial and the disabled-login gate.
- The existing four Python guard families passed: 525 tests.
- Neon `get-session` returns HTTP 200 with a null anonymous session.
- The Google initiation probe returns `INVALID_CALLBACKURL` for the requested
  production callback. Login therefore remains disabled.
- Opening the Neon dashboard through Vercel requires the user's Vercel 2FA.
  The verification tab is retained for the user; no verification code is
  requested in chat and no 2FA protection is bypassed.

Authenticated end-to-end acceptance, logout and identity ownership mapping
remain pending. No test account was created and no real history was imported.
The next storage step must use the verified stable account ID and explicit local
pairing, never a shared owner or the first visitor to the public URL.

## Verification

`npm test` in `cloud/` checks the portable authorization policy.
`JARVIS_CLOUD_TEST_URL=<origin> node tests/http-contract.mjs` checks the deployed
HTTP boundary while login is gated. With login enabled, set
`JARVIS_CLOUD_TEST_LOGIN_ENABLED=true` to verify Google initiation instead of
the setup gate. This does not replace authenticated end-to-end acceptance.

Reference implementation:
[Neon Next.js quickstart](https://neon.com/docs/auth/quick-start/nextjs-api-only)
and [server SDK](https://neon.com/docs/auth/reference/nextjs-server).
