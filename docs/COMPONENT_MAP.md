# Component map

Source: PersonalJarvis 2.0.0, commit
`4c858fa8822e95e5edc9cf097889930befe9308c`; audited 2026-09-06.
All 36 requested audit areas are mapped below. A classification is an engineering
assessment of the current implementation, not certification of a cloud deploy.

`LOCAL_ONLY`: needs this machine or local durable files. `CLOUD_READY`: a
stateless/configurable component can be reused in cloud without changing its
basic responsibility. `CLOUD_ADAPTABLE`: existing coupling needs work. `HYBRID`:
spans remote and local components. `DEPRECATED`: legacy/read-compat path.
`UNKNOWN`: absent/unverified contract; not an assertion that no related code exists.

| # | Area | Code evidence | Classification | Current finding / next seam |
| --- | --- | --- | --- | --- |
| 1 | Architecture | `core/protocols.py`, `core/bus.py`, `ui/web/server.py` | HYBRID | Typed protocols/events already provide core seams |
| 2 | Frontend | `ui/web/frontend`, `ui/web/dist` | CLOUD_ADAPTABLE | React/Vite build passes; URLs, auth and native-only features need cloud treatment |
| 3 | Backend | `ui/web/launcher.py`, `ui/web/server.py` | CLOUD_ADAPTABLE | Real headless boot works; starts local stores and background services |
| 4 | APIs | `ui/web/*routes.py` | CLOUD_ADAPTABLE | Separate query/command endpoints from desktop/admin/process operations |
| 5 | WebSockets | `server.py`, `missions_ws_routes.py`, `agent_chat_routes.py` | CLOUD_ADAPTABLE | Real `/ws` works; external session state, replay and reconnect required |
| 6 | Agents | `agents/registry.py`, `missions/manager.py` | HYBRID | UI tree is in RAM; mission workers have durable local state |
| 7 | Skills | `skills/registry.py`, `skills/authoring`, built-ins | HYBRID | 30 discovered; filesystem, draft approvals and execution context remain relevant |
| 8 | Tools | `plugins/tool`, `safety/tool_executor.py` | HYBRID | 78 runtime catalog entries; individual execution readiness not proven |
| 9 | Plugins | `core/registry.py`, `marketplace` | HYBRID | Python entry points plus OAuth/native/MCP marketplace integrations |
| 10 | MCP | `mcp/registry.py`, `client.py`, `adapter.py`, `loader.py` | HYBRID | stdio/HTTP/SSE specs; runtime empty; permission scoping needs strengthening |
| 11 | Memory | `memory/recall.py`, `core_memory.py`, `memory/wiki` | CLOUD_ADAPTABLE | JSON + SQLite FTS + Markdown; no central distributed store |
| 12 | Voice | `speech/pipeline.py`, `audio`, `realtime` | HYBRID | Native classic pipeline and remote/browser realtime paths already exist |
| 13 | Wake word | `speech/wake_constants.py`, `wake_phrase.py`, `plugins/wake` | LOCAL_ONLY | Configurable phrase; empty default; optional model capabilities vary by OS/Python |
| 14 | Computer use | `cu`, `plugins/tool/computer_use_tool.py`, `platform` | LOCAL_ONLY | Must remain device-scoped; no desktop tests performed |
| 15 | Filesystem | `agent_chat/folder_tools.py`, `missions/safety/path_guard.py` | LOCAL_ONLY | Existing workspace/path guards; cloud needs device/path allowlist |
| 16 | Shell | `plugins/tool/run_shell.py`, `terminal`, `clis` | LOCAL_ONLY | Impact classification exists; irreversible/whitelist semantics require review |
| 17 | Coding agents | `missions/workers`, `plugins/brain`, `agent_chat/runner_cli.py` | HYBRID | Existing CLI/provider adapters; Antigravity/Codex/Claude sessions not live-tested |
| 18 | Authentication | `ui/web/surface_security.py`, `control_auth.py`, `missions_auth.py` | CLOUD_ADAPTABLE | Single-install control/session boundary; tenancy and devices not established |
| 19 | Storage | `core/paths.py`, domain `*store.py` | CLOUD_ADAPTABLE | More than one local root; store adapters already exist per domain |
| 20 | Database | `memory/schema.sql`, `sessions/schema.sql`, `tasks/schema.sql`, `missions/missions_schema.sql` | CLOUD_ADAPTABLE | SQLite dialect, FTS and migration semantics must be ported deliberately |
| 21 | Secrets | `core/config.py`, `core/keychain_bundle.py`, `marketplace/token_store.py` | HYBRID | OS vault/env/file fallback; isolate cloud secrets and device credentials |
| 22 | Models | `brain/manager.py`, `brain/frontier_resolver.py`, config | HYBRID | Runtime catalog/config-driven; selection is not credential readiness |
| 23 | Providers | `pyproject.toml` entry points, `realtime/factory.py` | HYBRID | 12 brain registrations, 8 STT, 8 TTS, 4 realtime; cloud APIs and local/CLI options |
| 24 | Desktop mode | `ui/desktop_app.py`, `platform`, desktop extras | LOCAL_ONLY | Native WebView shell/OS operations; not started in this baseline |
| 25 | Web mode | `ui/web/server.py`, frontend | CLOUD_ADAPTABLE | Real browser served; first-run provider/terms gate remains |
| 26 | Headless | `ui/web/launcher.py` | CLOUD_ADAPTABLE | Works locally; still uses local stores, secrets and background tasks |
| 27 | Tests | `tests`, frontend `*.test.*`, `conftest.py` | HYBRID | 1,973 Python test files; selected suites run with known failures |
| 28 | CI/CD | `.github/workflows` | CLOUD_ADAPTABLE | Node 22, backend guards; fork feature/develop push coverage needs policy |
| 29 | Configuration | `core/config.py`, `config_writer.py` | CLOUD_ADAPTABLE | Pydantic + TOML + atomic writes; device/user/global separation needed |
| 30 | Channels | `channels`, `telephony`, `agent_chat` | HYBRID | Existing web/Telegram/Discord and separate phone/voice paths; WhatsApp/email adapters not identified |
| 31 | Hardcoded Jarvis | `core/branding.py`, `memory/core_memory.py`, frontend sources | HYBRID | 2,375 case-sensitive lexical occurrences in 674 scoped text files; mixed semantics |
| 32 | Settings | `ui/web/settings_routes.py`, frontend views | CLOUD_ADAPTABLE | Live setters/cache invalidation exist; no independent AssistantIdentity entity |
| 33 | Persistence | `state/chat_store.py`, `agent_chat/store.py`, `memory`, domains | CLOUD_ADAPTABLE | Store round-trip tests pass; cross-channel conversational continuity unverified |
| 34 | Logs | `telemetry`, flight recorder, `core/paths.py` | CLOUD_ADAPTABLE | Events and trace IDs exist; durable central audit/retention needs specification |
| 35 | Automations | `workflows`, `awareness`, root `conductor` | HYBRID | Multiple scheduling domains; embedded Conductor jobs returned 503 |
| 36 | Updates | `ui/web/update_routes.py`, `core/installer_update.py`, release workflows | HYBRID | Managed-official-origin guard protects manual forks; fork release strategy pending |

Additional lifecycle classifications:

| Component | Classification | Evidence |
| --- | --- | --- |
| Legacy curator | DEPRECATED | `memory/curator`, `LegacyCuratorConfig`; soft-disabled legacy writes, old readers remain |
| Legacy persona name | DEPRECATED | `PersonaConfig` ignores it; `config_writer._strip_persona_name` removes it on wake saves |
| Legacy wake keyword/provider fields | DEPRECATED | `WakeWordConfig` retains read compatibility; current phrase/engine determine behavior |
| Shared cross-channel user identity | UNKNOWN | `ChannelSession.user_handle` and channel-derived thread IDs are not a verified user-linking model |
| Cloud/local authenticated device bridge | UNKNOWN | Local tools exist; requested independently secured Bridge has not been implemented/verified |
| NotificationRouter with durable fallback | UNKNOWN | Notifications exist in domains; requested common delivery/receipt/fallback contract not established |

The repository has 7,516 tracked files and 1,153 Python files under `jarvis/`.
The map uses entry points, route wiring, implementation reads, searches and
targeted tests; it is not a line-by-line security review of every file. Missing
external credentials, native capabilities and distributed deployment tests are
limits on conclusions, not reasons to mark those areas PASS.
