export default function Home() {
  return <>
    <p className="eyebrow">Seu assistente pessoal</p>
    <h1>Converse com o Jarvis, onde estiver.</h1>
    <p className="intro">Seu assistente em português brasileiro, pelo computador ou celular. Entre para acessar as conversas da sua conta.</p>
    <a className="button" href="/entrar">Entrar no Jarvis</a>
    <div className="grid">
      <article><span className="badge">Chat na nuvem</span><h2>Comece uma conversa</h2><p>Escreva, organize ideias e planeje seu dia. Histórico disponível para as contas habilitadas.</p></article>
      <article><span className="badge">Acesso pessoal</span><h2>Sua conta, seu Jarvis</h2><p>Entre com Google. Esta etapa funciona por texto; voz, integrações e conexão com o Mac continuam em preparação.</p></article>
    </div>
  </>;
}
