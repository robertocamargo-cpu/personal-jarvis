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
    return errorResponse(error);
  }
}
