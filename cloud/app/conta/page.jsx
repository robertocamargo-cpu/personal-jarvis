import { redirect } from "next/navigation";
import { getAuth } from "../../lib/auth/server";
import { accountFromSession } from "../../lib/auth/config.mjs";
import { SignOut } from "./sign-out";
import { DevicePairing } from "./device-pairing";

export const dynamic = "force-dynamic";

export default async function Account() {
  const auth = getAuth();
  if (!auth) redirect("/entrar");
  const { data, error } = await auth.getSession();
  if (error) return <><h1>Não foi possível verificar sua sessão.</h1><p>Tente recarregar a página em alguns instantes.</p></>;
  const account = accountFromSession(data);
  if (!account) redirect("/entrar");
  return <>
    <p className="eyebrow">Conta conectada</p><h1>Olá, {account.name || "bem-vindo"}.</h1>
    <p className="intro">Você entrou como {account.email}.</p>
    <div className="grid">
      <article><span className="badge">Conversa por texto</span><h2>Jarvis na nuvem</h2><p>Converse em português, pelo computador ou celular, sem depender do Mac.</p><p><a className="button" href="/chat">Abrir conversa</a></p></article>
      <article><span className="badge">Sua conta</span><h2>Histórico da nuvem</h2><p>As novas conversas ficam nesta conta. As conversas do Mac agora podem ser unificadas via pareamento.</p></article>
    </div>
    <DevicePairing />
    <p><a className="button" href="/aprovacoes" style={{ background: "var(--accent)", color: "var(--button-text)", display: "inline-block" }}>🛡️ Aprovações do Mac no Celular</a></p>
    <p><a className="button secondary" href="/consumo">Ver consumo e custos</a></p>
    <p><a className="button secondary" href="/integracoes">Integrações Google</a></p>
    <SignOut />
  </>;
}
