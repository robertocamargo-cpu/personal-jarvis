import { getVapidKeys } from "../../../../lib/push/keys.mjs";
import { PRIVATE_HEADERS } from "../../../../lib/chat/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { publicKey } = getVapidKeys();
  return Response.json({ publicKey }, { headers: PRIVATE_HEADERS });
}
