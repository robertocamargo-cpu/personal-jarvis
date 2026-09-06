# Cloud migration analysis

Read-only assessment, 2026-09-06, original commit
`4c858fa8822e95e5edc9cf097889930befe9308c`. No Neon resource, migration,
Vercel project, deployment or new bridge was created.

## Preferred direction

Retain Python/FastAPI and React/Vite. Use the existing engine locally while
introducing a deliberately limited cloud API/UI and durable storage adapters.
The target can remain Vercel + Neon + authenticated Local Bridge. Do not deploy
the whole desktop launcher as a cloud request handler.

**Current platform correction:** Vercel's current documentation explicitly
supports WebSockets in beta, including FastAPI/ASGI, with Fluid compute enabled.
Connections end at the function duration limit; reconnects can land on another
instance, requiring external state and coordination. Therefore “Vercel cannot
serve WebSockets” is not a valid blanket reason to change platforms. This is
platform documentation, not a verified deployment of this fork.
[Vercel WebSockets](https://vercel.com/docs/functions/websockets), checked
2026-09-06; page updated 2026-08-10.

The Python runtime supports HTTP frameworks, but production packaging must
exclude unnecessary desktop/dev files and dependencies.
[Python runtime](https://vercel.com/docs/functions/runtimes/python).
Execution remains constrained by function limits; check the actual plan/runtime
at migration time rather than promising a perpetual worker.
[Function limits](https://vercel.com/docs/functions/limitations).

## Vercel classification

`VERCEL_OK` means a component is a reasonable deployment candidate; it does not
mean it has been deployed. `VERCEL_ADAPT` requires changes and tests.

| Component | Class | Required treatment |
| --- | --- | --- |
| Built static React assets | VERCEL_OK | Configure API origin, routing and cache policy; strip no features blindly |
| Pure schemas / protocols / name derivation / formatting | VERCEL_OK | Preserve contracts and statelessness |
| FastAPI query/command endpoints | VERCEL_ADAPT | New cloud composition root; tenant auth and external stores |
| Browser chat/event WebSocket | VERCEL_ADAPT | Verify beta availability; reconnect, replay IDs, fanout and external session ownership |
| Browser/phone media streams | VERCEL_ADAPT | Duration handling, interruptions, latency, secrets, session verification and media load tests |
| SQLite stores / JSON authoritative state | VERCEL_ADAPT | PostgreSQL adapters, migrations, transaction and concurrency semantics |
| Markdown vault / artifacts | VERCEL_ADAPT | Decide authoritative document storage, versions and local synchronization |
| API-backed LLM tools | VERCEL_ADAPT | Request budgets, credential isolation, approved tools, usage accounting |
| Remote HTTP MCP | VERCEL_ADAPT | Scoped discovery, per-tool policy, auth, bounded calls and audit |
| stdio MCP / coding CLI / PTY | LOCAL_BRIDGE | Device-scoped processes; explicit workspaces, cancellation and signed commands |
| Native microphone / speaker / wake / mouse / keyboard | LOCAL_BRIDGE | Device capability negotiation; no cloud access to arbitrary machine APIs |
| Filesystem and shell tools | LOCAL_BRIDGE | Allowlisted roots, command policy, approvals bound to exact arguments |
| In-process mission / workflow schedulers | VERCEL_ADAPT | Durable execution mechanism, leases, idempotent steps and recovery; local worker where needed |
| Desktop updater / native shell / autostart | LOCAL_BRIDGE | Exclude from cloud composition, retain for local installation |
| Obsolete curator / compatibility aliases | REMOVE (cloud composition only) | Keep local read compatibility until a separate migration proves safe removal |

## Source coupling that blocks a direct port

`WebServer` startup initializes board, skills, docs, mission/task/session stores,
wiki indexing, channels and flight recording. `launcher._run_headless` also
instantiates supervisor/chat state and starts MCP/runtime wiring. `core.paths`
uses a user-home root independently of `JARVIS_DATA_DIR`; the baseline observed
that split. This composition is designed around one installed user and machine.

The current `EventBus`, live clients, approval waiters and agent tree are
process-local. A reconnect to a different function or two active workers would
not share those objects. Moving SQLite filenames to Neon is insufficient: task
claiming, approval identity, event replay and concurrent updates need contracts.

Cloud/local connection loss must leave a task in a recoverable waiting state;
it must not silently retry a destructive action. The local endpoint needs device
registration, short-lived authorization, allowed tools/roots, exact request IDs,
replay protection and revocation. Prefer an outbound authenticated local
connection; do not open an unrestricted incoming machine port.

## Storage migration order, after baseline acceptance

1. Inventory current records and isolate all state roots. Back up local stores;
   keep the original engine runnable. Establish stable user/conversation IDs.
2. Define domain interfaces using the existing stores as behavior references.
   Introduce only needed tables: identity/settings and conversation history
   first, then tasks/executions as their semantics become explicit.
3. Test Postgres adapters against local-store behavior. Translate FTS5/BM25,
   SQLite PRAGMAs, transactions and migration history deliberately. No raw SQL
   spread across route handlers.
4. Establish staging data migration with counts, content checksums, reconciliation,
   rollback compatibility and a controlled cutover. Avoid uncontrolled dual writes.
5. Add durable task/approval/event handling before claiming cross-channel continuity
   or running more than one worker instance.

Required database tests: connect, CRUD, transactions, rollback, reconnect,
concurrency, idempotency and failure recovery. Required real memory test: record
`Jarvis Alpha`, restart, ask for it through a conversation and verify provenance.
Store unit tests alone do not satisfy that test.

## Security and release gates

Cloud authentication needs user and device principals plus authorization per
resource/tool. Local loopback trust cannot become cloud trust. Keep OAuth state,
PKCE/refresh, callback allowlists and secret storage isolated from settings.
Map the existing risk engine to the desired policy; unknown MCP actions should
not default to a permissive level in the cloud.

Before staging: complete original baseline, decide the known test failures,
review dependency advisories, prove cloud-safe imports and file boundaries,
and introduce preview health checks that distinguish process, stores, providers
and workers. Before production: authenticated E2E, reconnect/replay, approval
rejection/expiry, device-offline recovery, cost limits and rollback drills.

If real workload tests later show the engine needs uninterrupted process
ownership, a dedicated worker service is a compatible option behind the same
Vercel UI/API. No vendor switch is selected without that evidence. The current
best option is incremental reuse, not a full rewrite or premature infrastructure.
