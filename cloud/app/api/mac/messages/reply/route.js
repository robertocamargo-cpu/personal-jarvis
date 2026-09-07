import { authenticateMacFromRequest } from "../../../../../lib/mac_chat/server";
import { ChatError } from "../../../../../lib/chat/policy.mjs";
import { errorResponse, PRIVATE_HEADERS } from "../../../../../lib/chat/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { device, store } = await authenticateMacFromRequest(request);

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new ChatError(415, "invalid_request");
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.requestId) {
      throw new ChatError(400, "invalid_reply");
    }

    const replied = await store.replyMessage({
      deviceId: device.device_id,
      requestId: body.requestId,
      assistantText: body.assistantText || "",
      status: body.status || "complete",
      error: body.error || null,
    });

    return Response.json(
      { success: true, message: replied },
      { headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
