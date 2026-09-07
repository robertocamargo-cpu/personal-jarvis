"use client";

import { useState, useEffect, useCallback } from "react";

function formatRemaining(expiresAt) {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "Expirado";
  const secs = Math.ceil(diffMs / 1000);
  if (secs < 60) return `${secs}s restantes`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s restantes`;
}

export function ApprovalsList() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const loadApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
        setErrorMsg("");
      } else if (res.status === 401) {
        window.location.href = "/entrar";
      }
    } catch (err) {
      console.error("Erro ao sincronizar aprovações:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
    const interval = setInterval(loadApprovals, 2500);
    return () => clearInterval(interval);
  }, [loadApprovals]);

  const handleDecision = async (traceId, decision) => {
    setActing(traceId);
    setErrorMsg("");
    try {
      const res = await fetch("/api/approvals/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace_id: traceId, decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.detail || data.error || "Não foi possível registrar a decisão.");
      } else {
        await loadApprovals();
      }
    } catch (err) {
      setErrorMsg("Falha na conexão ao enviar decisão.");
    } finally {
      setActing(null);
    }
  };

  const pendingList = approvals.filter((a) => a.status === "pending" && new Date(a.expires_at) > new Date());
  const historyList = approvals.filter((a) => a.status !== "pending" || new Date(a.expires_at) <= new Date());

  return (
    <div style={{ margin: "24px 0" }}>
      {errorMsg && (
        <div style={{ padding: "12px 16px", borderRadius: "12px", background: "rgba(179,38,30,0.1)", border: "1px solid var(--error)", color: "var(--error)", marginBottom: "20px" }}>
          {errorMsg}
        </div>
      )}

      {loading && approvals.length === 0 ? (
        <p className="muted">Buscando aprovações em tempo real...</p>
      ) : pendingList.length === 0 ? (
        <article style={{ textAlign: "center", padding: "40px 20px" }}>
          <span className="badge" style={{ borderColor: "var(--accent)" }}>Tudo limpo</span>
          <h2 style={{ fontSize: "22px", margin: "12px 0 8px" }}>Nenhuma aprovação pendente</h2>
          <p className="muted">Quando o Jarvis no Mac precisar executar uma ação sensível, o pedido aparecerá aqui instantaneamente para seu aval.</p>
        </article>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {pendingList.map((item) => (
            <article key={item.id} style={{ border: "2px solid var(--accent)", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <span className="badge" style={{ background: "rgba(35,103,71,0.15)", color: "var(--accent)" }}>
                    {item.device_name || "Mac pareado"}
                  </span>
                  <span className="badge" style={{ marginLeft: "8px", borderColor: "var(--line)" }}>
                    Risco: {item.risk_tier.toUpperCase()}
                  </span>
                </div>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)" }}>
                  ⏱ {formatRemaining(item.expires_at)}
                </span>
              </div>

              <h2 style={{ fontSize: "22px", margin: "12px 0 6px" }}>
                Executar: <code style={{ color: "var(--accent)" }}>{item.tool_name}</code>
              </h2>

              {item.reason && (
                <p style={{ margin: "8px 0", color: "var(--text)" }}>
                  <strong>Motivo:</strong> {item.reason}
                </p>
              )}

              {item.args_preview && (
                <div style={{ margin: "14px 0" }}>
                  <p className="muted" style={{ fontSize: "13px", marginBottom: "4px" }}>Parâmetros da ferramenta:</p>
                  <pre style={{
                    background: "rgba(0,0,0,0.05)",
                    padding: "12px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    border: "1px solid var(--line)"
                  }}>
                    {item.args_preview}
                  </pre>
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
                <button
                  onClick={() => handleDecision(item.trace_id, "approve")}
                  disabled={acting === item.trace_id}
                  style={{ flex: 1, minWidth: "140px", padding: "16px", fontSize: "16px" }}
                >
                  {acting === item.trace_id ? "Processando..." : "✓ Aprovar no Mac"}
                </button>
                <button
                  onClick={() => handleDecision(item.trace_id, "deny")}
                  disabled={acting === item.trace_id}
                  className="secondary"
                  style={{ flex: 1, minWidth: "120px", padding: "16px", fontSize: "16px", borderColor: "var(--error)", color: "var(--error)" }}
                >
                  ✕ Recusar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {historyList.length > 0 && (
        <section style={{ marginTop: "44px" }}>
          <h2 style={{ fontSize: "18px", color: "var(--muted)", marginBottom: "14px" }}>Histórico Recente</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {historyList.slice(0, 8).map((item) => {
              const isApproved = item.status === "approved";
              const isDenied = item.status === "denied";
              const isExpired = item.status === "expired" || (item.status === "pending" && new Date(item.expires_at) <= new Date());
              const statusColor = isApproved ? "var(--accent)" : isDenied ? "var(--error)" : "var(--muted)";
              const statusLabel = isApproved ? "Aprovado" : isDenied ? "Recusado" : "Expirado";

              return (
                <div
                  key={item.id}
                  style={{
                    padding: "14px 18px",
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    fontSize: "14px",
                  }}
                >
                  <div>
                    <strong>{item.tool_name}</strong>
                    <span className="muted" style={{ marginLeft: "8px" }}>({item.device_name || "Mac"})</span>
                  </div>
                  <span style={{ fontWeight: "700", color: statusColor }}>
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
