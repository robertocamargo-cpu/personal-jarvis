import "server-only";
import { getAuth } from "../auth/server";
import { accountFromSession } from "../auth/config.mjs";
import { ChatError, requireChatAccount } from "../chat/policy.mjs";
import { createPool } from "../chat/store.mjs";
import { googleConfiguration } from "./policy.mjs";
import { GoogleStore } from "./store.mjs";
let store;
export async function googleSession() {
  const auth = getAuth();
  if (!auth) throw new ChatError(503,"unavailable");
  const { data, error } = await auth.getSession();
  if (error) throw new ChatError(503,"unavailable");
  const account = accountFromSession(data), config = googleConfiguration();
  const owner = requireChatAccount(account,config);
  store ||= new GoogleStore(createPool(config.database),config);
  return { owner, account, config, store };
}
