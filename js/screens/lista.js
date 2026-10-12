import { h } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { go } from "../ui/nav.js";
import { toast } from "../ui/toast.js";
import { confirmar } from "../ui/dialog.js";
import { brl } from "../ui/money.js";
import { categoria } from "../categories.js";
import { buscarLoja, lojaAtualId } from "../stores.js";
import { totais, remover, definir, esvaziar } from "../cart.js";
import { selo } from "./produto.js";
import { atualizarItem } from "../auto.js";
import { PRECO_VELHO_MS } from "../config.js";
import { ehAuto } from "../redes.js";

const ORDENS = { nome: "Nome", preco: "Maior valor", recentes: "Mais recentes" };
const CHAVE = "scancarrinho.ordem";

export async function render(view, { topo }) {
  topo({ titulo: "Lista de compras" });
  const loja = await buscarLoja(lojaAtualId());
  let ordem = localStorage.getItem(CHAVE) || "recentes";
  const corpo = h("div");
  view.append(corpo);

  const desenhar = async () => {
    const t = await totais();
    const it = [...t.itens].sort(ordem === "nome" ? (a, b) => a.name.localeCompare(b.name, "pt-BR")
      : ordem === "preco" ? (a, b) => b.total - a.total : (a, b) => b.added - a.added);
    if (!it.length) {
      corpo.replaceChildren(h("div", { class: "vazio-grande" }, icon("cart", "ico ico-gigante"),
        h("h2", {}, "Carrinho vazio"), h("p", {}, `Escaneie ou digite o código dos produtos em ${loja?.name || "sua loja"}.`),
        h("a", { href: "#/scan", class: "btn btn-primario btn-grande" }, icon("scan"), "Escanear produtos")));
      return;
    }
    const sel = h("select", { class: "ordem", "aria-label": "Ordenar por", onchange: (e) => { ordem = e.target.value; localStorage.setItem(CHAVE, ordem); desenhar(); } },
      Object.entries(ORDENS).map(([v, l]) => h("option", { value: v, selected: v === ordem }, l)));
    const dif = t.total - t.totalMedia;
    const auto = ehAuto(loja);
    const velho = (i) => Date.now() - (i.consultadoEm || 0) > PRECO_VELHO_MS;
    // Aproximado sem nome achado = último preço salvo (offline): atualizar. Achado pelo nome: só quando antigo.
    const pendentes = auto ? it.filter((i) => /^\d{8,14}$/.test(i.barcode) && ((i.origem === "aproximado" && !i.nomeEncontrado) || ((i.origem === "site" || i.nomeEncontrado) && velho(i)))) : [];
    const aviso = pendentes.length ? h("div", { class: "card aviso-precos" },
      h("p", {}, `${pendentes.length} ${pendentes.length === 1 ? "preço aproximado ou antigo" : "preços aproximados ou antigos"}.`),
      h("button", { type: "button", class: "btn btn-claro", id: "btn-atualizar-precos", onclick: async (e) => {
        e.currentTarget.disabled = true;
        let ok = 0;
        for (const i of pendentes) { const r = await atualizarItem(i.barcode, loja); if (r.ok) ok++; else if (r.erro === "offline") break; }
        toast(ok ? `${ok} ${ok === 1 ? "preço atualizado" : "preços atualizados"}` : "Não foi possível atualizar agora.");
        desenhar();
      } }, icon("download"), "Atualizar preços")) : null;
    corpo.replaceChildren(
      ...(aviso ? [aviso] : []),
      h("div", { class: "lista-topo" }, h("strong", {}, `Sua lista (${t.qtd} ${t.qtd === 1 ? "item" : "itens"})`), h("label", {}, "Ordenar: ", sel)),
      h("ul", { class: "card itens" }, it.map((i) => {
        const c = categoria(i.category);
        const ab = h("span", { class: "item-ico", "aria-hidden": "true" }, c.nome[0]);
        ab.style.background = c.cor;
        return h("li", { class: "item" }, ab,
          h("a", { class: "item-txt", href: "#/produto/" + encodeURIComponent(i.barcode) },
            h("strong", {}, i.name),
            h("small", {}, `${i.qty} × ${brl(i.cents)}`, i.media && i.media.count > 1 ? ` · média ${brl(i.media.cents)}` : ""),
            h("span", { class: "selos" }, selo(i.origem, i.disponivel)),
            i.nomeEncontrado ? h("small", { class: "parecido" }, "parecido no site: " + i.nomeEncontrado) : null),
          h("span", { class: "item-valor" }, brl(i.total)),
          h("div", { class: "item-acoes" },
            h("button", { type: "button", class: "icon-btn redondo", "aria-label": `Mais um ${i.name}`, onclick: async () => { await definir(i.barcode, i.qty + 1, i.cents, i.storeId); desenhar(); } }, icon("plus")),
            h("button", { type: "button", class: "icon-btn redondo", "aria-label": `Editar ${i.name}`, onclick: () => go("#/produto/" + encodeURIComponent(i.barcode)) }, icon("edit")),
            h("button", { type: "button", class: "icon-btn", "aria-label": `Remover ${i.name}`, onclick: async () => {
              if (await confirmar("Remover item?", `Tirar “${i.name}” do carrinho?`, { ok: "Remover", danger: true })) { await remover(i.barcode); toast("Item removido"); desenhar(); }
            } }, icon("trash"))));
      })),
      h("div", { class: "card total" }, icon("tag", "ico total-ico"),
        h("div", {}, h("small", {}, "Total"), h("strong", { class: "total-valor", id: "total-lista" }, brl(t.total))),
        auto ? h("p", { class: "total-nota" }, "Preços do site do " + loja.name + ". Podem diferir da gôndola.") : null,
        h("p", { class: "total-nota" }, dif === 0 ? "Igual à média dos seus preços nesta loja."
          : `${brl(Math.abs(dif))} ${dif < 0 ? "abaixo" : "acima"} da média dos seus preços nesta loja.`)),
      h("div", { class: "acoes-3" },
        h("a", { href: "#/scan", class: "btn btn-claro" }, icon("plus"), "Mais itens"),
        h("button", { type: "button", class: "btn btn-claro", onclick: async () => {
          if (await confirmar("Esvaziar carrinho?", "Todos os itens saem da lista. Os preços anotados continuam guardados.", { ok: "Esvaziar", danger: true })) { await esvaziar(); desenhar(); }
        } }, icon("trash"), "Esvaziar"),
        h("a", { href: "#/resumo", class: "btn btn-primario" }, "Resumo ›")));
  };
  await desenhar();
}
