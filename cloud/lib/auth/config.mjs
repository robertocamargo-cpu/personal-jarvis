export function authConfiguration(env = process.env) {
  const baseUrl = env.NEON_AUTH_BASE_URL;
  const secret = env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.length < 32) return null;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
  } catch {
    return null;
  }
  return { baseUrl, cookies: { secret, sameSite: "lax" } };
}

export function mutationOriginAllowed(request, env = process.env) {
  const origin = request.headers.get("origin");
  const allowed = ["https://jarvis-bob.vercel.app"];
  if (env.NODE_ENV !== "production") {
    allowed.push("http://localhost:3000", "http://127.0.0.1:3000");
  }
  return origin !== null && allowed.includes(origin);
}

export function accountFromSession(session) {
  if (!session?.session || !session?.user || typeof session.user.id !== "string" || !session.user.id) return null;
  return {
    id: session.user.id,
    name: typeof session.user.name === "string" ? session.user.name : "",
    email: typeof session.user.email === "string" ? session.user.email : "",
    emailVerified: session.user.emailVerified === true,
  };
}
