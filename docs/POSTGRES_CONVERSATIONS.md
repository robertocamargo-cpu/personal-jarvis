# PostgreSQL conversation storage

## Neon adapter verification, 2026-09-06

The existing chat and identity PostgreSQL contracts ran against an isolated,
schema-only Neon branch: **11 passed in 17.25 seconds**. Each test created a
random schema containing synthetic records and removed it in fixture cleanup.
This covers chat parity, owner separation, concurrent appends, rollback,
snapshot import, interrupted migration, and identity revision conflicts.

The runner opened only the test branch endpoint. The database credential was
retrieved individually and kept in process memory; no environment export or
secret file was created. TLS used `sslmode=verify-full`, required channel
binding, and the installed Certifi CA bundle. System-root resolution alone
failed with this local Psycopg runtime; weakening certificate verification was
not needed.

Execution was on macOS against Neon PostgreSQL. Windows and Linux execution
remain unverified. These tests exercise caller-supplied synthetic owners; they
do not establish authenticated Mac/cloud pairing. The active application store
remains local SQLite, with a fresh history explicitly chosen by the user.

## Migration verification follow-up

`agent_chat/migration.py` reads a consistent SQLite transaction, including
committed WAL data, without creating or migrating the source database. It
rejects orphaned events rather than silently discarding them. Canonical SHA-256
digests compare all session metadata and ordered events without printing text.

Migration defaults to dry-run. Before writing, it checks all existing target
sessions and refuses any differing record. Explicit application imports one
conversation atomically, verifies it, and can resume after interruption by
skipping identical already-imported records. The source and destination should
be quiescent during cutover; this is not continuous replication.

Real PostgreSQL migration tests and mandatory guards: 538 passed. Tests cover
interrupted migration, idempotent retry, preflight conflict refusal and source
preservation. The pure storage protocol is platform-independent; macOS was
executed, Windows/Linux and real Neon network behavior remain unverified.

2026-09-06 — T2: optional adapter for the existing agent-chat storage surface.

`agent_chat/postgres_store.py` provides `PostgresAgentChatStore` using the existing
`AgentChatSession` and persisted event shapes. It covers creation, read/list,
metadata updates, event append, sequence polling, deletion, provider reseating
and data-migration version tracking. The active runtime remains on SQLite.

Every query is scoped by a caller-supplied authenticated owner. Composite keys
and foreign keys isolate even identical session IDs belonging to different
owners. The caller, not a request body or an incoming channel message, must
establish that owner. This is application-level isolation, not a completed cloud
authentication or database row-level-security deployment.

Each durable event append locks its session row before assigning the next
sequence number. Event insertion and session counter/preview updates commit in
one transaction. Transient streaming events are not persisted. Deleting a
session cascades only to its own events. No operation starts an LLM or tool.

## Import preparation

`import_session` accepts an explicit consistent source snapshot and preserves
session IDs, provider references, timestamps, metadata and event sequence.
Existing destination sessions cause a conflict rather than being overwritten.
A failed event rolls back the whole imported conversation. Import does not
resume a runner, replay a tool or approve a historical action.

The caller still needs a consistent source snapshot/export mechanism and a
reviewed owner mapping before production migration. No real user conversation
was copied during this work.

## Verification

Against isolated local PostgreSQL 15.19 using UTF-8 and a private Unix socket:

- Identical synthetic operations produced matching SQLite/PostgreSQL session
  objects and event lists, including Portuguese text and filtered pagination.
- Separate owners could not read, modify, append to or delete each other's
  sessions; duplicate session IDs remained isolated.
- Twelve concurrent appends produced unique ordered sequences and the correct
  message count.
- A real JSONB error rolled back the failed event without corrupting the
  session; a subsequent connection recovered the existing conversation.
- Snapshot import preserved history, refused overwrite and rolled back a
  partially processed invalid snapshot.

Initial storage/identity/mandatory guard run: **545 passed**. Final import,
conversation-core and surface-parity run: **43 passed**. Scoped Ruff and diff
whitespace checks passed. No paid provider calls were used for verification.

Only macOS database execution is verified. Windows/Linux use the same optional
Psycopg adapter; those runtimes and Neon connectivity remain unverified.

## Remaining cloud work

The dedicated Neon project, managed cloud login, TLS connection and disposable
branch adapter verification are complete. Establish authenticated installation
pairing before changing the active store. Existing snapshot migration remains
available for other installations; this installation starts with fresh history.
Tasks, execution records and remote chat/voice remain separate steps.
