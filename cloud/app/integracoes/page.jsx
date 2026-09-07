import { redirect } from "next/navigation";
import { getAuth } from "../../lib/auth/server";
import { accountFromSession } from "../../lib/auth/config.mjs";
import { googleConfiguration } from "../../lib/google/policy.mjs";
import { requireChatAccount } from "../../lib/chat/policy.mjs";
import { Integrations } from "./integrations";
export const dynamic = "force-dynamic";
export const metadata = {title:"Integrações — Jarvis Bob"};
export default async function IntegrationsPage({searchParams}) {
  const auth=getAuth(); if(!auth)redirect("/entrar");
  const {data,error}=await auth.getSession();
  if(error)return <><h1>Sessão indisponível</h1><p>Tente novamente em alguns instantes.</p></>;
  const account=accountFromSession(data); if(!account)redirect("/entrar");
  let enabled=false;
  try { requireChatAccount(account,googleConfiguration());enabled=true; } catch { /* Setup and account restrictions remain explicit. */ }
  const outcome=(await searchParams).google;
  return <><p className="eyebrow">Sua conta</p><h1>Integrações Google</h1><p className="intro">Consulte emails, compromissos e arquivos com uma autorização separada do login do Jarvis.</p>
    {enabled ? <Integrations outcome={outcome}/> : <article><h2>Configuração em andamento</h2><p>A conexão ficará disponível após configurar o aplicativo Google do Jarvis.</p></article>}
    <p><a href="/conta">Minha conta</a> · <a href="/chat">Conversar</a></p></>;
}
