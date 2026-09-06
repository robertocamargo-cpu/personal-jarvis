# Voice audit

2026-09-06, original source commit
`4c858fa8822e95e5edc9cf097889930befe9308c`.
Voice implementation exists, but live audio behavior was not certified by the
headless baseline. No microphone capture, wake change, TTS output, phone call or
provider activation was performed.

## Existing pipeline

`jarvis/speech/pipeline.py` coordinates native audio, wake detection, VAD,
transcription, brain/tool execution, TTS and interruption handling.
`jarvis/audio` provides device and capture/playback/VAD components.
`jarvis/realtime` supplies a separate duplex provider interface and factory;
`realtime/factory.py` resolves installed capabilities and credentials rather than
assuming a named provider is ready.

The web UI also has browser microphone/realtime transport paths. Headless mode
can serve a remote browser without owning that browser's microphone. This does
not place native macOS devices inside the server or validate the media path.

## Providers registered in the original manifest

| Family | Entry-point IDs |
| --- | --- |
| STT | `faster-whisper`, `nemotron-local`, `groq-api`, `openrouter-stt`, `openai-api`, `gemini-api`, `deepgram-api`, `vertex-stt` |
| TTS | `piper-local`, `inworld`, `elevenlabs`, `gemini-flash-tts`, `vertex-tts`, `grok-voice`, `cartesia`, `openrouter-tts` |
| Realtime | `openai-realtime`, `gemini-live`, `vertex-live`, `local-realtime` |
| Wake registration | `openwakeword`; runtime wake planning also includes Vosk and transcript-match paths |

These lists are from `pyproject.toml`, not inferred from the machine's keys.
They describe registered implementations, not enabled subscriptions, installed
models or successful audio calls.

## Wake word and identity

`speech/wake_constants.py` defines engines `auto`, `openwakeword`, `vosk_kws`,
`stt_match`, `custom_onnx`. `core/config.py::WakeWordConfig` exposes phrase,
engine, model path and wake language. The original default phrase is empty;
the generic resolution chain can use a user ONNX model, Vosk language model,
local transcription match or honestly degrade when unavailable.

The public name is currently derived from the wake phrase. Changing the public
identity independently therefore requires the compatibility plan in
[IDENTITY_MIGRATION_PLAN.md](IDENTITY_MIGRATION_PLAN.md), not a model rename.
An independent future identity save must not claim a wake engine was updated.
When a desired wake change requires training/download/reconfiguration, report
that applied state separately from the requested setting.

Legacy wake `keyword`, `provider` and sensitivity fields remain for read
compatibility. Their presence in the configuration does not mean they control
the current runtime. Read `resolve_wake_plan` and the actual capability result.

## Interruption, failures and phone reuse

The existing speech/realtime code contains interruption, speech completeness,
barge-in and bounded failure-handling logic. `speech/pipeline.py` includes STT
retries and TTS ceilings. It should be tested and reused before adding another
voice orchestrator. No claim of measured latency, echo cancellation quality or
live barge-in success is made here.

`telephony/session.py` composes STT → brain → TTS for call media without requiring
the local sounddevice pipeline. `telephony/security.py` provides transport
signature/secret checks. This is a useful existing cloud-adaptable seam, subject
to caller authorization, stream reconnect and actual provider verification.

## Platform evidence

Python 3.14.7/macOS can boot the headless server. The original manifest excludes
some ONNX, local Whisper and watcher dependencies for this platform/version.
No usable native microphone/ONNX/Vosk language-model path was established by
these tests. Prefer testing a separate Python 3.11 environment, matching upstream
CI, before finalizing the full local voice runtime. Do not report headless PASS
as audio-device PASS.

The first-run browser displayed an unconfigured realtime provider and disabled
voice activation. This is a setup prerequisite, not evidence that the provider
protocol implementation is absent.

## Required real voice tests

| ID | Acceptance evidence |
| --- | --- |
| VOICE-001 | Chosen Jarvis wake phrase activates on real audio; false activation and silence samples recorded |
| VOICE-002 | Portuguese speech transcribes correctly with selected STT and actual microphone |
| VOICE-003 | Real provider answers the transcribed request; trace links input and response |
| VOICE-004 | Selected TTS plays intelligible audio; speaker/device failure surfaces clearly |
| VOICE-005 | Spoken public identity is Jarvis and agrees with UI/phone greeting |
| VOICE-006 | Requested versus applied wake settings are distinguished; unsupported reload reports reconfiguration |
| VOICE-007 | User speech interrupts output without echo-trigger loops; unsupported mode is explicit |
| VOICE-008 | Unplug/deny microphone yields recoverable state and preserves the task |
| VOICE-009 | Provider outage/rate limit/timeouts are bounded and fallback is credential/capability aware |

Add browser-vs-native device ownership, permission denial, reconnect, long
utterance, concurrent call and shutdown tests. Portuguese UI/reply/wake/STT
language support should be checked separately; English/German/Spanish-oriented
defaults cannot be assumed to deliver the intended Brazilian Portuguese flow.
