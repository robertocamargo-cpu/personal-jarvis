import { getAuth } from "../../../lib/auth/server";
import { accountFromSession } from "../../../lib/auth/config.mjs";
import { chatConfiguration, requireChatAccount } from "../../../lib/chat/policy.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const auth = getAuth();
  if (!auth) return Response.json({ error: "Authentication unavailable" }, { status: 503, headers });
  const { data, error } = await auth.getSession();
  if (error) return Response.json({ error: "Session verification failed" }, { status: 503, headers });
  const account = accountFromSession(data);
  if (!account) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  let remoteChat = false;
  try { requireChatAccount(account, chatConfiguration()); remoteChat = true; }
  catch { /* Unconfigured or unlisted accounts have no paid chat capability. */ }
  return Response.json({ account, capabilities: { remote_chat: remoteChat, remote_voice: false, local_bridge: false } }, { headers });
}
