import { authenticateDeviceFromRequest } from "../../../../lib/approvals/server";
import { parsePublishApprovalPayload } from "../../../../lib/approvals/policy.mjs";
import { ChatError } from "../../../../lib/chat/policy.mjs";
import { errorResponse, PRIVATE_HEADERS } from "../../../../lib/chat/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { device, store } = await authenticateDeviceFromRequest(request);

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new ChatError(415, "invalid_request");
    }

    const reader = request.body?.getReader();
    if (!reader) throw new ChatError(400, "invalid_request");

    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16384) {
          await reader.cancel();
          throw new ChatError(413, "payload_too_large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ChatError(400, "invalid_request");
    }

    const parsed = parsePublishApprovalPayload(body);
    const result = await store.publishApproval({
      ownerId: device.owner_id,
      deviceId: device.device_id,
      traceId: parsed.traceId,
      toolName: parsed.toolName,
      riskTier: parsed.riskTier,
      reason: parsed.reason,
      argsPreview: parsed.argsPreview,
      expiresAt: parsed.expiresAt,
    });

    return Response.json(
      { success: true, approval: result },
      { headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
