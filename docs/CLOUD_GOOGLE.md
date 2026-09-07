# Cloud Google integration

T3: optional Google OAuth web transport with authenticated, read-only service
queries. Approvals are deferred until a real integration can propose actions.
The desktop Google plugins and their local credentials are unchanged.

## Setup and capability

The existing Google sign-in identifies the Jarvis account. It does not grant
Gmail, Calendar or Drive API access. A separate OAuth web client is required.
Register this exact redirect URI:

`https://jarvis-bob.vercel.app/api/google/callback`

Enable Gmail API, Google Calendar API and Google Drive API in the chosen Google
Cloud project. Configure the consent screen and authorized test users according
to that project's publication status. The application requests `openid`, `email`,
`gmail.readonly`, `calendar.events.readonly` and `drive.metadata.readonly` using
their full Google scope URLs. Partial consent is supported: a service without
its scope remains disabled. Use the same verified email as the Jarvis login.

Apply `cloud/migrations/002_google_connections.sql` on a disposable branch first,
then production. Configure these server-side Vercel environment variables:

- `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` from the web client.
- `JARVIS_GOOGLE_TOKEN_KEY`: an independently generated 32-byte key encoded as
  64 hexadecimal characters. Store it as a secret; replacing it requires users
  to reconnect because existing ciphertext cannot be decrypted with another key.
- `JARVIS_GOOGLE_INTEGRATION_ENABLED=true` after setup.
- Existing `DATABASE_URL` and the verified account allowlist
  `JARVIS_CHAT_ALLOWED_EMAILS`.

`googleConfiguration` is the single capability probe. Missing configuration
keeps `/integracoes` in a preparation state and denies API access. No provider
API key is required to consult Google services.

## Authorization and data handling

Connect requires a verified account and a same-origin POST. OAuth uses a random
state, an HttpOnly Secure SameSite=Lax cookie, a one-use owner-bound database
state with a ten-minute lifetime, and PKCE. The callback verifies the Google
account email and stores access/refresh credentials encrypted with AES-256-GCM;
the account ID is authenticated associated data. State verifiers are encrypted
as well. Tokens and authorization codes are never returned in application JSON
or included in application logs. The callback redirects to a clean outcome URL.

Refresh is serialized by an account row lock. Disconnect clears stored tokens
and increments the connection generation, preventing an in-flight old callback
from reconnecting it. A query already sent to Google can still finish after a
disconnect; disconnection prevents subsequent credentials from being retrieved.
Disconnect removes the Jarvis copy of the grant; users may also revoke it in
their Google Account permissions. No grant is silently retried or copied from
another application, CLI or browser session.

The interface calls APIs only after an explicit consultation click:

- Gmail: up to ten unread messages from the last seven days; sender, subject
  and date. Messages are not marked read.
- Calendar: up to ten events from the primary calendar over the next seven days.
- Drive: metadata for up to ten recently modified, non-trashed files. File
  contents are not read.

Results are private/no-store and rendered as escaped text. They are not saved
as chat history or sent to Gemini. A saved grant is labeled as saved, not proof
of current API access. Live consultation is the operational success criterion.
There are no send, edit, delete, automation or remote approval actions yet.

## Validation and remaining acceptance

The pure Node tests cover encryption/account binding, tampering, CSRF state,
PKCE, read-only operations, partial consent and sanitized OAuth failures. The
real PostgreSQL test uses synthetic data in a disposable schema, checking state
expiry/replay, account isolation, disconnect/callback races and concurrent
refresh. Run with `JARVIS_TEST_POSTGRES_DSN`; the schema is removed afterward.

On 2026-09-06 these tests passed against an isolated Neon branch. The production
build and 527 Python contract/core tests also passed. Live consent, token refresh
against Google, service reads and physical-phone acceptance remain pending until
the selected account finishes Google Cloud identity verification and its OAuth
client is configured. Do not claim the services are connected from a build or
from the presence of configuration values.

Official protocol reference:
<https://developers.google.com/identity/protocols/oauth2/web-server>.
