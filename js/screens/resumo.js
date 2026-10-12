import { h } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { go } from "../ui/nav.js";
import { toast } from "../ui/toast.js";
import { confirmar } from "../ui/dialog.js";
import { brl, pct, dataCurta } from "../ui/money.js";
import { categoria } from "../categories.js";
import { buscarLoja, lojaAtualId, listarLojas } from "../stores.js";
import { totais, esvaziar } from "../cart.js";
import { dbAll, dbPut } from "../db.js";
import { podeInstalar, instalar } from "../ui/install.js";
import { APP_VERSION } from "../version.js";

export async function render(view, { topo }) {
  topo({ titulo: "Resumo" });
  const [loja, t, compras, lojas] = await Promise.all([buscarLoja(lojaAtualId()), totais(), dbAll("history"), listarLojas()]);
  const porCat = new Map();
  for (const i of t.itens) porCat.set(i.category, (porCat.get(i.category) || 0) + i.total);
  const cats = [...porCat.entries()].sort((a, b) => b[1] - a[1]);
  const dif = t.total - t.totalMedia;

  const finalizar = async () => {
    if (!(await confirmar("Finalizar compra?", `Guardar esta compra de ${brl(t.total)} no histórico e esvaziar o carrinho?`, { ok: "Finalizar" }))) return;
    await dbPut("history", { date: Date.now(), storeId: loja?.id, storeName: loja?.name, total: t.total, qtd: t.qtd,
      itens: t.itens.map((i) => ({ barcode: i.barcode, name: i.name, qty: i.qty, cents: i.cents, category: i.category, origem: i.origem })) });
    await esvaziar();
    toast("Compra finalizada e guardada no histórico.");
    go("#/resumo");
  };

  view.append(
    h("section", { class: "card total-grande" },
      h("small", {}, "Total do seu carrinho"),
      h("strong", { class: "total-valor", id: "total-resumo" }, brl(t.total)),
      h("p", {}, `${t.qtd} ${t.qtd === 1 ? "item" : "itens"} · ${loja?.name || ""}`),
      loja?.tipo === "atacadao" && t.itens.length ? h("p", { class: "nota" }, "Preços do site do Atacadão (" + loja.unidadeNome + "). Podem diferir da gôndola.") : null,
      t.itens.some((i) => i.origem === "aproximado") ? h("p", { class: "nota" }, "Há preços aproximados (último preço salvo). Atualize na Lista.") : null),
    t.itens.length ? h("section", { class: "card" },
      h("h3", {}, "Resumo por categoria"),
      h("ul", { class: "cats" }, cats.map(([id, v]) => {
        const c = categoria(id);
        const barra = h("span", { class: "barra-cheia" });
        barra.style.width = pct(v, t.total) + "%";
        barra.style.background = c.cor;
        return h("li", {}, h("div", { class: "cat-linha" }, h("span", {}, c.nome), h("strong", {}, brl(v))),
          h("div", { class: "barra" }, barra), h("small", {}, `${pct(v, t.total)}% do total`));
      }))) : null,
    t.itens.length ? h("section", { class: "card comparacao" },
      h("h3", {}, "Comparação com a média"),
      h("div", { class: "comp-grade" },
        h("div", {}, h("small", {}, "Você vai pagar"), h("strong", {}, brl(t.total))),
        h("div", {}, h("small", {}, "Pela média dos seus preços"), h("strong", { id: "total-media" }, brl(t.totalMedia)))),
      h("p", { class: "comp-nota " + (dif <= 0 ? "bom" : "ruim") }, icon(dif <= 0 ? "leaf" : "chart"),
        dif === 0 ? " Mesmo valor da média dos preços que você anotou nesta loja."
          : dif < 0 ? ` ${brl(-dif)} abaixo da média. Boa compra!` : ` ${brl(dif)} acima da média dos preços que você anotou.`),
      h("p", { class: "nota" }, "A média usa os preços observados (site e anotados) de cada produto nesta loja.")) : null,
    t.itens.length ? h("button", { type: "button", class: "btn btn-primario btn-grande", onclick: finalizar }, "Finalizar compra ›")
      : h("div", { class: "vazio-grande" }, h("p", {}, "Nenhum item no carrinho ainda."), h("a", { href: "#/scan", class: "btn btn-primario" }, icon("scan"), "Escanear produtos")),
    compras.length ? h("section", { class: "card" }, h("h3", {}, "Últimas compras"),
      h("ul", { class: "compras" }, compras.sort((a, b) => b.date - a.date).slice(0, 5).map((c) =>
        h("li", {}, h("span", {}, dataCurta(c.date), " · ", c.storeName || lojas.find((l) => l.id === c.storeId)?.name || ""), h("strong", {}, brl(c.total)))))) : null,
    h("section", { class: "card extras" },
      podeInstalar() ? h("button", { type: "button", class: "btn btn-claro btn-bloco", onclick: instalar }, icon("download"), "Instalar app") : null,
      h("a", { href: "#/loja", class: "btn btn-claro btn-bloco" }, icon("store"), "Trocar de loja")),
    h("footer", { class: "versao" }, `ScanCarrinho v${APP_VERSION} · © 2026 Vinicius Carlos`));
}
