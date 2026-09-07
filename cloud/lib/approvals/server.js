import "server-only";
import { getAuth } from "../auth/server";
import { accountFromSession } from "../auth/config.mjs";
import { ChatError } from "../chat/policy.mjs";
import { createPool } from "../chat/store.mjs";
import { get_secret } from "../secrets.mjs";
import { ApprovalsStore } from "./store.mjs";
import { PairingStore } from "../pairing/store.mjs";

let pool;
let approvalsStore;
let pairingStore;

function resolveDatabase(env = process.env) {
  const database = get_secret("DATABASE_URL", env);
  if (!database) throw new ChatError(503, "database_missing");
  return database;
}

function getPool() {
  if (!pool) {
    const database = resolveDatabase();
    pool = createPool(database);
  }
  return pool;
}

export function getApprovalsStore() {
  approvalsStore ||= new ApprovalsStore(getPool());
  return approvalsStore;
}

export function getPairingStore() {
  pairingStore ||= new PairingStore(getPool());
  return pairingStore;
}

export async function approvalsUserSession() {
  const auth = getAuth();
  if (!auth) throw new ChatError(503, "auth_unavailable");

  const { data, error } = await auth.getSession();
  if (error || !data) throw new ChatError(503, "session_error");

  const account = accountFromSession(data);
  if (!account) throw new ChatError(401, "unauthorized");

  const store = getApprovalsStore();
  return { owner: account.id, email: account.email, store };
}

export async function authenticateDeviceFromRequest(request) {
  const authHeader = request.headers.get("x-jarvis-device-token") || "";
  let token = authHeader.trim();

  if (!token) {
    const bearer = request.headers.get("authorization") || "";
    if (bearer.toLowerCase().startsWith("bearer ")) {
      token = bearer.slice(7).trim();
    }
  }

  if (!token) {
    throw new ChatError(401, "device_unauthorized");
  }

  const pStore = getPairingStore();
  const device = await pStore.authenticateDevice(token);

  const aStore = getApprovalsStore();
  return { device, store: aStore };
}
