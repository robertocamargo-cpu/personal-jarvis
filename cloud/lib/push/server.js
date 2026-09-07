import "server-only";
import { getAuth } from "../auth/server";
import { accountFromSession } from "../auth/config.mjs";
import { ChatError } from "../chat/policy.mjs";
import { createPool } from "../chat/store.mjs";
import { get_secret } from "../secrets.mjs";
import { PushStore } from "./store.mjs";

let pool;
let pushStore;

function resolveDatabase(env = process.env) {
  const database = get_secret("DATABASE_URL", env);
  if (!database) throw new ChatError(503, "database_missing");
  return database;
}

export function getPushStore() {
  if (!pushStore) {
    pool ||= createPool(resolveDatabase());
    pushStore = new PushStore(pool);
  }
  return pushStore;
}

export async function pushUserSession() {
  const auth = getAuth();
  if (!auth) throw new ChatError(503, "auth_unavailable");

  const { data, error } = await auth.getSession();
  if (error || !data) throw new ChatError(401, "unauthorized");

  const account = accountFromSession(data);
  if (!account) throw new ChatError(401, "unauthorized");

  const store = getPushStore();
  return { owner: account.id, email: account.email, store };
}
