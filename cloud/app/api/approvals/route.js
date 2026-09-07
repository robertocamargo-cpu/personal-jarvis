import { approvalsUserSession } from "../../../lib/approvals/server";
import { errorResponse, PRIVATE_HEADERS } from "../../../lib/chat/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { owner, store } = await approvalsUserSession();
    const approvals = await store.listApprovals(owner);
    return Response.json({ approvals }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    const code = error instanceof ChatError ? error.code : "server_error";
    const status = error instanceof ChatError ? error.status : 500;
    return Response.json(
      { error: code, detail: error?.message || String(error) },
      { status, headers: PRIVATE_HEADERS }
    );
  }
}
