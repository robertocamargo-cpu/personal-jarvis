import { cookies } from "next/headers";
import { googleSession } from "../../../../lib/google/server";
import { authorization, COOKIE, digest } from "../../../../lib/google/policy.mjs";
import { mutationOriginAllowed } from "../../../../lib/auth/config.mjs";
import { ChatError } from "../../../../lib/chat/policy.mjs";
import { errorResponse } from "../../../../lib/chat/handler.mjs";
export const runtime = "nodejs";
export async function POST(request) {
  try {
    if (!mutationOriginAllowed(request)) throw new ChatError(403,"origin_denied");
    const { owner, account, config, store } = await googleSession();
    const flow = authorization(config,account.email);
    await store.begin(owner,digest(flow.state),flow.verifier);
    (await cookies()).set(COOKIE,flow.state,{ httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:600 });
    return new Response(null,{ status:303,headers:{ Location:flow.url,"Cache-Control":"private, no-store" } });
  } catch(error) { return errorResponse(error); }
}
