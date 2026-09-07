import { redirect } from "next/navigation";
import { getAuth } from "../../lib/auth/server";
import { accountFromSession } from "../../lib/auth/config.mjs";
import { ApprovalsList } from "./approvals-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aprovações do Mac — Jarvis Bob",
  description: "Aprove ou recuse ações do Jarvis Desktop pelo celular.",
};

export default async function ApprovalsPage() {
  const auth = getAuth();
  if (!auth) redirect("/entrar");

  const { data, error } = await auth.getSession();
  if (error || !data) redirect("/entrar");

  const account = accountFromSession(data);
  if (!account) redirect("/entrar");

  return (
    <>
      <p className="eyebrow">Controle de Segurança</p>
      <h1>Aprovações Remotas</h1>
      <p className="intro">
        Autorize ou recuse ferramentas sensíveis disparadas pelo Jarvis no seu Mac, em tempo real pelo celular.
      </p>

      <ApprovalsList />

      <p style={{ marginTop: "32px" }}>
        <a className="button secondary" href="/conta">
          ← Voltar para a Conta
        </a>
      </p>
    </>
  );
}
