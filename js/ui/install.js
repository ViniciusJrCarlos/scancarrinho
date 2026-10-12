import { h } from "./dom.js";
import { openDialog } from "./dialog.js";
/* Botão "Instalar app": usa o convite do navegador (Android/PC) ou mostra o passo a passo (iPhone). */
let convite = null;
export const instalado = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const podeInstalar = () => !instalado();
function atualizarBotao() {
  const b = document.getElementById("btn-instalar");
  if (b) b.hidden = !convite || instalado();
}
export function initInstall() {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); convite = e; atualizarBotao(); });
  window.addEventListener("appinstalled", () => { convite = null; atualizarBotao(); });
  document.getElementById("btn-instalar")?.addEventListener("click", instalar);
  atualizarBotao();
}
export async function instalar() {
  if (convite) {
    convite.prompt();
    await convite.userChoice.catch(() => null);
    convite = null;
    atualizarBotao();
    return;
  }
  await openDialog({ title: "Instalar o ScanCarrinho", body: h("div", { class: "passos" },
    h("p", {}, h("strong", {}, "iPhone (Safari): "), "toque em Compartilhar e depois em “Adicionar à Tela de Início”."),
    h("p", {}, h("strong", {}, "Android / PC (Chrome ou Edge): "), "abra o menu do navegador e escolha “Instalar app”."),
    h("p", {}, "Depois de aberto uma vez com internet, funciona sem conexão.")),
    actions: [{ label: "Entendi", value: true, primary: true }] });
}
