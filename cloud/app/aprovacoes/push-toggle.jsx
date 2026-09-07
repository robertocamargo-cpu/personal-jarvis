"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setSubscribed(true);
        });
      });
    }
  }, []);

  const enablePush = async () => {
    setLoading(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMessage("Permissão de notificações não concedida.");
        setLoading(false);
        return;
      }

      const keyRes = await fetch("/api/push/key");
      const { publicKey } = await keyRes.json();
      if (!publicKey) throw new Error("Chave VAPID não encontrada");

      const convertedKey = urlBase64ToUint8Array(publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      const subData = JSON.parse(JSON.stringify(sub));
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subData }),
      });

      if (!res.ok) throw new Error("Falha ao salvar subscrição no servidor");

      setSubscribed(true);
      setMessage("Notificações ativadas! Você será avisado quando o Mac pedir aprovação.");
    } catch (err) {
      console.error(err);
      setMessage("Erro ao ativar notificações: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  if (!supported) return null;

  return (
    <div style={{ margin: "16px 0 24px" }}>
      {subscribed ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--accent)" }}>
          <span>🔔 Notificações ativas neste aparelho</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" }}>
          <button
            onClick={enablePush}
            disabled={loading}
            className="button secondary"
            style={{ fontSize: "14px", padding: "10px 16px" }}
          >
            {loading ? "Ativando..." : "🔔 Ativar Notificações no Celular"}
          </button>
          <small className="muted" style={{ fontSize: "12px" }}>
            Receba alertas sonoros e vibrações no celular sempre que uma ação no Mac precisar de autorização.
          </small>
        </div>
      )}
      {message && <p style={{ fontSize: "13px", marginTop: "6px", color: "var(--accent)" }}>{message}</p>}
    </div>
  );
}
