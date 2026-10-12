import { $, $$ } from "./ui/dom.js";
import { icon } from "./ui/icons.js";
import { go } from "./ui/nav.js";
import { lojaAtualId } from "./stores.js";
import { contagem } from "./cart.js";
import * as loja from "./screens/loja.js";
import * as scan from "./screens/scan.js";
import * as lista from "./screens/lista.js";
import * as produto from "./screens/produto.js";
import * as resumo from "./screens/resumo.js";

const TELAS = { loja, scan, lista, produto, resumo };
let limpar = null;
let renderId = 0;

function topo({ titulo = "ScanCarrinho", voltar = null } = {}) {
  $("#titulo").textContent = titulo;
  document.title = titulo === "ScanCarrinho" ? titulo : `${titulo} · ScanCarrinho`;
  const b = $("#btn-voltar");
  b.hidden = !voltar;
  b.onclick = voltar ? () => go(voltar) : null;
}

async function atualizarBadge() {
  const n = await contagem();
  const b = $("#badge");
  b.textContent = n > 99 ? "99+" : String(n);
  b.hidden = n === 0;
}

async function render() {
  const id = ++renderId;
  try { limpar?.(); } catch { /* nada */ }
  limpar = null;
  const [caminho, qs = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [nome, ...resto] = caminho.split("/");
  let tela = TELAS[nome] ? nome : lojaAtualId() ? "lista" : "loja";
  if (tela !== "loja" && !lojaAtualId()) tela = "loja";
  if (tela !== nome) { history.replaceState(null, "", "#/" + tela); }
  $$("#tabs a").forEach((a) => a.classList.toggle("ativo", a.dataset.tab === tela || (tela === "produto" && a.dataset.tab === "lista")));
  $("#tabs").hidden = tela === "loja";
  document.body.classList.toggle("sem-abas", tela === "loja");
  const view = $("#view");
  view.replaceChildren();
  view.className = "tela-" + tela;
  topo();
  try {
    const fim = await TELAS[tela].render(view, { arg: decodeURIComponent(resto.join("/")), params: new URLSearchParams(qs), topo });
    if (id !== renderId) { try { fim?.(); } catch { /* nada */ } return; }
    limpar = typeof fim === "function" ? fim : null;
  } catch (e) {
    console.error(e);
    view.replaceChildren(Object.assign(document.createElement("p"), { className: "erro", textContent: "Algo deu errado ao abrir esta tela. Tente de novo." }));
  }
  window.scrollTo(0, 0);
  atualizarBadge();
}

export function initApp() {
  $$("#tabs [data-icon]").forEach((s) => s.replaceWith(icon(s.dataset.icon, "tab-ico")));
  $("#btn-voltar").append(icon("back"));
  window.addEventListener("hashchange", render);
  window.addEventListener("carrinho", atualizarBadge);
  render();
}
