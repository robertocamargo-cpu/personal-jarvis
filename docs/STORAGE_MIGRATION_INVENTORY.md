# Storage migration inventory

2026-09-06. Local preparation for milestone 3. No cloud database has been
provisioned, no credentials copied and no local conversation uploaded.

## Existing authorities

| Domain | Source of truth / code | Classification | Migration constraint |
| --- | --- | --- | --- |
| Front-page and coding chats | `agent_chat/store.py`, `agent_chat_sessions`, `agent_chat_events` | PERSISTENT; future CLOUD | Preserve session IDs, surface, event sequence and provider session references. Add authenticated ownership before any shared cloud access. |
| Legacy conversation threads | `state/chat_store.py`, `chat_threads`, `chat_messages` | PERSISTENT; future CLOUD | Distinct schema/API from agent chat. An empty legacy endpoint does not imply lost front-page chat history. |
| Voice session telemetry | `sessions/store.py`, `sessions/schema.sql` | PERSISTENT; retention-controlled | Preserve session/turn/event relationships. Audio/transcripts require a separately defined retention policy. |
| Tasks | `tasks/schema.sql` | PERSISTENT; future CLOUD | Preserve lifecycle and execution ownership; avoid replaying a completed action on import. |
| Mission executions | `missions/event_store.py`, `missions/missions_schema.sql` | PERSISTENT; future CLOUD metadata | Keep append-only event ordering and local execution references. Local working directories cannot become cloud-executable paths. |
| Board aggregates | `board/store.py`, `board/schema.sql`, `personal.db` | PERSISTENT derived data | Rebuild from authoritative events where possible; not an independent conversation authority. |
| Core memory | `memory/core_memory.py`, `core_memory.json` | PERSISTENT; owner-scoped | Separate human facts from assistant identity; retain original data during migration. |
| Wiki/search indexes | `memory/wiki/search.py`, `memory/wiki/journal.py` | PERSISTENT source / derived index | Do not upload arbitrary local files or treat an index as its source documents. |
| Assistant identity foundation | `core/identity_repository.py`, `assistant_identity_v1` | PERSISTENT; future CLOUD | Opt-in only. New PostgreSQL adapter must pass the same owner/revision contract. |
| Runtime options | `jarvis.toml`, `core/config_writer.py` | CONFIG; LOCAL_ONLY for device options | Atomic writer remains mandatory; cloud settings must not overwrite local device configuration. |
| Provider credentials | Existing secret resolver / platform keyring | SECRET; LOCAL_ONLY by default | Never migrate into settings tables, SQL seeds, frontend bundles or diagnostics. |
| Locks, microphone state, sockets, subprocesses | Running process | TEMPORARY; LOCAL_ONLY | Recreate on startup; never restore as active work from a database snapshot. |

## Required cloud foundation before adapter activation

1. Establish the authenticated owner/tenant model and the concrete Neon project
   assigned to this application. No unrelated account/project may be reused by
   guessing from machine credentials.
2. Introduce per-domain repository adapters behind protocols, preserving local
   operation. Keep SQL inside adapters/migrations rather than API handlers.
3. Apply versioned additive PostgreSQL migrations to a disposable test branch.
4. Verify connect, CRUD, transaction rollback, reconnect, stale writes,
   concurrency and failure behavior against that real PostgreSQL service.
5. Dry-run an explicit export/import with row/event counts and ownership
   validation. Switch one domain at a time with rollback data retained.

The SQLite identity contract is implemented; it is not evidence that Neon CRUD
or PostgreSQL concurrency works. A cloud connection and an ownership boundary
have not yet been established in this project.

## Local restart evidence

After the Brazilian Portuguese browser voice follow-up, the headless dev API
returned healthy. The previously used agent chat session remained present with
12 persisted events. This proves local session retention through this restart,
not independent-chat long-term recall or cloud persistence.
