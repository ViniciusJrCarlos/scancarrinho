import { h } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { go } from "../ui/nav.js";
import { confirmar, pedirTexto } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { listarLojas, criarLoja, lojaAtualId, definirLojaAtual, lojaAtacadao, cepSalvo, salvarCep, COR_ATACADAO } from "../stores.js";
import { buscarUnidades } from "../atacadao.js";
import { contagem, esvaziar } from "../cart.js";

export function avatarLoja(l, cls = "avatar") {
  const a = h("span", { class: cls, "aria-hidden": "true" }, l.initials);
  a.style.background = l.color;
  return a;
}
const formatarCep = (v) => { const d = v.replace(/\D/g, "").slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; };

/*
 * "Onde você compra?": Atacadão (preço automático, por CEP e unidade) no topo;
 * Carrefour, Pão de Açúcar, Extra, Assaí e lojas criadas: preço manual.
 */
export async function render(view, { topo }) {
  topo({ titulo: "ScanCarrinho", voltar: lojaAtualId() ? "#/scan" : null });
  let escolhida = lojaAtualId();      // id de loja já gravada
  let novaUnidade = null;             // unidade do Atacadão vinda da busca (ainda não gravada)
  let lojas = await listarLojas();
  let encontradas = [];
  let regionId = null;

  const btn = h("button", { class: "btn btn-primario btn-grande", type: "button" }, icon("scan"), "Continuar");
  const cep = h("input", { class: "campo", id: "cep", inputmode: "numeric", autocomplete: "postal-code", placeholder: "00000-000", maxlength: "9",
    value: formatarCep(cepSalvo()), "aria-label": "CEP", oninput: (e) => { e.target.value = formatarCep(e.target.value); } });
  const btnCep = h("button", { class: "btn btn-primario", type: "submit" }, "Buscar unidades");
  const msgCep = h("p", { class: "nota-esq", role: "status" });
  const unidadesBox = h("div", { class: "unidades", role: "radiogroup", "aria-label": "Unidades do Atacadão" });
  const manuais = h("div", { class: "lojas", role: "radiogroup", "aria-label": "Outros supermercados" });

  const radio = (marcada) => h("span", { class: "radio" }, marcada ? icon("check") : null);
  const cartao = ({ titulo, sub, avatar, marcada, onclick, extra = "" }) =>
    h("button", { type: "button", role: "radio", "aria-checked": String(marcada), class: "card loja" + (marcada ? " marcada" : "") + extra, onclick },
      avatar, h("span", { class: "loja-txt" }, h("strong", {}, titulo), h("small", {}, sub)), radio(marcada));

  const desenhar = () => {
    const usadas = lojas.filter((l) => l.tipo === "atacadao");
    const idsUsadas = new Set(usadas.map((l) => l.unidadeId));
    const at = { initials: "AT", color: COR_ATACADAO };
    unidadesBox.replaceChildren(
      ...usadas.map((l) => cartao({ titulo: l.unidadeNome, sub: "Atacadão · CEP " + formatarCep(l.cep || ""), avatar: avatarLoja(at), marcada: l.id === escolhida && !novaUnidade,
        onclick: () => { escolhida = l.id; novaUnidade = null; desenhar(); } })),
      ...encontradas.filter((u) => !idsUsadas.has(u.id)).map((u) => cartao({ titulo: u.nome, sub: "Atacadão · unidade perto do CEP", avatar: avatarLoja(at),
        marcada: novaUnidade?.id === u.id, onclick: () => { novaUnidade = u; escolhida = null; desenhar(); } })));
    manuais.replaceChildren(
      ...lojas.filter((l) => l.tipo !== "atacadao").map((l) => cartao({ titulo: l.name, sub: l.custom ? "Loja criada por você · preço manual" : "Preço manual (em breve automático)",
        avatar: avatarLoja(l), marcada: l.id === escolhida && !novaUnidade, onclick: () => { escolhida = l.id; novaUnidade = null; desenhar(); } })),
      h("button", { type: "button", class: "card loja nova", onclick: novaLoja },
        h("span", { class: "avatar avatar-novo" }, icon("plus")), h("span", { class: "loja-txt" }, h("strong", {}, "Nova loja"), h("small", {}, "Adicionar outro mercado (preço manual)"))));
    btn.disabled = !escolhida && !novaUnidade;
  };

  async function procurar(e) {
    e?.preventDefault();
    const d = cep.value.replace(/\D/g, "");
    if (d.length !== 8) { msgCep.textContent = "Digite o CEP com 8 números."; msgCep.className = "erro"; cep.focus(); return; }
    btnCep.disabled = true;
    msgCep.className = "nota-esq";
    msgCep.textContent = "Buscando unidades…";
    const r = await buscarUnidades(d);
    btnCep.disabled = false;
    if (!r.ok) {
      msgCep.className = "erro";
      msgCep.textContent = r.erro === "nao_encontrado" ? "Nenhuma unidade do Atacadão atende esse CEP."
        : r.erro === "offline" ? "Sem internet. Conecte-se para buscar as unidades." : "Não foi possível buscar agora. Tente de novo.";
      return;
    }
    salvarCep(d);
    regionId = r.dados.regionId;
    encontradas = r.dados.unidades;
    msgCep.textContent = `${encontradas.length} ${encontradas.length === 1 ? "unidade encontrada" : "unidades encontradas"}. Escolha a sua:`;
    if (encontradas.length === 1) { novaUnidade = encontradas[0]; escolhida = null; }
    desenhar();
  }

  async function novaLoja() {
    const nome = await pedirTexto({ title: "Nova loja", label: "Nome do supermercado",
      validate: (v) => (v.length < 2 ? "Digite o nome da loja." : v.length > 40 ? "Use até 40 letras." : "") });
    if (!nome) return;
    const l = await criarLoja(nome);
    lojas = await listarLojas();
    escolhida = l.id; novaUnidade = null;
    desenhar();
  }

  btn.addEventListener("click", async () => {
    let destino = escolhida;
    if (novaUnidade) {
      const l = await lojaAtacadao({ unidadeId: novaUnidade.id, unidadeNome: novaUnidade.nome, cep: cepSalvo(), regionId });
      destino = l.id;
    }
    if (!destino) return;
    const atual = lojaAtualId();
    if (atual && atual !== destino && (await contagem()) > 0) {
      const ok = await confirmar("Trocar de loja?", "Os preços do carrinho são da loja anterior. Para trocar, o carrinho atual será esvaziado.", { ok: "Esvaziar e trocar", danger: true });
      if (!ok) return;
      await esvaziar();
    }
    definirLojaAtual(destino);
    lojas = await listarLojas();
    toast("Loja: " + lojas.find((l) => l.id === destino).name);
    go("#/scan");
  });

  desenhar();
  view.append(
    h("section", { class: "hero" }, h("h2", {}, "Onde você compra?"), h("p", {}, "No Atacadão o preço aparece sozinho ao escanear. Nas outras lojas você anota o preço.")),
    h("section", { class: "card atacadao" },
      h("div", { class: "atacadao-topo" }, avatarLoja({ initials: "AT", color: COR_ATACADAO }), h("div", {}, h("strong", {}, "Atacadão"), h("small", { class: "selo selo-site" }, "preço automático"))),
      h("form", { class: "dlg-form", novalidate: true, onsubmit: procurar },
        h("label", { class: "rotulo", for: "cep" }, "Seu CEP"),
        h("div", { class: "linha" }, cep, btnCep)),
      msgCep, unidadesBox),
    h("h3", { class: "secao" }, "Outros mercados (preço manual)"),
    manuais,
    h("div", { class: "rodape-fixo" }, btn, h("p", { class: "nota" }, "Seu carrinho fica só no seu aparelho.")));
}
