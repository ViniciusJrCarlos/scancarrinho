import { h } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { go } from "../ui/nav.js";
import { toast } from "../ui/toast.js";
import { confirmar } from "../ui/dialog.js";
import { brl, parseBRL, centsToInput, dataCurta } from "../ui/money.js";
import { CATEGORIAS } from "../categories.js";
import { buscarLoja, lojaAtualId } from "../stores.js";
import { buscarProduto, salvarProduto, codigoValido } from "../products.js";
import { historicoPreco, mediaPreco, ultimoPreco, registrarPreco } from "../prices.js";
import { itemDoCarrinho, definir, adicionar, remover } from "../cart.js";

export async function render(view, { arg: codigo, params, topo }) {
  const de = params.get("de") === "scan" ? "#/scan" : "#/lista";
  topo({ titulo: "Produto", voltar: de });
  if (!codigoValido(codigo)) { view.append(h("p", { class: "erro" }, "Código inválido."), h("a", { class: "btn btn-claro", href: de }, "Voltar")); return; }
  const storeId = lojaAtualId();
  const [loja, prod, ult, media, hist, noCarrinho] = await Promise.all([
    buscarLoja(storeId), buscarProduto(codigo), ultimoPreco(storeId, codigo), mediaPreco(storeId, codigo), historicoPreco(storeId, codigo), itemDoCarrinho(codigo)]);
  const novo = !prod;
  topo({ titulo: novo ? "Novo produto" : "Detalhe do produto", voltar: de });

  let qtd = noCarrinho?.qty || 1;
  const nome = h("input", { class: "campo", id: "p-nome", value: prod?.name || "", placeholder: "Ex.: Arroz 5kg", maxlength: "60", autocomplete: "off", required: true });
  const cat = h("select", { class: "campo", id: "p-cat" }, CATEGORIAS.map((c) => h("option", { value: c.id, selected: (prod?.category || "mercearia") === c.id }, c.nome)));
  const preco = h("input", { class: "campo campo-preco", id: "p-preco", inputmode: "decimal", placeholder: "0,00", autocomplete: "off",
    value: centsToInput(noCarrinho?.cents ?? ult) });
  const qtdTxt = h("output", { class: "qtd-valor", "aria-live": "polite" }, String(qtd));
  const passo = (d) => { qtd = Math.max(1, Math.min(999, qtd + d)); qtdTxt.textContent = String(qtd); };
  const erro = h("p", { class: "erro", hidden: true });
  const semCodigo = codigo.startsWith("SEM-");

  const infos = h("div", { class: "infos" },
    h("div", { class: "card info destaque" }, h("span", { class: "info-ico" }, icon("store")),
      h("div", {}, h("small", {}, "Último preço nesta loja"), h("strong", { class: "valor" }, ult != null ? brl(ult) : "—"), h("small", {}, "em ", h("b", {}, loja?.name || "")))),
    h("div", { class: "card info" }, h("span", { class: "info-ico" }, icon("chart")),
      h("div", {}, h("small", {}, "Preço médio nesta loja"), h("strong", { class: "valor" }, media ? brl(media.cents) : "—"),
        h("small", {}, media ? `média de ${media.count} ${media.count === 1 ? "registro" : "registros"}` : "ainda sem registros"))));

  const historico = hist.length > 1 ? h("details", { class: "card historico" }, h("summary", {}, `Histórico de preços (${hist.length})`),
    h("ul", {}, hist.slice().reverse().slice(0, 10).map((x) => h("li", {}, h("span", {}, dataCurta(x.date)), h("strong", {}, brl(x.cents)))))) : null;

  const salvar = async () => {
    const n = nome.value.trim();
    const c = parseBRL(preco.value);
    if (n.length < 2) return mostrarErro("Digite o nome do produto.", nome);
    if (!Number.isFinite(c) || c <= 0) return mostrarErro("Digite o preço. Ex.: 4,99", preco);
    if (c > 9999999) return mostrarErro("Preço muito alto. Confira o valor.", preco);
    await salvarProduto({ barcode: codigo, name: n, category: cat.value });
    await registrarPreco(storeId, codigo, c);
    if (noCarrinho) await definir(codigo, qtd, c, storeId);
    else await adicionar(codigo, qtd, c, storeId);
    toast(noCarrinho ? "Alterações salvas" : `${n} adicionado ao carrinho`);
    go(de);
  };
  function mostrarErro(m, campo) { erro.textContent = m; erro.hidden = false; campo.focus(); }

  view.append(
    h("form", { class: "produto", onsubmit: (e) => { e.preventDefault(); salvar(); } },
      novo ? h("p", { class: "aviso" }, icon("tag"), semCodigo ? " Item sem código: informe o nome e o preço." : " Produto novo nesta lista. Informe o nome e o preço da etiqueta.") : null,
      h("p", { class: "codigo" }, semCodigo ? "Sem código de barras" : "Código: " + codigo),
      novo ? null : infos,
      historico,
      h("label", { for: "p-nome" }, h("span", { class: "rotulo" }, "Nome do produto"), nome),
      h("label", { for: "p-cat" }, h("span", { class: "rotulo" }, "Categoria"), cat),
      h("label", { for: "p-preco" }, h("span", { class: "rotulo" }, `Preço na etiqueta (${loja?.name || "loja"})`), h("span", { class: "com-prefixo" }, h("span", {}, "R$"), preco)),
      h("div", {}, h("span", { class: "rotulo" }, "Quantidade"),
        h("div", { class: "stepper" },
          h("button", { type: "button", class: "btn btn-primario", "aria-label": "Diminuir", onclick: () => passo(-1) }, icon("minus")),
          qtdTxt,
          h("button", { type: "button", class: "btn btn-primario", "aria-label": "Aumentar", onclick: () => passo(1) }, icon("plus")))),
      erro,
      h("button", { type: "submit", class: "btn btn-primario btn-grande" }, icon(noCarrinho ? "check" : "cart"), noCarrinho ? "Salvar alterações" : "Adicionar ao carrinho"),
      noCarrinho ? h("button", { type: "button", class: "btn btn-perigo-claro btn-bloco", onclick: async () => {
        if (await confirmar("Remover item?", `Tirar “${prod?.name || codigo}” do carrinho?`, { ok: "Remover", danger: true })) { await remover(codigo); toast("Item removido"); go("#/lista"); }
      } }, icon("trash"), "Remover do carrinho") : null));
  (novo ? nome : preco).focus({ preventScroll: true });
}
