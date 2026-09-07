"use client";
import { useEffect, useRef, useState } from "react";

const errors = {
  unauthorized: "Sua sessão expirou. Entre novamente.", account_not_enabled: "O chat ainda não está liberado para esta conta.",
  daily_limit: "Você atingiu os 50 envios de hoje. A cota renova à meia-noite de Brasília.",
  busy: "Já existe uma resposta em andamento. Aguarde e atualize a conversa.",
  credential_in_chat: "Não envie chaves ou senhas pelo chat. Use as configurações de credenciais.",
  provider_limit: "O Google limitou as solicitações. Aguarde antes de tentar novamente.",
  conversation_full: "Esta conversa atingiu o limite. Abra uma nova conversa.",
  request_already_used: "Este envio já foi registrado. Atualize para conferir o resultado.",
  response_blocked: "O modelo não conseguiu responder a esta solicitação.",
  invalid_message: "Revise a mensagem: envie de 1 a 4.000 caracteres.",
};
function messageFor(code) { return errors[code] || "Não foi possível concluir. Atualize a conversa antes de enviar novamente."; }
async function readJson(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "unavailable");
  return data;
}
export function Chat() {
  const [conversations, setConversations] = useState([]);
  const [current, setCurrent] = useState(null);
  const [turns, setTurns] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [budget, setBudget] = useState({ used: 0, limit: 50 });
  const [target, setTarget] = useState("cloud"); // "cloud" | "mac"
  const active = useRef(false);
  const request = useRef(null);
  const bottom = useRef(null);
  async function refreshList() {
    const data = await readJson(await fetch("/api/chat", { cache: "no-store" }));
    setConversations(data.conversations); setBudget(data.budget);
  }
  useEffect(() => {
    refreshList().catch(e => setError(messageFor(e.message))).finally(() => setLoading(false));
    return () => request.current?.abort();
  }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [turns]);
  async function open(id) {
    if (active.current) return;
    active.current = true; setLoading(true); setError("");
    try {
      const data = await readJson(await fetch(`/api/chat?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" }));
      setCurrent(id); setTurns(data.turns); setBudget(data.budget); setText("");
    } catch (e) { setError(messageFor(e.message)); }
    finally { active.current = false; setLoading(false); }
  }
  function newChat() {
    if (active.current) return;
    setCurrent(null); setTurns([]); setText(""); setError("");
  }
  async function send(event) {
    event.preventDefault();
    if (active.current || !text.trim()) return;
    active.current = true; setBusy(true); setError("");
    const id = current || crypto.randomUUID(), requestId = crypto.randomUUID(), sent = text.trim();
    setCurrent(id); setText("");
    setTurns(previous => [...previous, { request_id: requestId, user_text: sent, assistant_text: "", status: "pending", target }]);
    const update = values => setTurns(previous => previous.map(t => t.request_id === requestId ? { ...t, ...values } : t));
    const abort = new AbortController(); request.current = abort;

    if (target === "mac") {
      try {
        const response = await fetch("/api/mac/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: id, requestId, text: sent }),
          signal: abort.signal,
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || errData.error || "failed_to_send_mac");
        }

        let attempts = 0;
        while (attempts < 40) {
          await new Promise(r => setTimeout(r, 1500));
          if (abort.signal.aborted) throw new Error("interrupted");
          const statusRes = await fetch(`/api/mac/messages?conversationId=${encodeURIComponent(id)}&requestId=${encodeURIComponent(requestId)}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const msg = statusData.message;
            if (msg.status === "complete") {
              update({ status: "complete", assistant_text: msg.assistant_text, model: "Jarvis Mac" });
              break;
            }
            if (msg.status === "failed") {
              throw new Error(msg.error_message || "O Jarvis Mac falhou ao responder.");
            }
          }
          attempts++;
        }
        if (attempts >= 40) {
          throw new Error("O Jarvis Mac não respondeu a tempo (timeout de 60s). Verifique se o Mac está ligado e pareado.");
        }
      } catch (e) {
        update({ status: "failed" });
        setError(e.message || "Erro de conexão com o Mac.");
      } finally {
        active.current = false; setBusy(false); request.current = null;
      }
      return;
    }

    let answer = "", finished = false;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, requestId, text: sent }), signal: abort.signal });
      if (!response.ok) await readJson(response);
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n"); buffer = done ? "" : lines.pop();
          for (const line of lines.filter(Boolean)) {
            const item = JSON.parse(line);
            if (item.type === "delta") { answer += item.text; update({ assistant_text: answer }); }
            if (item.type === "accepted") setBudget({ used: item.used, limit: item.limit });
            if (item.type === "done") { finished = true; update({ status: "complete", estimated_usd: item.usage?.estimatedUsd, model: item.model }); }
            if (item.type === "error") throw new Error(item.error);
          }
          if (done) break;
        }
      } finally { await reader.cancel(); reader.releaseLock(); }
      if (!finished) throw new Error("interrupted");
      await refreshList();
    } catch (e) {
      if (!finished) update({ status: "failed" });
      setError(messageFor(e.message));
      refreshList().catch(() => { /* The visible error already explains the outage. */ });
    } finally { active.current = false; setBusy(false); request.current = null; }
  }
  return <section className="chat-shell">
    <div className="chat-heading"><div><p className="eyebrow">Conversa Jarvis</p><h1>Olá, eu sou o Jarvis.</h1></div><a href="/conta">Minha conta</a></div>
    <p className="muted">Converse em português pelo computador ou celular. Alterne entre o motor na nuvem e o Jarvis no seu Mac.</p>
    
    <div style={{ display: "flex", gap: "10px", margin: "14px 0 20px" }}>
      <button
        type="button"
        className={target === "cloud" ? "button" : "button secondary"}
        style={{ padding: "8px 16px", fontSize: "14px" }}
        onClick={() => setTarget("cloud")}
      >
        ☁️ Jarvis Nuvem (Gemini)
      </button>
      <button
        type="button"
        className={target === "mac" ? "button" : "button secondary"}
        style={{ padding: "8px 16px", fontSize: "14px" }}
        onClick={() => setTarget("mac")}
      >
        🖥️ Jarvis Mac (Darwin)
      </button>
    </div>

    <div className="chat-controls"><button className="secondary" disabled={busy || loading} onClick={newChat}>Nova conversa</button>
      <label>Conversas<select aria-label="Conversas" value={current || ""} disabled={busy || loading} onChange={e => e.target.value ? open(e.target.value) : newChat()}>
        <option value="">Nova conversa</option>{current && !conversations.some(c => c.id === current) && <option value={current}>Conversa atual</option>}
        {conversations.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select></label>
      <span className="muted">{target === "cloud" ? `${budget.used}/${budget.limit} envios hoje` : "Direto para o Mac"}</span>
    </div>
    <div className="chat-history" aria-label="Histórico da conversa" aria-busy={busy || loading}>
      {loading && <p role="status">Carregando conversas…</p>}
      {!loading && !turns.length && <div className="chat-empty"><h2>O que você quer resolver hoje?</h2><p>Peça ajuda para escrever, organizar uma ideia ou execute comandos no seu Mac.</p></div>}
      {turns.map(t => <div key={t.request_id} className="chat-turn">
        <article className="chat-message user-message"><strong>Você</strong><p>{t.user_text}</p></article>
        <article className="chat-message">
          <strong>{t.model === "Jarvis Mac" || t.target === "mac" ? "🖥️ Jarvis Mac" : "☁️ Jarvis"}</strong>
          <p>{t.assistant_text || (t.status === "pending" ? (t.target === "mac" ? "Enviando ao Mac e aguardando resposta…" : "Preparando resposta…") : "Resposta não concluída.")}</p>
          {t.status === "failed" && <small className="error">Envio interrompido ou falha na resposta.</small>}
          {t.status === "complete" && t.estimated_usd != null && <small className="muted">Estimativa desta resposta: US$ {Number(t.estimated_usd).toFixed(6)}</small>}
        </article>
      </div>)}<div ref={bottom} />
    </div>
    {error && <div className="chat-error" role="alert"><p>{error}</p><button className="secondary" disabled={busy || loading} onClick={() => current ? open(current) : refreshList().catch(e => setError(messageFor(e.message)))}>Atualizar</button></div>}
    <form onSubmit={send} className="chat-compose">
      <label htmlFor="chat-message">Sua mensagem {target === "mac" && <span style={{ color: "var(--accent)" }}>· Enviando para o seu Mac</span>}</label>
      <textarea id="chat-message" maxLength={4000} rows={3} value={text} onChange={e => setText(e.target.value)} disabled={busy || loading} placeholder={target === "mac" ? "Ex: status do sistema, ler arquivos, rodar comandos..." : "Escreva para o Jarvis…"} />
      <div className="chat-controls"><small className="muted">{text.length}/4.000 · Não envie senhas ou chaves de API.</small><button disabled={busy || loading || !text.trim()}>{busy ? "Processando…" : (target === "mac" ? "Enviar ao Mac" : "Enviar")}</button></div>
    </form>
    <p className="chat-note muted">Alterne facilmente entre a Nuvem e o seu Mac conectado. <a href="/consumo">Ver consumo e custos</a></p>
  </section>;
}
