import assert from "node:assert/strict";

const base = process.env.JARVIS_CLOUD_TEST_URL;
if (!base) throw new Error("JARVIS_CLOUD_TEST_URL is required");

for (const path of ["/", "/entrar", "/status.json"]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
}
for (const cookie of ["", "__Secure-neon-auth.session_token=forged; __Secure-neon-auth.next.session_data=forged"]) {
  const response = await fetch(new URL("/api/account?owner_id=local-installation", base), { headers: { cookie } });
  assert.equal(response.status, 401, "Anonymous or forged sessions cannot read accounts");
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
}
const account = await fetch(new URL("/conta", base), { redirect: "manual" });
assert.equal(account.status, 307);
assert.equal(new URL(account.headers.get("location"), base).pathname, "/entrar");
for (const origin of [null, "https://evil.example"]) {
  const response = await fetch(new URL("/api/auth/sign-out", base), { method: "POST", headers: origin ? { origin } : {} });
  assert.equal(response.status, 403, "Cross-origin mutations are rejected");
}
const session = await fetch(new URL("/api/auth/get-session", base));
assert.equal(session.status, 200);
assert.equal(await session.json(), null);
const disabled = await fetch(new URL("/api/auth/sign-in/social", base), {
  method: "POST", headers: { origin: "https://jarvis-bob.vercel.app", "content-type": "application/json" },
  body: JSON.stringify({ provider: "google", callbackURL: "https://jarvis-bob.vercel.app/conta" }),
});
assert.equal(disabled.status, 503, "Sign-in remains disabled until callback setup is verified");
console.log("Cloud HTTP contract passed: pages, session rejection, owner parameter isolation, redirect, CSRF, anonymous session and setup gate.");
