"use client";

import { useState, useEffect } from "react";

export function DevicePairing() {
  const [pairing, setPairing] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadDevices() {
    try {
      const res = await fetch("/api/pair");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch {
      // Falha silenciosa no carregamento inicial
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  async function handleGenerateCode() {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ? `Erro: ${data.error}` : `Erro HTTP ${res.status}`);
      }
      setPairing(data);
    } catch (err) {
      setError(err.message || "Erro ao gerar código");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(deviceId) {
    if (!confirm("Tem certeza que deseja desconectar este dispositivo?")) return;
    try {
      const res = await fetch("/api/pair/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (res.ok) {
        await loadDevices();
      }
    } catch {
      alert("Erro ao desconectar dispositivo.");
    }
  }

  function handleCopy(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <article style={{ marginTop: "1.5rem" }}>
      <span className="badge">Conexão Desktop</span>
      <h2>Pareamento com o Mac</h2>
      <p>
        Conecte sua instalação do Jarvis Desktop no Mac a esta conta na nuvem para unificar
        histórico e identidade.
      </p>

      {devices.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Dispositivos Conectados:</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {devices.map((d) => (
              <li
                key={d.device_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div>
                  <strong>{d.device_name || "Dispositivo"}</strong>
                  <span style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)" }}>
                    Conectado em: {new Date(d.claimed_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <button
                  type="button"
                  className="button secondary"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                  onClick={() => handleRevoke(d.device_id)}
                >
                  Desconectar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pairing ? (
        <div
          style={{
            background: "var(--card)",
            padding: "1rem",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            marginTop: "1rem",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
            Código temporário (válido por 10 minutos):
          </p>
          <p
            style={{
              fontSize: "1.6rem",
              fontWeight: "bold",
              letterSpacing: "2px",
              margin: "0.5rem 0",
              color: "var(--accent)",
            }}
          >
            {pairing.code}
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
            No terminal do seu Mac, execute:
          </p>
          <code
            style={{
              display: "block",
              background: "rgba(0,0,0,0.3)",
              padding: "0.5rem",
              borderRadius: "4px",
              fontSize: "0.85rem",
              marginBottom: "0.75rem",
              userSelect: "all",
            }}
          >
            jarvis cloud pair {pairing.code}
          </code>
          <button
            type="button"
            className="button secondary"
            onClick={() => handleCopy(`jarvis cloud pair ${pairing.code}`)}
          >
            {copied ? "Comando Copiado!" : "Copiar Comando"}
          </button>
        </div>
      ) : (
        <p style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="button"
            onClick={handleGenerateCode}
            disabled={loading}
          >
            {loading ? "Gerando..." : "Gerar Código de Pareamento"}
          </button>
        </p>
      )}

      {error && <p style={{ color: "var(--error)", marginTop: "0.5rem" }}>{error}</p>}
    </article>
  );
}
