import "server-only";
import { getAuth } from "../auth/server";
import { accountFromSession } from "../auth/config.mjs";
import { ChatError } from "../chat/policy.mjs";
import { createPool } from "../chat/store.mjs";
import { get_secret } from "../secrets.mjs";
import { PairingStore } from "./store.mjs";

let store;

function resolveDatabase(env = process.env) {
  const database = get_secret("DATABASE_URL", env);
  if (!database) throw new ChatError(503, "database_missing");
  return database;
}

export function getPublicPairingStore() {
  const database = resolveDatabase();
  store ||= new PairingStore(createPool(database));
  return { store };
}

export async function pairingSession() {
  const auth = getAuth();
  if (!auth) throw new ChatError(503, "auth_unavailable");
  const { data, error } = await auth.getSession();
  if (error) throw new ChatError(503, "session_error");
  const account = accountFromSession(data);
  if (!account) throw new ChatError(401, "unauthorized");
  const database = resolveDatabase();
  store ||= new PairingStore(createPool(database));
  return { owner: account.id, account, store };
}
