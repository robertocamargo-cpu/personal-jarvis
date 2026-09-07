# Cloud text chat

Tier T3: a new optional cloud transport, isolated from desktop boot and tools.

`/chat` uses a verified Neon Auth session and a server-side account allowlist.
It calls Gemini 2.5 Flash-Lite directly and persists text turns in PostgreSQL.
The browser never receives database credentials or the provider API key.
Conversation ownership comes from the session, not submitted JSON. Missing
configuration, an unverified email or an unlisted account denies paid access.

## Deployment

Use Node 22 and `npm ci` in `cloud/`. Apply
`cloud/migrations/001_cloud_chat.sql` through a direct PostgreSQL connection
after testing it on a disposable branch. The migration is additive and
idempotent; it does not modify desktop history or managed authentication tables.

Production environment:

- Existing Neon Auth configuration and `DATABASE_URL`.
- `GEMINI_API_KEY`, stored as a server-side secret.
- `JARVIS_CHAT_ALLOWED_EMAILS`, comma-separated verified account emails.
- `JARVIS_CLOUD_CHAT_ENABLED=true` only after schema and credentials are ready.

All runtime secrets are read through `cloud/lib/secrets.mjs::get_secret`.
Disable the feature flag and redeploy to stop new cloud chat requests without
deleting history. Do not drop the tables as a rollback procedure.

## Behavior and limits

- Brazilian Portuguese replies, streamed over same-origin authenticated HTTP.
- At most 4,000 characters per message, eight previous completed turns and
  12,000 context characters; at most 1,024 output tokens.
- Fifty reserved attempts per account per day, resetting at midnight in
  America/Sao_Paulo. Failed provider attempts still consume the reservation.
- One active generation per account. A transaction serializes reservations,
  ownership checks and quota updates; expired leases permit recovery.
- Two hundred turns per conversation; the picker lists the latest 50
  conversations. Older conversations remain stored but pagination is not yet
  exposed. There is no history deletion/export interface in this first version.
- An identical completed request can be replayed without another provider call.
  Interrupted or failed requests are never automatically retried. Completion is
  emitted only after the full reply is persisted. Partial browser text can be
  lost on disconnect and is visibly marked unconfirmed.
- The displayed model cost estimates prompt and output tokens at USD 0.10 and
  USD 0.40 per million respectively. These are estimates, not a billing ledger;
  unsuccessful provider calls may be billed without reported usage. Taxes and
  hosting are excluded. Source: the official Gemini API pricing page, checked
  on 2026-09-06: <https://ai.google.dev/gemini-api/docs/pricing>.

No browser microphone, tools, email integration, remote computer control,
background agent or local/cloud history synchronization is enabled here.
The API returns an explicit failure when Gemini is unavailable; it does not
silently switch to another provider or a more expensive model.

## Validation

`node --test tests/*.test.mjs` in `cloud/` covers policy, bounded context,
idempotent replay, streaming completion, UTF-8 chunk boundaries and failure
redaction. `tests/contract/test_cloud_chat.py` runs the portable Node contract
when Node is installed; a Python-only desktop installation remains unaffected.

Set `JARVIS_TEST_POSTGRES_DSN` to a disposable PostgreSQL branch to run
`cloud/tests/chat-postgres.test.mjs`. It creates a random synthetic schema,
applies the migration twice, checks account isolation, persistence across store
instances, concurrent reservations, quota enforcement and lease recovery, then
removes only that synthetic schema. This real test passed against a schema-only
Neon branch with full TLS verification on 2026-09-06.

The production build passed on Node 22/macOS. The Python contract plus the four
required core guards passed: 526 tests. A real one-key Flash-Lite request
returned the requested Portuguese test phrase: 89 input tokens and 6 output
tokens, estimated USD 0.0000113. Authenticated deployed acceptance is tracked
in `INSTALLATION_PROGRESS.md`. Production `94e5b1c3f` reached Vercel READY;
authenticated browser sending, saved-history selection after reload and a
follow-up requiring the earlier synthetic context all passed. Public HTTP
authorization, cross-origin rejection and PWA checks also passed. A physical
phone session and Windows execution have not been tested.
