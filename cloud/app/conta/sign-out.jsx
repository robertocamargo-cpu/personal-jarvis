"use client";
import { useState } from "react";
import { authClient } from "../../lib/auth/client";

export function SignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign-out failed");
      window.location.assign("/entrar");
    } catch {
      setError("Não foi possível sair. Tente novamente.");
      setBusy(false);
    }
  }
  return <><button className="secondary" onClick={signOut} disabled={busy}>{busy ? "Saindo…" : "Sair da conta"}</button>{error && <p role="alert">{error}</p>}</>;
}
