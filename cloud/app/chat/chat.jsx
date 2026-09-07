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
    setTurns(previous => [...previous, { request_id: requestId, user_text: sent, assistant_text: "", status: "pending" }]);
    const update = values => setTurns(previous => previous.map(t => t.request_id === requestId ? { ...t, ...values } : t));
    const abort = new AbortController(); request.current = abort;
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
      // Do not automatically resend: the provider may already have billed this turn.
      refreshList().catch(() => { /* The visible error already explains the outage. */ });
    } finally { active.current = false; setBusy(false); request.current = null; }
  }
  return <section className="chat-shell">
    <div className="chat-heading"><div><p className="eyebrow">Conversa na nuvem</p><h1>Olá, eu sou o Jarvis.</h1></div><a href="/conta">Minha conta</a></div>
    <p className="muted">Converse em português. Suas conversas ficam na sua conta. Esta versão ainda não acessa o Mac, email ou outros serviços.</p>
    <div className="chat-controls"><button className="secondary" disabled={busy || loading} onClick={newChat}>Nova conversa</button>
      <label>Conversas<select aria-label="Conversas" value={current || ""} disabled={busy || loading} onChange={e => e.target.value ? open(e.target.value) : newChat()}>
        <option value="">Nova conversa</option>{current && !conversations.some(c => c.id === current) && <option value={current}>Conversa atual</option>}
        {conversations.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select></label>
      <span className="muted">{budget.used}/{budget.limit} envios hoje</span>
    </div>
    <div className="chat-history" aria-label="Histórico da conversa" aria-busy={busy || loading}>
      {loading && <p role="status">Carregando conversas…</p>}
      {!loading && !turns.length && <div className="chat-empty"><h2>O que você quer resolver hoje?</h2><p>Peça ajuda para escrever, organizar uma ideia ou planejar seu dia.</p></div>}
      {turns.map(t => <div key={t.request_id} className="chat-turn">
        <article className="chat-message user-message"><strong>Você</strong><p>{t.user_text}</p></article>
        <article className="chat-message"><strong>Jarvis</strong><p>{t.assistant_text || (t.status === "pending" ? "Preparando resposta…" : "Resposta não concluída.")}</p>
          {t.status === "failed" && <small className="error">Envio interrompido. O texto parcial não está confirmado como resposta salva.</small>}
          {t.status === "complete" && t.estimated_usd != null && <small className="muted">Estimativa desta resposta: US$ {Number(t.estimated_usd).toFixed(6)}</small>}
        </article>
      </div>)}<div ref={bottom} />
    </div>
    {error && <div className="chat-error" role="alert"><p>{error}</p><button className="secondary" disabled={busy || loading} onClick={() => current ? open(current) : refreshList().catch(e => setError(messageFor(e.message)))}>Atualizar</button></div>}
    <form onSubmit={send} className="chat-compose">
      <label htmlFor="chat-message">Sua mensagem</label>
      <textarea id="chat-message" maxLength={4000} rows={3} value={text} onChange={e => setText(e.target.value)} disabled={busy || loading} placeholder="Escreva para o Jarvis…" />
      <div className="chat-controls"><small className="muted">{text.length}/4.000 · Não envie senhas ou chaves de API.</small><button disabled={busy || loading || !text.trim()}>{busy ? "Respondendo…" : "Enviar"}</button></div>
    </form>
    <p className="chat-note muted">Gemini 2.5 Flash-Lite · Respostas concisas · Contexto recente limitado para economizar. Estimativas em dólar, sem impostos; a cobrança oficial é a do Google. <a href="/consumo">Ver consumo e custos</a></p>
  </section>;
}
