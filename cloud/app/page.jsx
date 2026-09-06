export default function Home() {
  return <>
    <p className="eyebrow">Seu assistente pessoal</p>
    <h1>Jarvis, cada vez mais perto de você.</h1>
    <p className="intro">Seu endereço de acesso pelo computador e pelo celular. Entre para identificar sua conta e acompanhar a preparação do seu assistente.</p>
    <a className="button" href="/entrar">Entrar no Jarvis</a>
    <div className="grid">
      <article><span className="badge">Banco provisionado</span><h2>Conversas e memória</h2><p>O Neon já está conectado ao projeto. A migração do histórico para sua conta é a próxima etapa.</p></article>
      <article><span className="badge">Acesso pessoal</span><h2>Sua conta, seu Jarvis</h2><p>Entre com Google para identificar sua conta. Conversas, voz e conexão com o Mac continuam em preparação.</p></article>
    </div>
  </>;
}
