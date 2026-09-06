"use client";
import { useEffect, useState } from "react";

export function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true);
    const onPrompt = (event) => { event.preventDefault(); setPrompt(event); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    setBusy(true);
    setMessage("");
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setMessage(outcome === "accepted" ? "Instalação solicitada ao navegador. Abra o Jarvis pelo ícone criado." : "Você pode instalar mais tarde pelo menu do navegador.");
    } catch {
      setMessage("Não foi possível abrir a instalação. Use as instruções abaixo.");
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }
  if (installed) return <p className="badge" role="status">Você está usando o Jarvis como aplicativo.</p>;
  return <>
    {prompt && <button onClick={install} disabled={busy}>{busy ? "Abrindo instalação…" : "Adicionar Jarvis à tela inicial"}</button>}
    {message && <p role="status">{message}</p>}
  </>;
}
