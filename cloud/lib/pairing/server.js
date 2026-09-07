import "server-only";
import { getAuth } from "../auth/server";
import { accountFromSession } from "../auth/config.mjs";
import { ChatError, chatConfiguration, requireChatAccount } from "../chat/policy.mjs";
import { createPool } from "../chat/store.mjs";
import { PairingStore } from "./store.mjs";

let store;

export function getPublicPairingStore() {
  const config = chatConfiguration();
  if (!config) throw new ChatError(503, "unavailable");
  store ||= new PairingStore(createPool(config.database));
  return { config, store };
}

export async function pairingSession() {
  const auth = getAuth();
  if (!auth) throw new ChatError(503, "unavailable");
  const { data, error } = await auth.getSession();
  if (error) throw new ChatError(503, "unavailable");
  const account = accountFromSession(data);
  const config = chatConfiguration();
  const owner = requireChatAccount(account, config);
  store ||= new PairingStore(createPool(config.database));
  return { owner, account, config, store };
}
