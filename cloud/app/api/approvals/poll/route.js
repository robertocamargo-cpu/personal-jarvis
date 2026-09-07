import { authenticateDeviceFromRequest } from "../../../../lib/approvals/server";
import { ChatError } from "../../../../lib/chat/policy.mjs";
import { errorResponse, PRIVATE_HEADERS } from "../../../../lib/chat/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { device, store } = await authenticateDeviceFromRequest(request);

    const { searchParams } = new URL(request.url);
    const traceId = searchParams.get("trace_id");

    if (!traceId) {
      throw new ChatError(400, "missing_trace_id");
    }

    const approval = await store.getApprovalStatus(device.device_id, traceId);

    return Response.json(
      { success: true, approval },
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
