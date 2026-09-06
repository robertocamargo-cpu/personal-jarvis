# PostgreSQL foundation for identity

2026-09-06 — T2: new storage adapter implementing the existing identity
repository protocol. No runtime default, cloud connection or tenant API changed.

`jarvis/core/identity_postgres.py` implements `load` and atomic
`compare_and_swap` with Psycopg 3. A supplied connection factory owns connection
configuration and credential resolution. The adapter never reads, logs or
persists a DSN. Importing it neither imports Psycopg nor opens a connection.
The optional `postgres` package extra installs the driver when needed.

Schema initialization is explicit and additive. The v1 table stores JSONB with
owner/revision consistency constraints. SQL values are parameterized. Each
operation uses a fresh transactional connection; successful context exit commits,
failure rolls back and closes it. A stale insert/update returns false rather
than silently overwriting another writer.

## Real database evidence

The host already had PostgreSQL 15.19. An isolated temporary UTF-8 cluster was
created under a private temporary directory with only a Unix socket and no TCP
listener. Synthetic tests used random disposable schemas; no user conversations,
credentials or existing application databases were copied into it.

`tests/contract/test_identity_postgres.py` verified:

- Create, read, update and delete against real PostgreSQL.
- Persistence across fresh connections and owner isolation.
- Channel override, rename-and-restore, stale revision rejection.
- Concurrent initial inserts and concurrent updates: exactly one writer wins.
- Transaction rollback after a real constraint failure, followed by recovery.

PostgreSQL contracts plus local identity contracts and all four mandatory guard
families passed together: **541 tests**. Scoped Ruff and whitespace checks passed.
The temporary PostgreSQL server was shut down after verification.

macOS execution is verified. Windows/Linux use the same Python adapter and
optional Psycopg driver; runtime tests on those hosts remain unverified. The
contract tests skip explicitly when `JARVIS_TEST_POSTGRES_DSN` is absent.

## Neon activation remains separate

The live Jarvis still uses its local SQLite identity and existing chat stores.
No data migration or cloud deployment was performed. Before activating Neon:

1. Select a dedicated application project and authenticated owner model.
2. Supply TLS connection settings through the existing secret/config boundary.
3. Apply the explicit schema with a migration role; use restricted runtime
   credentials for reads and writes.
4. Run the same contracts on a disposable Neon branch, then verify network
   failure, suspend/resume and application-level reconnection behavior.
5. Integrate each remaining storage domain independently. The identity adapter
   does not establish PostgreSQL support for conversations, tasks or executions.

Reference: [Psycopg transaction and connection contexts](https://www.psycopg.org/psycopg3/docs/basic/transactions.html).
