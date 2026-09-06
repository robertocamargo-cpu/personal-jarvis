import { getAuth } from "../../../../lib/auth/server";
import { mutationOriginAllowed } from "../../../../lib/auth/config.mjs";

export const dynamic = "force-dynamic";

async function handle(request, context) {
  if (request.method === "POST" && !mutationOriginAllowed(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const { path } = await context.params;
  if (path.join("/").startsWith("sign-") && path.join("/") !== "sign-out" && process.env.JARVIS_CLOUD_LOGIN_ENABLED !== "true") {
    return Response.json({ error: "Sign-in setup pending" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const auth = getAuth();
  if (!auth) return Response.json({ error: "Authentication unavailable" }, { status: 503 });
  const response = await auth.handler()[request.method](request, context);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const GET = handle;
export const POST = handle;
