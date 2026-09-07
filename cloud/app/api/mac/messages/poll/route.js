import { authenticateMacFromRequest } from "../../../../../lib/mac_chat/server";
import { errorResponse, PRIVATE_HEADERS } from "../../../../../lib/chat/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { device, store } = await authenticateMacFromRequest(request);
    const messages = await store.pollPendingMessages(device.device_id);

    return Response.json(
      { success: true, messages },
      { headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
