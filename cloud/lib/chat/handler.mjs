import { ChatError, LIMITS, modelContext, parseMessage, requireChatAccount } from "./policy.mjs";
import { mutationOriginAllowed } from "../auth/config.mjs";

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
export function errorResponse(error) {
  return Response.json({ error: error instanceof ChatError ? error.code : "unavailable" }, { status: error instanceof ChatError ? error.status : 503, headers: PRIVATE_HEADERS });
}
export async function sendMessage(request, { account, config, store, provider, env = process.env }) {
  if (!mutationOriginAllowed(request, env)) throw new ChatError(403, "origin_denied");
  const owner = requireChatAccount(account, config);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ChatError(415, "invalid_message");
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError(400, "invalid_message");
  const chunks = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > 24000) { await reader.cancel(); throw new ChatError(413, "message_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ChatError(400, "invalid_message"); }
  const message = parseMessage(body);
  const reservation = await store.reserve(owner, message, config.model);
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = event => { if (!closed) { try { controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); } catch { closed = true; abort.abort(); } } };
      const timeout = setTimeout(() => abort.abort(), 35000);
      const disconnect = () => abort.abort();
      request.signal.addEventListener("abort", disconnect, { once: true });
      if (request.signal.aborted) abort.abort();
      try {
        if (reservation.replay) {
          emit({ type: "delta", text: reservation.replay.assistant_text });
          emit({ type: "done", replay: true, model: reservation.replay.model });
        } else {
          if (abort.signal.aborted) throw new ChatError(499, "interrupted");
          emit({ type: "accepted", used: reservation.used, limit: LIMITS.daily });
          let answer = "", usage = { input: 0, output: 0, estimatedUsd: 0 };
          for await (const event of provider({ key: config.key, model: config.model, contents: modelContext(reservation.turns, message.text), signal: abort.signal })) {
            if (event.type === "delta") { answer += event.text; emit(event); }
            if (event.type === "usage") usage = event.usage;
          }
          if (!answer || abort.signal.aborted) throw new ChatError(502, "incomplete_response");
          await store.complete(owner, message.requestId, answer, usage);
          emit({ type: "done", model: config.model, usage });
        }
      } catch (error) {
        // Never log prompts, provider bodies, credentials or session identities.
        console.error("Cloud chat turn failed", error instanceof ChatError ? error.code : "transport_or_storage");
        if (!reservation.replay) {
          try { await store.fail(owner, message.requestId); }
          catch { console.error("Cloud chat failure state could not be persisted"); }
        }
        emit({ type: "error", error: error instanceof ChatError ? error.code : "interrupted" });
      } finally {
        clearTimeout(timeout); request.signal.removeEventListener("abort", disconnect);
        if (!closed) { try { controller.close(); } catch { /* Consumer already canceled. */ } }
      }
    },
    cancel() { abort.abort(); },
  });
  return new Response(stream, { headers: { ...PRIVATE_HEADERS, "Content-Type": "application/x-ndjson; charset=utf-8", "X-Content-Type-Options": "nosniff" } });
}
