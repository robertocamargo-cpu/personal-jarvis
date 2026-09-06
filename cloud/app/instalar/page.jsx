import { InstallButton } from "./install-button";

export const metadata = { title: "Adicionar ao celular — Jarvis Bob" };

export default function InstallPage() {
  return <>
    <p className="eyebrow">Jarvis no celular</p><h1>Um ícone para chegar ao seu Jarvis.</h1>
    <p className="intro">Adicione o Jarvis à tela inicial para abrir este endereço como aplicativo. Você continuará recebendo as próximas atualizações por aqui.</p>
    <InstallButton />
    <div className="grid">
      <article><h2>iPhone ou iPad</h2><ol><li>Abra este endereço no Safari.</li><li>Toque em Compartilhar.</li><li>Escolha Adicionar à Tela de Início e confirme.</li></ol></article>
      <article><h2>Android</h2><ol><li>Abra este endereço no Chrome.</li><li>Abra o menu de três pontos.</li><li>Escolha Instalar aplicativo ou Adicionar à tela inicial e confirme.</li></ol></article>
    </div>
    <p className="muted">É necessário estar conectado à internet. Entre com Google para conversar por texto nas contas habilitadas. Voz e aprovações remotas ainda estão em preparação.</p>
    <a className="button" href="/">Voltar ao Jarvis</a>
  </>;
}
