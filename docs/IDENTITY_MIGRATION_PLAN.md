# Identity migration plan — proposed, not implemented

Follow-up 2026-09-06: the opt-in domain/repository foundation is now implemented
and tested. Runtime migration and the editable identity surface remain proposed.
See [IDENTITY_FOUNDATION.md](IDENTITY_FOUNDATION.md) for exact scope and evidence.

Evidence date: 2026-09-06. Reference commit:
`4c858fa8822e95e5edc9cf097889930befe9308c`.

The public name remains **Jarvis** as the project requirement. The original
first-run fallback is `Assistant`; changing that behavior is a future isolated
implementation, not an audit side effect. Do not begin while the original
baseline's real LLM acceptance is pending.

## Design decision

Reuse `brain/assistant_name.py` as the backwards-compatible entry point into a
small identity service. Preserve `core/branding.py` as stable product/engine
identity. Add no duplicate assistant name inside channel adapters or prompts.

`IdentityCard` currently describes the human user and must stay separate. Voice
provider/voice ID and wake model configuration also remain separate concerns.

The service should depend on an identity repository protocol. Before Neon is
introduced, a versioned local adapter can preserve standalone operation. When
the Neon milestone is accepted, a Postgres adapter can become authoritative for
cloud/user identity. Do not create the entire proposed database in this step.

## Effective identity and ownership

Conceptual identity fields: ID, owner user ID, name/display name/short name,
channel overrides, greeting, avatar, language/timezone, timestamps and revision.
Keep references to voice/wake preferences distinct from proof of applied engine
state. Initial project name fields should resolve to Jarvis; the user's existing
wake phrase and voice must remain intact during migration.

Resolution after migration: authorized channel override → stored identity →
documented environment default → Jarvis. For old installations without a
migration record, retain the old wake-derived resolver until the migration is
explicitly applied. Otherwise simply loading the new package would rename
existing installations unexpectedly.

Validate names as display text (length, whitespace and control characters), not
executable code or system-prompt instructions. Treat identity settings as data;
authorize updates by owner/admin. A channel adapter must not be able to change
the global identity by receiving an untrusted incoming message.

## Incremental changes and files

| Step | Files / seam | Change | Verification |
| --- | --- | --- | --- |
| 1 | New `core/identity.py` plus repository protocol/local adapter | Typed identity, validation, effective-name precedence, revision | Pure unit tests and local persistence/reload |
| 2 | `brain/assistant_name.py` | Delegate to identity service while retaining public function signature | Legacy config and default-name tests; no import/package changes |
| 3 | `core/config.py`, `core/config_writer.py` | Explicit migration marker; stop treating new identity as obsolete persona data | Atomic concurrent writes, old TOML reads, wake-save preservation |
| 4 | `memory/core_memory.py`, `brain/persona_loader.py`, prompt consumers | Remove competing assistant identity from newly generated context, preserving user facts | Consistent self-introduction; stored knowledge and custom persona survive |
| 5 | `ui/web/settings_routes.py` and identity API schema | Read/update identity with authorization and revision checks | Wrong-user denial, invalid input, conflict and cache invalidation |
| 6 | Frontend name cache/seed/derived-brand helpers and settings view | Consume authoritative identity; stop re-deriving saved name from wake phrase | UI/API parity, two-tab refresh, no redeploy required for a name edit |
| 7 | `telephony/session.py`, existing voice/chat consumers | Inject effective identity/greeting; retain provider/voice choice | Name change leaves voice ID and wake engine unchanged |
| 8 | Existing `channels` contracts, later adapters | Channel override lookup without creating separate memory | Override precedence; shared conversation/user ownership |

These paths are a proposed change surface, not files already edited. Avoid
modifying every lexical Jarvis occurrence. Historical engine branding, packages,
keyring slots, cookies, database aliases and signatures retain compatibility.

## Tests and acceptance

1. Fresh project identity resolves to Jarvis across implemented surfaces.
2. Existing wake phrase, local voice and persona overrides survive migration.
3. Stored identity survives restart; cache invalidation reaches concurrent tabs
   and the next conversation turn without redeploy.
4. Channel override affects only that channel and does not overwrite global name.
5. Identity updates cannot change tools, permissions, shell arguments or providers.
6. Temporarily update to `TEST_NAME`, verify all implemented consumers, restore
   Jarvis. Do not claim success for unimplemented channels; mark them pending.
7. An unsupported wake change returns `REQUIRES_RECONFIGURATION`, independently
   of whether the display name was saved.
8. Local and later PostgreSQL repository adapters pass the same semantic tests,
   including stale-revision conflicts and rollback/read compatibility.

Existing regression anchors include `tests/unit/brain/test_assistant_name.py`,
`tests/unit/ui/web/test_assistant_name_route.py`, frontend
`deriveAssistantName.test.ts`, `assistantNameCache.test.ts` and
`useAssistantNameSeed.test.tsx`. Extend their contracts deliberately rather than
silencing failures after changing the source of truth.

## Rollout and rollback

Create an isolated feature branch after original baseline acceptance. Back up
existing configuration/state; apply an additive, versioned migration. Keep
compatibility reads while old and new local/cloud versions can coexist. A failed
identity write must leave the previous revision readable. Rollback must restore
the previous adapter/config interpretation without losing user facts or secrets.

Milestone 2 is limited to identity foundation. It must not also introduce Neon,
new communication channels, a new wake engine or a cloud deployment. Present its
verified behavior before the next milestone, consistent with the staged master.
