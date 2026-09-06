# Dependency audit

Audited 2026-09-06 at PersonalJarvis 2.0.0,
`4c858fa8822e95e5edc9cf097889930befe9308c`.

## Manifests and installation contracts

Python: `pyproject.toml` uses setuptools, declares Python `>=3.11,<3.15`, and
contains all plugin registrations. `requirements.in`, hash-pinned
`requirements.txt`, and `uv.lock` form the dependency/lockfile surface. Install
the hashed requirements separately from editable source. `pip check` passed
after base + dev installation on macOS ARM64/Python 3.14.7.

Frontend: `jarvis/ui/web/frontend/package.json` and `package-lock.json`; use
`npm ci`. The upstream CI uses Node 22. Full tests passed only after switching
from host Node 26 to Node 22; changing application code to accommodate the newer
host is not the preferred baseline fix. Following the source audit and the
user's authorization to choose the better-supported setup, a frontend `.nvmrc`
now selects Node 22. With nvm installed, run `nvm install && nvm use` from the
frontend directory. This is a tooling selection only; the passing tests were
obtained before adding it, without modifying implementation or lockfiles.

## Runtime families

| Family | Important packages | Deployment consequence |
| --- | --- | --- |
| HTTP / validation | FastAPI, uvicorn, websockets, httpx, Pydantic 2 | Reusable for cloud HTTP; remove process-bound initialization from request path |
| LLM | anthropic, openai, google-genai, json-repair | API credentials and capability-aware fallback; do not select by package availability alone |
| MCP | `mcp>=1.28.1,<2` | Transport/auth policy; stdio children belong to local or dedicated workers |
| Storage | aiosqlite, TOML/TOMLKit, filelock | Local durability; PostgreSQL is not currently the persistence backend |
| Audio | sounddevice, aiortc, av, scipy, Vosk | Native wheels, media devices and runtime capability tests |
| Observability | structlog, loguru, OpenTelemetry, prometheus-client | Existing instrumentation; cloud export/redaction and retention still required |
| Automation | croniter, GitPython, filesystem/watch utilities | Background task ownership and writable workspace requirements |
| Web UI | React 18, TypeScript, Vite, Zustand, TanStack Query | Reuse existing views; no framework rewrite justified by this audit |
| UI heavy features | xterm, three/react-three, graph libraries, shiki | Native-terminal boundary and significant bundle weight |

Observed Python resolved versions include FastAPI 0.138.2, uvicorn 0.52.4,
Pydantic 2.13.4, mcp 1.28.1 and aiosqlite 0.22.1. These are this installation's
results; the manifests remain authoritative for reproducing the environment.

## Optional extras and platform limits

`dev` expands desktop + local-voice plus test/type/lint/build tooling. `full`
also includes macOS desktop integration, telephony and channels. `telephony`
adds Twilio; `channels` adds Discord; Telegram is a base dependency. Keep cloud
requirements smaller than the developer/desktop set.

The manifest intentionally excludes `watchdog` and some ONNX/Whisper paths on
macOS Python 3.14. The actual wiki watcher did not start, and nine watcher tests
failed/errored. Do not defeat platform markers silently. The next environment
candidate is Python 3.11, already used by upstream CI; native audio/watcher
coverage on that environment is still to be run. Python 3.14 basic server
support is demonstrated, not full-feature parity.

`av==15.1.0` is pinned on Apple Silicon; cryptography and NumPy have explicit
platform/version branches. CUDA extras exclude macOS. External binaries such as
coding CLIs and local model servers need their own health checks; an imported
Python adapter does not prove those tools work.

## Security report

`npm audit --json` on the unmodified lockfile reported three vulnerable
transitive packages: two high, one low. No `npm audit fix` was applied during
the original baseline.

| Package | Severity | Advisory |
| --- | --- | --- |
| browserslist | high | [Unbounded query-cache growth](https://github.com/advisories/GHSA-c83g-rgw3-j3cx); [untrusted custom-stats crash/prototype write](https://github.com/advisories/GHSA-73wf-gq98-2v4g) |
| nanoid | high | [Zero-size custom-generator loop](https://github.com/advisories/GHSA-2v37-7h3g-55p8) |
| postcss-selector-parser | low | [Uncontrolled AST recursion](https://github.com/advisories/GHSA-w9m9-85wc-3x92) |

The registry reported fixes available. This is a dependency finding, not proof
of a reachable production exploit. Assess whether vulnerable paths are build-only
or shipped, update the smallest lockfile set, and rerun frontend tests/build in
a separate post-baseline commit. No exhaustive Python advisory/license scan was
performed; absence of such a report must not be described as zero vulnerabilities.

## Build and license observations

TypeScript and Vite build passed using Node 22. Vite reported large chunks
(main index approximately 1.79 MB uncompressed, WikiGraph3D approximately
1.32 MB). Lazy feature loading and a cloud UI bundle budget are preferable to
removing features without usage evidence. Browser smoke used upstream checked-in
assets; temporary build output was not substituted into them.

The project declares Apache-2.0 with `LICENSE` and `NOTICE`; frontend also
declares Apache-2.0. Retain attribution, notices and upstream history. Review
`TRADEMARK.md` and `docs/licensing.md` before public rebranding/distribution.
No legal conclusion about every transitive dependency is implied.
