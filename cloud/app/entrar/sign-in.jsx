"use client";
import { useState } from "react";
import { authClient } from "../../lib/auth/client";

export function SignIn({ available }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}/conta` });
      if (result.error) {
        setError("Não foi possível abrir o login agora. Tente novamente em alguns instantes.");
        setBusy(false);
      }
    } catch {
      setError("Não foi possível conectar ao serviço de entrada. Confira sua conexão e tente novamente.");
      setBusy(false);
    }
  }
  return <section className="login-card">
    {available ? <button onClick={signIn} disabled={busy}>{busy ? "Abrindo o Google…" : "Continuar com Google"}</button> : <p role="status">A entrada com Google está em configuração. O acesso será liberado quando a conexão estiver verificada.</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
