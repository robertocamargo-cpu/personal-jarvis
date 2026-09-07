import { pushUserSession } from "../../../../lib/push/server";
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

    const { owner, store } = await pushUserSession();

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new ChatError(415, "invalid_request");
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.subscription || !body.subscription.endpoint) {
      throw new ChatError(400, "invalid_subscription");
    }

    const userAgent = request.headers.get("user-agent") || "";
    const saved = await store.saveSubscription(owner, body.subscription, userAgent);

    return Response.json(
      { success: true, id: saved.id },
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
