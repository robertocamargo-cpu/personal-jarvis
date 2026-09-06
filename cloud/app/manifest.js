export default function manifest() {
  return {
    id: "/",
    name: "Jarvis Bob",
    short_name: "Jarvis Bob",
    description: "Seu assistente pessoal em português brasileiro.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#101714",
    theme_color: "#236747",
    prefer_related_applications: false,
    icons: [192, 512].map((size) => ({
      src: `/pwa-icon/${size}`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any maskable",
    })),
  };
}
