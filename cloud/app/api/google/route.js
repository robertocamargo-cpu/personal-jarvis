import { googleSession } from "../../../lib/google/server";
import { parseOperation } from "../../../lib/google/policy.mjs";
import { readService } from "../../../lib/google/provider.mjs";
import { mutationOriginAllowed } from "../../../lib/auth/config.mjs";
import { ChatError } from "../../../lib/chat/policy.mjs";
import { errorResponse, PRIVATE_HEADERS } from "../../../lib/chat/handler.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const { owner, store } = await googleSession(); return Response.json(await store.status(owner),{headers:PRIVATE_HEADERS}); }
  catch(error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    if (!mutationOriginAllowed(request)) throw new ChatError(403,"origin_denied");
    const { owner, store } = await googleSession();
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ChatError(415,"invalid_request");
    const reader = request.body?.getReader();
    if (!reader) throw new ChatError(400,"invalid_request");
    const chunks=[]; let size=0;
    try { while(true) { const {value,done}=await reader.read(); if(done)break; size+=value.length; if(size>1024){await reader.cancel();throw new ChatError(413,"invalid_request");} chunks.push(value); } }
    finally { reader.releaseLock(); }
    let body;
    try { body=JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch {throw new ChatError(400,"invalid_request");}
    const operation=parseOperation(body);
    if(operation.operation==="disconnect") { await store.disconnect(owner); return Response.json({disconnected:true},{headers:PRIVATE_HEADERS}); }
    const access=await store.access(owner,operation.service);
    return Response.json(await readService(operation.service,access),{headers:PRIVATE_HEADERS});
  } catch(error) { return errorResponse(error); }
}
