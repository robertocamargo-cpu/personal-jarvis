import { redirect } from "next/navigation";
import { getAuth } from "../../lib/auth/server";
import { accountFromSession } from "../../lib/auth/config.mjs";
import { SignOut } from "./sign-out";

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
      <article><span className="badge">Próxima etapa</span><h2>Seu histórico</h2><p>Vamos vincular a instalação do seu Mac a esta conta. Seu histórico local continua preservado.</p></article>
      <article><span className="badge">Em preparação</span><h2>Conversar pelo celular</h2><p>A conversa por texto, a voz e as aprovações remotas serão disponibilizadas após a conexão do assistente.</p></article>
    </div><SignOut />
  </>;
}
