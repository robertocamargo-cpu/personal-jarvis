# Channel audit

Original PersonalJarvis 2.0.0, commit
`4c858fa8822e95e5edc9cf097889930befe9308c`; 2026-09-06.
The required future priority remains voice → phone → WhatsApp → PWA → Discord →
Telegram → email. Existing channels are not removed just because the proposed
implementation order differs.

## Existing common seam

`core/protocols.py` already defines `ChannelAdapter`. `channels/base.py` supplies
frozen `ChannelMessage` and `ChannelSession` data classes.
`channels/manager.py` discovers, starts, stops and reports adapters;
`channels/bootstrap.py` wires the manager and friend registry.
`channels/chat_bridge.py` consumes adapter inboxes and publishes user
`MessageSent` events, retaining trace identity.

Reuse this foundation before designing a new ChannelGateway. The normalized
message has session ID, kind, content, trace ID, metadata and timestamp; session
has channel name, user handle and locale. This is less than the requested
verified central user identity, attachments contract and conversation model.

## Channel status

| Channel | Implementation | Classification | Runtime verification |
| --- | --- | --- | --- |
| Voice | `speech`, `audio`, `realtime`, browser media paths | HYBRID | Source/test audit; no microphone/STT/TTS conversation tested |
| Phone | `telephony`, `contacts`, `ui/web/telephony_routes.py` | CLOUD_ADAPTABLE | Twilio media/security/session code exists; optional SDK/account not activated |
| WhatsApp | No first-class adapter identified in `channels` or entry points | UNKNOWN | Not connected; no provider selected or installed |
| Web | `channels/web.py`, `ui/web/server.py`, frontend | CLOUD_ADAPTABLE | UI, API, WebSocket welcome and ping/pong passed |
| PWA | Existing web UI is reusable | CLOUD_ADAPTABLE | No verified installability, service-worker/offline or push implementation |
| Discord | `channels/discord.py`, `DiscordConfig`, channel entry point | HYBRID | Adapter tests pass in targeted selection; no live Discord session |
| Telegram | `channels/telegram.py`, `TelegramConfig`, base package dependency | HYBRID | Adapter tests pass; no live Telegram exchange or account link validated |
| Email | Native Gmail tool exists; no common email-channel adapter identified | UNKNOWN | Gmail tool availability is not email receive/reply/thread channel support |

The development instance logged ambient channels as disabled. A later
`Telegram-Channel aktiv` log reflects manager bookkeeping and is not proof of a
bot token, live polling or delivery. No real external channel was exercised.

## Continuity gap

`ChannelChatBridge._thread_id_for` returns `telegram:<chat_id>` or a thread ID
derived from channel/session. That preserves origin-specific threads but does
not link a WhatsApp sender, phone caller, Telegram user and authenticated web user
to one person. A shared engine and vault do not prove secure cross-channel
continuity.

Introduce verified external identity links and a canonical conversation/task ID.
Store origin channel/external message ID on each message, not as the sole
conversation key. Deduplicate webhook/poll deliveries by external ID and route
replies by explicit conversation ownership. Never let a recognized sender guess
another user's task ID and inherit its context.

## Phone and notification boundaries

`telephony/security.py` validates Twilio signatures and call secrets; this
authenticates transport, not necessarily the human caller's authority over every
tool. The phone caller-trust states and cross-channel RED approval requirements
need an explicit mapping. Preserve provider-neutral name-based greetings.

Domain-specific notifications and approval bridges already exist, including
agent-chat/IDE and mission events. No verified durable NotificationRouter with
preferred channel, receipts, deduplicated retries and configured fallback was
identified. Add it over domain events rather than making each adapter own tasks.

## Recommended implementation sequence

1. After baseline/identity/storage foundations, extend the existing channel
   protocol only for concrete gaps; keep current web/Telegram/Discord adapters
   compatible with protocol tests.
2. Introduce user links, canonical conversation IDs, message IDs and trust checks
   before enabling multiple channels against private shared memory.
3. Reuse existing voice/phone providers; verify the required priority order with
   real recordings and a controlled phone account. Do not treat stubs as delivery.
4. Isolate any future WhatsApp implementation behind a replaceable provider plus
   adapter, with no private transport assumptions in the engine.
5. Add delivery, fallback and approval receipts to durable tasks, then PWA push,
   Discord/Telegram extensions and email threading as separately tested steps.

Required tests: normalization for text/audio/files; duplicate delivery; reply to
the correct origin; wrong-user and unverified-user denial; account unlink/revoke;
cross-channel task lookup; permission escalation; replayed/expired approval;
notification fallback and provider outage. Existing adapter tests do not cover
the complete requested cross-channel identity model.
