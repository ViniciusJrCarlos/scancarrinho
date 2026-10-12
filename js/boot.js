/* Boot: liga o app, o botão de instalar e o service worker (com aviso de versão nova). */
import { initApp } from "./app.js";
import { initInstall } from "./ui/install.js";
import { toast } from "./ui/toast.js";
import { setPriceSource, atacadaoPriceSource } from "./prices.js";

// Fonte de preços: Atacadão (Worker) + histórico local. Lojas manuais seguem só com o histórico.
setPriceSource(atacadaoPriceSource);

initApp();
initInstall();

if ("serviceWorker" in navigator) {
  const tinhaControle = !!navigator.serviceWorker.controller;
  let avisado = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!tinhaControle || avisado) return;
    avisado = true;
    toast("Nova versão disponível", { action: "Atualizar", onAction: () => location.reload(), sticky: true });
  });
  navigator.serviceWorker.register("./sw.js").then((reg) => {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => { /* sem service worker (ex.: http) o app ainda funciona online */ });
}
