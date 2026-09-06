import test from "node:test";
import assert from "node:assert/strict";
import { authConfiguration, accountFromSession, mutationOriginAllowed } from "../lib/auth/config.mjs";

test("missing and unsafe auth configuration fails closed", () => {
  assert.equal(authConfiguration({}), null);
  for (const baseUrl of ["http://auth.example/auth", "invalid", "https://user:secret@auth.example/auth"]) {
    assert.equal(authConfiguration({ NEON_AUTH_BASE_URL: baseUrl, NEON_AUTH_COOKIE_SECRET: "x".repeat(32) }), null);
  }
  assert.equal(authConfiguration({ NEON_AUTH_BASE_URL: "https://auth.example/auth", NEON_AUTH_COOKIE_SECRET: "short" }), null);
  assert.ok(authConfiguration({ NEON_AUTH_BASE_URL: "https://auth.example/auth", NEON_AUTH_COOKIE_SECRET: "x".repeat(32) }));
});

test("production mutations reject absent, lookalike and foreign origins", () => {
  for (const origin of [null, "null", "https://evil.example", "https://jarvis-bob.vercel.app.evil.example", "http://localhost:3000"]) {
    const request = new Request("https://jarvis-bob.vercel.app/api/auth/sign-out", { headers: origin ? { origin } : {} });
    assert.equal(mutationOriginAllowed(request, { NODE_ENV: "production" }), false);
  }
  assert.equal(mutationOriginAllowed(new Request("https://jarvis-bob.vercel.app/api/auth/sign-out", { headers: { origin: "https://jarvis-bob.vercel.app" } }), { NODE_ENV: "production" }), true);
});

test("account identity comes only from the verified session and excludes tokens", () => {
  assert.equal(accountFromSession(null), null);
  assert.equal(accountFromSession({ user: { id: "owner" } }), null);
  assert.equal(accountFromSession({ session: {}, user: { id: 123 } }), null);
  assert.deepEqual(accountFromSession({ session: { token: "private" }, user: { id: "owner", email: "owner@example.com", emailVerified: true, name: "Owner", role: "admin" } }), { id: "owner", name: "Owner", email: "owner@example.com", emailVerified: true });
});
