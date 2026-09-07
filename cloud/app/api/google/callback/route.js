import { cookies } from "next/headers";
import { googleSession } from "../../../../lib/google/server";
import { COOKIE, stateMatches, digest } from "../../../../lib/google/policy.mjs";
import { exchange, identity, validateGrant } from "../../../../lib/google/provider.mjs";
import { ChatError } from "../../../../lib/chat/policy.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  let outcome = "failed";
  const jar = await cookies();
  try {
    const query = new URL(request.url).searchParams;
    if (!stateMatches(query.get("state"),jar.get(COOKIE)?.value)) throw new ChatError(400,"invalid_state");
    const { owner, account, config, store } = await googleSession();
    const flow = await store.consume(owner,digest(query.get("state")));
    if (query.has("error")) throw new ChatError(400,"consent_denied");
    const code = query.get("code");
    if (!code || code.length>4096) throw new ChatError(400,"invalid_code");
    const token = await exchange(config,code,flow.verifier);
    const user = await identity(token.access_token);
    const scopes = validateGrant(token,user,account);
    await store.finish(owner,flow.version,token,user.email,scopes);
    outcome = "connected";
  } catch(error) {
    // Callback codes, tokens, emails and upstream bodies must not appear in logs.
    console.error("Google connection failed",error instanceof ChatError ? error.code : "transport_or_storage");
    if (error instanceof ChatError && ["account_mismatch","consent_denied"].includes(error.code)) outcome=error.code;
  }
  jar.set(COOKIE,"",{ httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0 });
  return new Response(null,{ status:303,headers:{ Location:`https://jarvis-bob.vercel.app/integracoes?google=${outcome}`,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer" } });
}
