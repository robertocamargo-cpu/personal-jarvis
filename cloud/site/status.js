const label = document.getElementById("deployment");
fetch("/status.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error("Deployment status unavailable");
    return response.json();
  })
  .then((status) => {
    const revision = typeof status.commit === "string" ? status.commit.slice(0, 7) : "local";
    label.textContent = `Publicação verificada · versão ${revision}`;
  })
  .catch(() => { label.textContent = "Não foi possível conferir esta publicação agora."; });
