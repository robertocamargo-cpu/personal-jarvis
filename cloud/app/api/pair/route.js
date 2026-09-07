import { pairingSession } from "../../../lib/pairing/server";
import { mutationOriginAllowed } from "../../../lib/auth/config.mjs";
import { ChatError } from "../../../lib/chat/policy.mjs";
import { errorResponse, PRIVATE_HEADERS } from "../../../lib/chat/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { owner, store } = await pairingSession();
    const devices = await store.listDevices(owner);
    return Response.json({ devices }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    if (!mutationOriginAllowed(request)) throw new ChatError(403, "origin_denied");
    const { owner, store } = await pairingSession();
    const pairing = await store.createPairing(owner);
    return Response.json(pairing, { headers: PRIVATE_HEADERS });
  } catch (error) {
    const code = error instanceof ChatError ? error.code : "database_error";
    const status = error instanceof ChatError ? error.status : 500;
    return Response.json(
      { error: code, detail: error?.message || String(error) },
      { status, headers: PRIVATE_HEADERS }
    );
  }
}
