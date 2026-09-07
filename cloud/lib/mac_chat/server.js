import "server-only";
import { getAuth } from "../auth/server";
import { accountFromSession } from "../auth/config.mjs";
import { ChatError } from "../chat/policy.mjs";
import { createPool } from "../chat/store.mjs";
import { get_secret } from "../secrets.mjs";
import { MacChatStore } from "./store.mjs";
import { PairingStore } from "../pairing/store.mjs";

let pool;
let macChatStore;
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

export function getMacChatStore() {
  macChatStore ||= new MacChatStore(getPool());
  return macChatStore;
}

export function getPairingStore() {
  pairingStore ||= new PairingStore(getPool());
  return pairingStore;
}

export async function macChatUserSession() {
  const auth = getAuth();
  if (!auth) throw new ChatError(503, "auth_unavailable");

  const { data, error } = await auth.getSession();
  if (error || !data) throw new ChatError(401, "unauthorized");

  const account = accountFromSession(data);
  if (!account) throw new ChatError(401, "unauthorized");

  const store = getMacChatStore();
  return { owner: account.id, email: account.email, store };
}

export async function authenticateMacFromRequest(request) {
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

  const mStore = getMacChatStore();
  return { device, store: mStore };
}
