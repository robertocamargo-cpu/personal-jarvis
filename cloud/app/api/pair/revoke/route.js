import { pairingSession } from "../../../../lib/pairing/server";
import { parseRevokePayload } from "../../../../lib/pairing/policy.mjs";
import { mutationOriginAllowed } from "../../../../lib/auth/config.mjs";
import { ChatError } from "../../../../lib/chat/policy.mjs";
import { errorResponse, PRIVATE_HEADERS } from "../../../../lib/chat/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!mutationOriginAllowed(request)) throw new ChatError(403, "origin_denied");
    const { owner, store } = await pairingSession();

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
        if (size > 1024) {
          await reader.cancel();
          throw new ChatError(413, "invalid_request");
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

    const { deviceId } = parseRevokePayload(body);
    const result = await store.revokeDevice(owner, deviceId);
    return Response.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
