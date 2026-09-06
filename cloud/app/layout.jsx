import "./style.css";

export const metadata = {
  title: "Jarvis Bob — seu assistente pessoal",
  description: "Acesso pessoal ao Jarvis, em português brasileiro.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Jarvis Bob" },
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/180" },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#236747" };

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body><main>
    <header><a className="brand" href="/">Jarvis Bob</a><span className="locale">Português · Brasil</span></header>
    {children}
    <footer><a href="/instalar">Adicionar ao celular</a><a href="https://github.com/robertocamargo-cpu/personal-jarvis">Projeto no GitHub</a><span>Versão {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local"}</span></footer>
  </main></body></html>;
}
