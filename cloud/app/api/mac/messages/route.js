import { macChatUserSession } from "../../../../lib/mac_chat/server";
import { mutationOriginAllowed } from "../../../../lib/auth/config.mjs";
import { ChatError } from "../../../../lib/chat/policy.mjs";
import { PRIVATE_HEADERS } from "../../../../lib/chat/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!mutationOriginAllowed(request)) {
      throw new ChatError(403, "origin_denied");
    }

    const { owner, store } = await macChatUserSession();

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new ChatError(415, "invalid_request");
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.text || !body.text.trim()) {
      throw new ChatError(400, "invalid_message");
    }

    const conversationId = String(body.conversationId || crypto.randomUUID());
    const requestId = String(body.requestId || crypto.randomUUID());
    const userText = String(body.text).trim().slice(0, 4000);

    const enqueued = await store.enqueueMessage({
      ownerId: owner,
      conversationId,
      requestId,
      userText,
    });

    return Response.json(
      { success: true, message: enqueued },
      { headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    const code = error instanceof ChatError ? error.code : "server_error";
    const status = error instanceof ChatError ? error.status : 500;
    return Response.json(
      { error: code, detail: error?.message || String(error) },
      { status, headers: PRIVATE_HEADERS }
    );
  }
}

export async function GET(request) {
  try {
    const { owner, store } = await macChatUserSession();
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      throw new ChatError(400, "missing_request_id");
    }

    const msg = await store.getMessageStatus(owner, conversationId, requestId);

    return Response.json(
      { success: true, message: msg },
      { headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    const code = error instanceof ChatError ? error.code : "server_error";
    const status = error instanceof ChatError ? error.status : 500;
    return Response.json(
      { error: code, detail: error?.message || String(error) },
      { status, headers: PRIVATE_HEADERS }
    );
  }
}
