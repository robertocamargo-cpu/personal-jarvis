# Assistant identity foundation

## Runtime integration follow-up

2026-09-06 (T2, existing identity surface): `core/identity_runtime.py` now offers
an explicit, idempotent local migration. The existing assistant-name resolver
and read-only settings API consume the persisted record when present. Reading
an unmigrated installation creates no files and preserves legacy wake-derived
names. Invalid storage logs a warning and retains the legacy name without
overwriting data. Database reads use SQLite read-only mode.

The dev installation was explicitly migrated to Jarvis, retaining its exact
wake preference and leaving `jarvis.toml` untouched. After restart,
`/api/settings/assistant-name` returned Jarvis and the browser displayed Jarvis.
Backend migration/name/guard tests: 558 passed. Existing frontend cache/seed
tests: 13 passed. Isolated boot window: 315 ms against an 8,000 ms budget;
native audio startup was skipped because its input/permission was unavailable.
Windows/Linux runtime remains unverified; the implementation uses the same
Python/SQLite path on all three OSes. No public rename form or cloud owner model
was introduced. `local-installation` identifies only this single-owner local
installation and must never be used as a shared cloud tenant.

The sections below describe the preceding foundation-only checkpoint.

2026-09-06 — T3: new owner-scoped repository contract. This implements the
preparatory domain/storage portion of milestone 2, not a runtime rename.

The master explicitly requests preparing the architecture before exposing a
rename setting. `core/identity.py` supplies an immutable `AssistantIdentity`
and `IdentityService`; `core/protocols.py` defines `IdentityRepository`.
`core/identity_repository.py` supplies the local SQLite implementation without
requiring Neon or a new dependency. No constructor is called during app startup.

Default identity is Jarvis with Brazilian Portuguese and America/Sao_Paulo.
Resolution is channel display override, persisted display identity, explicitly
injected `JARVIS_ASSISTANT_NAME`, then Jarvis. The service reads on each request,
so there is no cache to invalidate across processes. Wake preference is data;
reading or saving it never trains, activates or replaces a wake model.

An authenticated owner must be supplied by the eventual application boundary.
This service is not authentication and is not a public API. Names never become
tool permissions, provider settings, executable commands or system instructions.
The existing wake-derived resolver remains the runtime compatibility path until
an explicit migration and frontend/API parity integration are implemented.

SQLite uses parameterized queries, a versioned additive table, transactions,
closed per-operation connections and atomic compare-and-swap revisions. Two
writers cannot silently overwrite each other. Invalid updates leave the prior
revision readable. Another user's record cannot be updated through the service.

## Evidence

`tests/contract/test_assistant_identity.py`: 10 tests cover restart/reopen,
rename-and-restore, owner isolation, channel precedence, environment fallback,
stale writes, competing independent connections, invalid display text and
rollback preservation. The four existing mandatory guard families plus this
contract passed together: 535 tests. Scoped Ruff passed after formatting.

Only macOS execution is verified. Linux/Windows use the same Python/SQLite
implementation and contract tests, but were not executed here. Existing Gemini
one-key conversation remains the previously verified runtime path; this opt-in
foundation is not yet an end-to-end identity integration or a fresh-install
acceptance claim.

## Remaining integration

1. Explicitly migrate the existing installation, preserving its wake phrase and
   voice configuration; retain the legacy path for unmigrated installations.
2. Integrate the existing name resolver, authenticated settings API and frontend
   cache together with parity tests before exposing an editable identity.
3. Add the PostgreSQL adapter after the storage inventory and authenticated
   cloud ownership model are finalized. Do not replace existing chat stores or
   upload local data as an incidental consequence of this foundation.
