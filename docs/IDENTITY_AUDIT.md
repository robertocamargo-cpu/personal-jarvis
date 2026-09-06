# Identity audit

Original commit `4c858fa8822e95e5edc9cf097889930befe9308c`, 2026-09-06.
The intended public name remains **Jarvis**. No name or wake setting was changed.

## Actual name resolution

`jarvis/brain/assistant_name.py::resolve_assistant_name` derives the public name
from `trigger.wake_word.phrase`, strips trigger-prefix words and title-cases the
remaining tokens. Its fallback is `Assistant`. The default wake phrase in
`speech/wake_constants.py` is empty, not `Jarvis`.

`core/config.py::PersonaConfig` intentionally ignores the old persona name.
`core/config_writer.py::_strip_persona_name` removes that field on wake saves.
Adding only `[persona].name = "Jarvis"` would not implement independent identity.

The live `/api/settings/assistant-name` response was
`{"resolved":"Assistant","default":"Assistant"}` and Chrome displayed
`Assistant`. That is the original first-run state, not a rename performed by the
audit. The product branding remains Personal Jarvis.

## Identity surfaces

| Surface | Source | Assessment |
| --- | --- | --- |
| Stable product/engine identifiers | `core/branding.py` | Central constants already exist; preserve package, keyring, cookies, bundle IDs, files and update identity |
| Public assistant name | `brain/assistant_name.py` | Central resolver exists but is coupled to wake phrase |
| Persona prompt | `brain/persona_loader.py`, `brain/JARVIS_PERSONA.md` | Cached packaged persona + editable override; reuse invalidation instead of duplicating it |
| Core-memory persona | `memory/core_memory.py` | Default JSON still says `Jarvis` and has legacy locale/voice defaults; competing representation |
| User identity card | `brain/identity_card.py` | Distills the human user's profile, not the assistant's identity; do not repurpose it |
| Settings API | `ui/web/settings_routes.py` | Existing name and wake endpoints; independent persistent identity not present |
| UI name cache | `frontend/src/lib/assistantNameCache.ts`, `hooks/useAssistantNameSeed.ts` | Reuse cache/seed seam and propagate invalidation |
| UI derived agent brand | `frontend/src/lib/deriveAssistantName.ts`, `agentBrand.ts` | Mirrors wake/name behavior; parity tests must survive future changes |
| Phone greeting | `telephony/session.py` | Name is injected into greeting; reusable consumer, not a channel identity database |
| Channels | `channels/base.py`, adapters | Channel/session identifiers exist; separate public-name overrides not established |
| Voice selection | `core/config.py::TTSConfig`, provider settings | Separate provider/voice options already exist; preserve them when changing public name |

## Lexical inventory, not a replacement list

Reproducible scan: tracked files under `jarvis/` and `conductor/`, extensions
`.py`, `.ts`, `.tsx`, `.md`, `.html`, `.toml`, excluding `/dist/`; case-sensitive
whole-word regex `\bJarvis\b`. At the audited commit: **2,375 occurrences in 674
files**. This includes comments, docs, compatibility identifiers and runtime copy;
it is not a count of 2,375 user-visible defects. Lowercase package names and
concatenated identifiers are deliberately outside this lexical count.

Largest files: `speech/pipeline.py` (125), `core/config.py` (69),
`brain/manager.py` (68), `ui/desktop_app.py` (58), `setup/wizard.py` (46).
Review visible output and prompt consumers semantically before editing.

### Preserve

`jarvis.*` imports, PersonalJarvis product constants, compatibility aliases,
`jarvis.toml`, credential service names, cookie names, migrations, historical
events, signatures and updater identity. A global search/replace can orphan
credentials or break integrations while appearing to fix the UI.

### Eventually parameterize

Self-introduction, headings representing the assistant rather than product,
notification sender display names, greetings, channel display overrides and
generated persona identity directives. Resolve all of them from the same
effective identity. Existing history should retain the name used at the time
unless a separately designed display rule says otherwise.

## Gaps and decisions

No `AssistantIdentity`/`IdentityService` meeting the master specification was
identified. The current centralized resolver is the best compatibility seam.
Add independent identity behind it after the baseline; retain legacy wake-derived
behavior only as a migration fallback. Do not make saving a name train a wake
model, change a TTS voice or alter an engine/package identifier.

The existing default `Assistant`, core-memory `Jarvis` and empty wake phrase are
inconsistent with the requested initial Jarvis identity. Record this explicitly
now; implement an initial identity migration later, with a test proving the
public name becomes Jarvis while an existing wake phrase and voice remain intact.
The current master prohibits changing wake behavior during this first audit.

Required regression coverage: name fallback, legacy config, cache invalidation,
per-channel overrides, frontend/backend parity, greeting/persona consistency,
empty/control-character/oversized input, restart persistence, concurrent writes
and a future rename-and-restore exercise. Full plan:
[IDENTITY_MIGRATION_PLAN.md](IDENTITY_MIGRATION_PLAN.md).
