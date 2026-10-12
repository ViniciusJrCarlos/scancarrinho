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
import { atualizarItem } from "../auto.js";

export const ORIGENS = { site: "preço do site", manual: "manual", aproximado: "aproximado" };
export function selo(origem, disponivel) {
  return [h("span", { class: "selo selo-" + (origem || "manual") }, ORIGENS[origem] || "manual"),
    disponivel === false ? h("span", { class: "selo selo-alerta" }, "sem estoque no site") : null];
}
const hora = (ms) => new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const MOTIVOS = {
  nao_encontrado: "Não encontramos este código no Atacadão. Informe o nome e o preço da etiqueta.",
  offline: "Sem internet agora. Informe o preço da etiqueta (ou tente depois).",
  limite: "Muitas consultas seguidas. Informe o preço ou tente em instantes.",
  origem_indisponivel: "O site do Atacadão não respondeu. Informe o preço da etiqueta.",
};

export async function render(view, { arg: codigo, params, topo }) {
  const de = params.get("de") === "scan" ? "#/scan" : "#/lista";
  topo({ titulo: "Produto", voltar: de });
  if (!codigoValido(codigo)) { view.append(h("p", { class: "erro" }, "Código inválido."), h("a", { class: "btn btn-claro", href: de }, "Voltar")); return; }
  const storeId = lojaAtualId();
  const [loja, prod, ult, media, hist, noCarrinho] = await Promise.all([
    buscarLoja(storeId), buscarProduto(codigo), ultimoPreco(storeId, codigo), mediaPreco(storeId, codigo), historicoPreco(storeId, codigo), itemDoCarrinho(codigo)]);
  const novo = !prod;
  const auto = loja?.tipo === "atacadao" && /^\d{8,14}$/.test(codigo);
  const travado = auto && noCarrinho?.origem === "site";
  topo({ titulo: novo ? "Novo produto" : "Detalhe do produto", voltar: de });

  let qtd = noCarrinho?.qty || 1;
  const precoInicial = noCarrinho?.cents ?? ult;
  const nome = h("input", { class: "campo", id: "p-nome", value: prod?.name || "", placeholder: "Ex.: Arroz 5kg", maxlength: "80", autocomplete: "off", required: true });
  const cat = h("select", { class: "campo", id: "p-cat" }, CATEGORIAS.map((c) => h("option", { value: c.id, selected: (prod?.category || "mercearia") === c.id }, c.nome)));
  const preco = h("input", { class: "campo campo-preco", id: "p-preco", inputmode: "decimal", placeholder: "0,00", autocomplete: "off", value: centsToInput(precoInicial), readonly: travado });
  const corrigir = travado ? h("button", { type: "button", class: "btn btn-claro btn-bloco", id: "btn-corrigir", onclick: () => {
    preco.removeAttribute("readonly"); preco.focus(); preco.select(); corrigir.hidden = true;
  } }, icon("edit"), "Corrigir preço (vira manual)") : null;
  const qtdTxt = h("output", { class: "qtd-valor", "aria-live": "polite" }, String(qtd));
  const passo = (d) => { qtd = Math.max(1, Math.min(999, qtd + d)); qtdTxt.textContent = String(qtd); };
  const erro = h("p", { class: "erro", hidden: true });
  const semCodigo = codigo.startsWith("SEM-");
  const motivo = MOTIVOS[params.get("motivo")];

  const atualizar = auto && noCarrinho ? h("button", { type: "button", class: "btn btn-claro btn-bloco", id: "btn-atualizar", onclick: async (e) => {
    e.currentTarget.disabled = true;
    const r = await atualizarItem(codigo, loja);
    if (r.ok) { toast("Preço atualizado: " + brl(r.dados.centavos)); go(location.hash); }
    else { toast(r.erro === "nao_encontrado" ? "Não encontrado no site." : "Não foi possível atualizar agora."); e.currentTarget.disabled = false; }
  } }, icon("download"), "Atualizar preço pelo site") : null;

  const infos = h("div", { class: "infos" },
    h("div", { class: "card info destaque" }, h("span", { class: "info-ico" }, icon("store")),
      h("div", {},
        h("small", {}, noCarrinho ? "Preço no carrinho" : "Último preço nesta loja"),
        h("strong", { class: "valor", id: "preco-atual" }, precoInicial != null ? brl(precoInicial) : "—"),
        h("small", {}, noCarrinho ? selo(noCarrinho.origem, noCarrinho.disponivel) : null, " ", h("b", {}, loja?.name || "")),
        noCarrinho?.origem === "site" && noCarrinho.consultadoEm ? h("small", {}, "consultado em " + hora(noCarrinho.consultadoEm)) : null)),
    h("div", { class: "card info" }, h("span", { class: "info-ico" }, icon("chart")),
      h("div", {}, h("small", {}, "Preço médio observado nesta loja"), h("strong", { class: "valor", id: "preco-medio" }, media ? brl(media.cents) : "—"),
        h("small", {}, media ? `média de ${media.count} ${media.count === 1 ? "registro" : "registros"}` : "ainda sem registros"))));

  const historico = hist.length > 1 ? h("details", { class: "card historico" }, h("summary", {}, `Histórico de preços (${hist.length})`),
    h("ul", {}, hist.slice().reverse().slice(0, 10).map((x) => h("li", {}, h("span", {}, dataCurta(x.date), " · ", ORIGENS[x.origem] || "manual"), h("strong", {}, brl(x.cents)))))) : null;

  const salvar = async () => {
    const n = nome.value.trim();
    const c = parseBRL(preco.value);
    if (n.length < 2) return mostrarErro("Digite o nome do produto.", nome);
    if (!Number.isFinite(c) || c <= 0) return mostrarErro("Digite o preço. Ex.: 4,99", preco);
    if (c > 9999999) return mostrarErro("Preço muito alto. Confira o valor.", preco);
    const mudouPreco = c !== precoInicial;
    await salvarProduto({ barcode: codigo, name: n, category: cat.value });
    const meta = mudouPreco || !noCarrinho ? { origem: "manual", disponivel: undefined } : {};
    if (mudouPreco || !noCarrinho) await registrarPreco(storeId, codigo, c, { origem: "manual" });
    if (noCarrinho) await definir(codigo, qtd, c, storeId, meta);
    else await adicionar(codigo, qtd, c, storeId, meta);
    toast(noCarrinho ? "Alterações salvas" : `${n} adicionado ao carrinho`);
    go(de);
  };
  function mostrarErro(m, campo) { erro.textContent = m; erro.hidden = false; campo.focus(); }

  view.append(
    h("form", { class: "produto", novalidate: true, onsubmit: (e) => { e.preventDefault(); salvar(); } },
      motivo ? h("p", { class: "aviso" }, icon("tag"), " " + motivo)
        : novo ? h("p", { class: "aviso" }, icon("tag"), semCodigo ? " Item sem código: informe o nome e o preço." : " Produto novo nesta lista. Informe o nome e o preço da etiqueta.") : null,
      h("p", { class: "codigo" }, semCodigo ? "Sem código de barras" : "Código: " + codigo, prod?.brand ? " · " + prod.brand : ""),
      novo ? null : infos,
      atualizar,
      historico,
      h("label", { for: "p-nome" }, h("span", { class: "rotulo" }, "Nome do produto"), nome),
      h("label", { for: "p-cat" }, h("span", { class: "rotulo" }, "Categoria"), cat),
      h("label", { for: "p-preco" }, h("span", { class: "rotulo" }, travado ? `Preço do site (${loja?.name || "loja"})` : `Preço na etiqueta (${loja?.name || "loja"})`),
        h("span", { class: "com-prefixo" }, h("span", {}, "R$"), preco)),
      corrigir,
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
  (novo ? nome : travado ? qtdTxt : preco).focus?.({ preventScroll: true });
}
