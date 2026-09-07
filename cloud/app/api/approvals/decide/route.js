import { approvalsUserSession } from "../../../../lib/approvals/server";
import { parseDecisionPayload } from "../../../../lib/approvals/policy.mjs";
import { mutationOriginAllowed } from "../../../../lib/auth/config.mjs";
import { ChatError } from "../../../../lib/chat/policy.mjs";
import { errorResponse, PRIVATE_HEADERS } from "../../../../lib/chat/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!mutationOriginAllowed(request)) {
      throw new ChatError(403, "origin_denied");
    }

    const { owner, email, store } = await approvalsUserSession();

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new ChatError(415, "invalid_request");
    }

    const body = await request.json().catch(() => null);
    const parsed = parseDecisionPayload(body);

    const result = await store.decideApproval({
      ownerId: owner,
      traceId: parsed.traceId,
      decision: parsed.decision,
      decisionBy: email,
      reason: parsed.reason,
    });

    return Response.json(
      { success: true, approval: result },
      { headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
