import { redirect } from "next/navigation";
import { getAuth } from "../../lib/auth/server";
import { accountFromSession } from "../../lib/auth/config.mjs";
import { chatConfiguration, requireChatAccount } from "../../lib/chat/policy.mjs";
import { Chat } from "./chat";
export const dynamic = "force-dynamic";
export default async function ChatPage() {
  const auth = getAuth();
  if (!auth) redirect("/entrar");
  const { data, error } = await auth.getSession();
  if (error) return <><h1>Sessão indisponível</h1><p>Tente novamente em alguns instantes.</p></>;
  const account = accountFromSession(data);
  if (!account) redirect("/entrar");
  try { requireChatAccount(account, chatConfiguration()); }
  catch { return <><h1>Seu chat está em preparação</h1><p>A conversa será liberada para sua conta após a configuração. <a href="/conta">Voltar à conta</a></p></>; }
  return <Chat />;
}
