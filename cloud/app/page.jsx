export default function Home() {
  return <>
    <p className="eyebrow">Seu assistente pessoal</p>
    <h1>Converse com o Jarvis, onde estiver.</h1>
    <p className="intro">Seu assistente em português brasileiro, pelo computador ou celular. Converse na nuvem, controle o Jarvis Mac ou aprove ações remotamente.</p>
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", margin: "24px 0" }}>
      <a className="button" href="/chat">Abrir Chat</a>
      <a className="button" href="/aprovacoes" style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)" }}>🛡️ Aprovações Remotas</a>
      <a className="button secondary" href="/entrar">Entrar no Jarvis</a>
    </div>
    <div className="grid">
      <article>
        <span className="badge">Chat Bidirecional</span>
        <h2>Nuvem ou Mac (Darwin)</h2>
        <p>Alterne entre a IA na nuvem (Gemini) ou envie comandos diretamente para o Jarvis rodando no seu Mac pelo celular.</p>
        <p style={{ marginTop: "14px" }}><a href="/chat">Ir para o Chat →</a></p>
      </article>
      <article>
        <span className="badge">Segurança & Controle</span>
        <h2>Aprovações Remotas</h2>
        <p>Receba notificações push nativas no celular sempre que o Jarvis no Mac precisar de autorização para executar comandos ou ações.</p>
        <p style={{ marginTop: "14px" }}><a href="/aprovacoes">Ver Aprovações →</a></p>
      </article>
    </div>
  </>;
}
