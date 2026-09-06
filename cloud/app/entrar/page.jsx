import { getAuth } from "../../lib/auth/server";
import { SignIn } from "./sign-in";

export const dynamic = "force-dynamic";

export default function Login() {
  return <>
    <p className="eyebrow">Acesso pessoal</p><h1>Entre no seu Jarvis.</h1>
    <p className="intro">Use sua conta Google para identificar seu acesso. Esta entrada não conecta Gmail, Drive ou Agenda.</p>
    <SignIn available={getAuth() !== null && process.env.JARVIS_CLOUD_LOGIN_ENABLED === "true"} />
    <p className="muted">O histórico do Mac será vinculado em uma etapa posterior. Conversa e voz pelo celular ainda estão em preparação.</p>
  </>;
}
