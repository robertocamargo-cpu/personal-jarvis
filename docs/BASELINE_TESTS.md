# PersonalJarvis baseline — 2026-09-06

Status: **PARTIAL / NOT ACCEPTED**. The original server, web UI, HTTP API and
WebSocket work. A real model conversation and `JARVIS_OK` are not verified.
Do not interpret passing unit tests, a healthy HTTP endpoint, or an echo as
evidence that an LLM answered. No `baseline-personaljarvis` acceptance tag has
been created.

Change tier: T1 documentation and development-runtime selection. After the
unchanged-source audit, `.nvmrc` was added in the frontend directory to select
Node 22, matching the passing run and the user's authorization to adopt better
supported options. Application source, UI, wake phrase, database
schema, model configuration and upstream history were preserved during this
audit. This report covers the first-execution milestones 0 and 1, not the later
cloud, identity or channel implementation milestones.

## Source and environment

| Item | Observed value |
| --- | --- |
| Fork / origin | https://github.com/robertocamargo-cpu/personal-jarvis.git |
| Upstream | https://github.com/PersonalJarvis/PersonalJarvis.git |
| Version | `2.0.0` from `pyproject.toml` and live health endpoint |
| Original commit | `4c858fa8822e95e5edc9cf097889930befe9308c` |
| Commit date | 2026-08-29T20:27:24+02:00 |
| Commit subject | `test(settings): wait for the fetched silence window, not just the slider` |
| Working branch | `feature/baseline-audit`; local `main` and `develop` retain the original commit |
| OS | macOS 26.7, build 25G227, Apple Silicon |
| Python | 3.14.7, isolated `.venv` |
| Frontend runtime | Node 22 for passing tests/build; host Node 26.8.1 was also tested |
| Test date / timezone | 2026-09-06, America/Sao_Paulo |
| Mode | Original headless launcher, development instance, loopback port 18765 |
| Provider | User selected Gemini; UI plan is Pipeline with Gemini; credential absent and response unverified |
| Development editor | Work performed from Codex; Antigravity integration was inspected, not launched or certified |

The GitHub CLI initially could not access its authenticated account inside the
execution sandbox. The same read-only authentication check outside that boundary
succeeded. The fork was then created and cloned with its history intact.

## Installation

Executed in the repository root:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -m pip check
.venv/bin/python -c 'import jarvis; print(jarvis.__file__)'
```

Result: **PASS**. `pip check` returned `No broken requirements found`; the import
resolved to this checkout's `jarvis/__init__.py`.

The initial combined `pip install -e '.[dev]' -r requirements.txt` was rejected
because the requirements file enables hash verification and an editable local
project has no single archive hash. Installing the hashed requirements first,
then the editable project, resolved this without changing dependency files.
The `dev` extra includes desktop and local-voice extras; optional telephony and
Discord extras were not enabled as part of channel installation.

Frontend, from `jarvis/ui/web/frontend`:

```sh
npm ci --ignore-scripts
npx --yes --package=node@22 node node_modules/vitest/vitest.mjs run --reporter=dot
npx --yes --package=node@22 -c 'tsc -b && vite build --outDir /private/tmp/jarvis-baseline-dist --emptyOutDir'
```

The build uses the original TypeScript/Vite configuration but writes to a
temporary directory so the checked-in `jarvis/ui/web/dist` remains untouched.
The original browser smoke used the checked-in distribution. These are distinct
pieces of evidence, not a claim that the newly built output was browser-tested.

## Runtime smoke

```sh
JARVIS_INSTANCE=dev \
JARVIS_DATA_DIR=/private/tmp/jarvis-baseline-runtime \
JARVIS_CONFIG=/private/tmp/jarvis-baseline-runtime/jarvis.toml \
JARVIS_BIND_HOST=127.0.0.1 \
.venv/bin/python -m jarvis.ui.web.launcher --headless --instance dev --port 18765
```

The restricted execution sandbox denied the first socket bind. Running the same
command with the authorized local-network permission succeeded. That initial
failure was environmental, not evidence of an application startup defect.

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Startup | PASS, headless only | Original launcher remained running and served the full app |
| Frontend opens | PASS | Chrome displayed original sidebar, `DEV`, then `READY`; Voice → Chat navigation worked |
| API | PASS | `GET /api/health` returned HTTP 200 with `{"ok":true,"version":"2.0.0","instance":"dev"}` |
| WebSocket | PASS | `/ws` emitted `welcome` with version `2.0.0`; protocol ping/pong completed |
| Plugin discovery | PASS | `/api/plugins` returned all eight registered groups |
| Skill catalog | PASS, discovery only | `/api/skills`: 30 entries; does not establish every skill's execution/auth readiness |
| Tool catalog | PASS, discovery only | `/api/tools`: 78 entries, 77 native / 1 CLI / 0 MCP; catalog membership is not execution certification |
| MCP | PASS, empty runtime | `/api/mcps`: total 0, running 0, registry ready; no extra MCP installed |
| Identity | OBSERVED | `/api/settings/assistant-name` returned `Assistant` for both resolved and fallback names |
| Logs | PASS, basic emission | Startup, stores, registry scans and wiki-index reconciliation appeared in runtime logs |
| Original persistence | PASS at store level | 11 chat-store tests include recreation/round-trip; recall/core-memory tests also passed |
| LLM conversation | BLOCKED | Gemini plan selected, but the original UI shows `NO KEY` |
| `JARVIS_OK` | NOT RUN / BLOCKED | Requires a saved, usable Gemini credential and remaining onboarding steps |
| Conversational memory after restart | NOT RUN / BLOCKED | Store tests are not a substitute for the requested real conversation/restart/retrieval |
| Native desktop / microphone / speaker | NOT TESTED | Headless run deliberately does not certify native voice or desktop interaction |
| Conductor jobs | FAIL / unavailable | `GET /api/conductor/jobs` returned 503; mounted routes do not establish a wired store |
| Shutdown | PENDING | Runtime is retained for onboarding handoff; lifecycle fake tests currently fail before shutdown |

The browser first showed the terms screen. After the user explicitly authorized
accepting Terms of Use & Disclaimer v1.0, the checkbox and Continue action were
submitted. The UI confirmed `Terms accepted`. Language remains English with Auto
replies. The selected plan is `Pipeline with Gemini`; the credential panel shows
`0 OF 1 SAVED`, `Google Gemini — NO KEY` and the `Enter gemini_api_key` field.
The tab is retained for direct user credential entry. No key was entered,
displayed, requested in chat or copied into a file. API smoke checks did not
bypass onboarding to start a conversation.

### Isolation finding

`JARVIS_DATA_DIR` is not a complete sandbox. The main stores used the temporary
directory, but the original process also scanned/initialized user-level skills,
board and documentation state under `~/.jarvis`, and indexed the tracked wiki
seed under `wiki/obsidian-vault`. See `core/paths.py` versus `core/config.py`.
The development instance suppresses ambient duties, not every user-level path.
No existing user data was removed. This must be addressed before independent
instances or a cloud/local sync arrangement are treated as isolated.

## Existing tests actually executed

| Run | Result |
| --- | --- |
| Routing, output filtering, hangup parity, language, channels, security, core/recall memory, identity-card and chat identity | 763 passed, 1 warning, 9.13 s |
| MCP, skills, speech, memory, assistant-name route and headless lifecycle | 3316 passed, 6 failed, 5 errors, 1 skipped, 2 xfailed, 142.87 s |
| Chat-store persistence | 11 passed, 1 warning, 0.31 s |
| Full frontend, Node 26.8.1 | 3159 passed, 450 failed; 35 failing files |
| Full frontend, Node 22 | **3609 passed, 384 files**, 51.79 s |
| TypeScript + Vite, Node 22 | PASS; Vite build 15.16 s, large-chunk warnings |

Backend selections overlap: do not sum them as a unique-test coverage number.
The repository contains 1,973 tracked Python `test_*.py` files; this was not a
complete backend test-suite run. No Windows/Linux runtime or production CI run
is claimed.

First backend selection:

```sh
.venv/bin/python -m pytest \
  tests/unit/brain/test_routing.py tests/unit/brain/test_output_filter.py \
  tests/unit/sessions/test_hangup_reason_parity.py tests/unit/core/test_turn_language.py \
  tests/unit/channels tests/contract/test_channel_adapter.py \
  tests/contract/test_channel_adapter_contract.py \
  tests/unit/ui_web/test_surface_security.py tests/integration/test_web_surface_security.py \
  tests/unit/test_core_memory.py tests/integration/test_memory_recall.py \
  tests/unit/memory/test_message_recorder.py tests/unit/brain/test_identity_card.py \
  tests/unit/agent_chat/test_jarvis_identity.py -q --tb=short
```

Broader audit selection and persistence follow-up:

```sh
.venv/bin/python -m pytest tests/unit/mcp tests/unit/skills tests/unit/speech \
  tests/unit/memory tests/unit/brain/test_assistant_name.py \
  tests/unit/ui/web/test_assistant_name_route.py tests/integration/test_launcher_headless.py \
  -q --tb=short
.venv/bin/python -m pytest tests/unit/state/test_chat_store_persistence.py -q --tb=short
```

### Failure analysis

1. **Node mismatch:** Node 26 exposes different `localStorage` behavior; errors
   included `window.localStorage.getItem` not being a function. The unchanged
   suite passed on the upstream CI's Node 22. Use Node 22 for this baseline.
2. **Wiki watcher:** four failed tests and five fixture errors originate in
   `tests/unit/memory/wiki/test_watcher.py`, where `watcher.start()` returns false.
   The manifest excludes `watchdog` on macOS Python 3.14; the real runtime likewise
   reported its watcher inactive. Do not force-install a deliberately excluded
   native dependency just to green the test. Evaluate Python 3.11 (upstream CI)
   in a separate environment before selecting the voice-development runtime.
3. **Headless test fake drift:** both tests in
   `tests/integration/test_launcher_headless.py` fail because `_FakeBus` lacks
   `subscribe_all`, now consumed by `TurnTraceCollector`. This is not the same
   failure as the live server, which starts. The fixture also lets new startup
   side effects reach keyring/autostart; sandbox restrictions stopped those
   writes. Repair and isolate the fake in a later, separately reviewed change.
4. **Other warnings:** Starlette's httpx TestClient deprecation, coroutine warnings
   in wiki session-rollup tests, jsdom canvas warnings and large frontend chunks.
   Passing results are reported despite warnings, not as warning-free runs.

## Acceptance and continuation

Milestone 0 is **incomplete**. Milestone 1's architectural mapping is delivered
with runtime uncertainties explicitly marked. Audit before successful LLM
baseline is the only sequencing deviation: source analysis was safe to continue
while the onboarding/provider gate remained unresolved. No implementation
milestone was started to compensate for that gate.

Next: user saves the Gemini credential in the open local page, completes the
remaining original onboarding, then rerun real `JARVIS_OK`, conversational persistence
and controlled shutdown. Resolve or explicitly disposition the known upstream
test failures before accepting the baseline. Only then create and push:

```sh
git tag -a baseline-personaljarvis 4c858fa8822e95e5edc9cf097889930befe9308c \
  -m 'Original PersonalJarvis baseline; see docs/BASELINE_TESTS.md for validation'
git push origin baseline-personaljarvis
```

The tag must reference the original source commit, not an audit-document commit
or a future customized implementation. It is intentionally pending today.

Local transient logs: `/private/tmp/jarvis-baseline-install.log`,
`jarvis-dev-install.log`, `jarvis-baseline-tests.log`, `jarvis-audit-tests.log`,
`jarvis-chat-persistence-tests.log`, `jarvis-frontend-tests.log`,
`jarvis-frontend-tests-node22.log`, `jarvis-build.log`, and
`jarvis-baseline-runtime.log`. These are evidence for this machine, not portable
or committed artifacts. Do not publish raw runtime logs or credential stores.
