import "server-only";
import { getAuth } from "../auth/server";
import { accountFromSession } from "../auth/config.mjs";
import { ChatError, chatConfiguration, requireChatAccount } from "./policy.mjs";
import { ChatStore, createPool } from "./store.mjs";
let store;
export async function chatSession() {
  const auth = getAuth();
  if (!auth) throw new ChatError(503, "unavailable");
  const { data, error } = await auth.getSession();
  if (error) throw new ChatError(503, "unavailable");
  const account = accountFromSession(data);
  const config = chatConfiguration();
  const owner = requireChatAccount(account, config);
  store ||= new ChatStore(createPool(config.database));
  return { account, config, owner, store };
}
