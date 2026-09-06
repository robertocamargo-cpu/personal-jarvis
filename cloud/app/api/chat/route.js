import { chatSession } from "../../../lib/chat/server";
import { sendMessage, errorResponse, PRIVATE_HEADERS } from "../../../lib/chat/handler.mjs";
import { geminiText } from "../../../lib/chat/provider.mjs";
import { ChatError } from "../../../lib/chat/policy.mjs";
import { mutationOriginAllowed } from "../../../lib/auth/config.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request) {
  try {
    const { owner, store } = await chatSession();
    const id = new URL(request.url).searchParams.get("conversationId");
    if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new ChatError(400, "invalid_message");
    const data = id ? await store.history(owner, id) : { conversations: await store.list(owner) };
    return Response.json({ ...data, budget: await store.budget(owner) }, { headers: PRIVATE_HEADERS });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    if (!mutationOriginAllowed(request)) throw new ChatError(403, "origin_denied");
    return await sendMessage(request, { ...await chatSession(), provider: geminiText });
  } catch (error) { return errorResponse(error); }
}
