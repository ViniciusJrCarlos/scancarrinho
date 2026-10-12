import { h } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { go } from "../ui/nav.js";
import { confirmar, pedirTexto } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { listarLojas, criarLoja, lojaAtualId, definirLojaAtual, lojaRede, cepSalvo, salvarCep } from "../stores.js";
import { buscarUnidades } from "../precos-site.js";
import { REDES, LISTA_REDES, ehAuto, redeDaLoja, nomeRede } from "../redes.js";
import { contagem, esvaziar } from "../cart.js";

export function avatarLoja(l, cls = "avatar") {
  const a = h("span", { class: cls, "aria-hidden": "true" }, l.initials);
  a.style.background = l.color;
  return a;
}
const formatarCep = (v) => { const d = v.replace(/\D/g, "").slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; };

/*
 * "Onde você compra?"
 * Preço automático: um CEP busca as unidades das redes regionais (Atacadão, Sam's Club, Bistek);
 * Supernosso e Covabra têm preço único na rede (sem CEP). Outras lojas: preço manual.
 */
export async function render(view, { topo }) {
  topo({ titulo: "ScanCarrinho", voltar: lojaAtualId() ? "#/scan" : null });
  let escolhida = lojaAtualId();      // id de loja já gravada
  let nova = null;                    // { rede, unidade? } ainda não gravada
  let lojas = await listarLojas();
  let encontradas = [];               // [{ rede, id, nome, regionId }]

  const btn = h("button", { class: "btn btn-primario btn-grande", type: "button" }, icon("scan"), "Continuar");
  const cep = h("input", { class: "campo", id: "cep", inputmode: "numeric", autocomplete: "postal-code", placeholder: "00000-000", maxlength: "9",
    value: formatarCep(cepSalvo()), "aria-label": "CEP", oninput: (e) => { e.target.value = formatarCep(e.target.value); } });
  const btnCep = h("button", { class: "btn btn-primario", type: "submit" }, "Buscar lojas");
  const msgCep = h("p", { class: "nota-esq", role: "status" });
  const unidadesBox = h("div", { class: "unidades", role: "radiogroup", "aria-label": "Lojas com preço automático" });
  const unicasBox = h("div", { class: "unidades", role: "radiogroup", "aria-label": "Redes com preço único" });
  const manuais = h("div", { class: "lojas", role: "radiogroup", "aria-label": "Outros supermercados" });

  const radio = (marcada) => h("span", { class: "radio" }, marcada ? icon("check") : null);
  const cartao = ({ titulo, sub, avatar, marcada, onclick, extra = "" }) =>
    h("button", { type: "button", role: "radio", "aria-checked": String(marcada), class: "card loja" + (marcada ? " marcada" : "") + extra, onclick },
      avatar, h("span", { class: "loja-txt" }, h("strong", {}, titulo), h("small", {}, sub)), radio(marcada));
  const av = (rede) => avatarLoja({ initials: REDES[rede].sigla, color: REDES[rede].cor });
  const marcar = (id, n = null) => { escolhida = id; nova = n; desenhar(); };

  const desenhar = () => {
    const usadas = lojas.filter((l) => ehAuto(l) && REDES[redeDaLoja(l)].regional);
    const idsUsadas = new Set(usadas.map((l) => l.id));
    unidadesBox.replaceChildren(
      ...usadas.map((l) => cartao({ titulo: l.name, sub: `${nomeRede(l)} · CEP ${formatarCep(l.cep || "")}`, avatar: av(redeDaLoja(l)),
        marcada: l.id === escolhida && !nova, onclick: () => marcar(l.id) })),
      ...encontradas.filter((u) => !idsUsadas.has(`${u.rede}:${u.id}`)).map((u) => cartao({
        titulo: u.nome.toLowerCase().startsWith(REDES[u.rede].nome.toLowerCase()) ? u.nome : `${REDES[u.rede].nome} ${u.nome}`,
        sub: `${REDES[u.rede].nome} · perto do CEP`, avatar: av(u.rede),
        marcada: nova?.rede === u.rede && nova?.unidade?.id === u.id, onclick: () => marcar(null, { rede: u.rede, unidade: u }) })));
    unicasBox.replaceChildren(...LISTA_REDES.filter((r) => !r.regional).map((r) => {
      const salva = lojas.find((l) => l.id === r.id);
      return cartao({ titulo: r.nome, sub: `preço único da rede · ${r.onde}`, avatar: av(r.id),
        marcada: salva ? salva.id === escolhida && !nova : nova?.rede === r.id,
        onclick: () => (salva ? marcar(salva.id) : marcar(null, { rede: r.id })) });
    }));
    manuais.replaceChildren(
      ...lojas.filter((l) => !ehAuto(l)).map((l) => cartao({ titulo: l.name, sub: l.custom ? "Loja criada por você · preço manual" : "Preço manual",
        avatar: avatarLoja(l), marcada: l.id === escolhida && !nova, onclick: () => marcar(l.id) })),
      h("button", { type: "button", class: "card loja nova", onclick: novaLoja },
        h("span", { class: "avatar avatar-novo" }, icon("plus")), h("span", { class: "loja-txt" }, h("strong", {}, "Nova loja"), h("small", {}, "Adicionar outro mercado (preço manual)"))));
    btn.disabled = !escolhida && !nova;
  };

  async function procurar(e) {
    e?.preventDefault();
    const d = cep.value.replace(/\D/g, "");
    if (d.length !== 8) { msgCep.textContent = "Digite o CEP com 8 números."; msgCep.className = "erro"; cep.focus(); return; }
    btnCep.disabled = true;
    msgCep.className = "nota-esq";
    msgCep.textContent = "Buscando lojas…";
    const regionais = LISTA_REDES.filter((r) => r.regional);
    const rs = await Promise.all(regionais.map((r) => buscarUnidades(d, r.id)));
    btnCep.disabled = false;
    const achou = rs.flatMap((r, i) => (r.ok ? r.dados.unidades.map((u) => ({ ...u, rede: regionais[i].id, regionId: r.dados.regionId })) : []));
    if (!achou.length) {
      const falha = rs.find((r) => !r.ok && r.erro !== "nao_encontrado");
      msgCep.className = "erro";
      msgCep.textContent = !falha ? "Nenhuma loja com preço automático atende esse CEP. Veja as redes de preço único abaixo ou use preço manual."
        : falha.erro === "offline" ? "Sem internet. Conecte-se para buscar as lojas." : "Não foi possível buscar agora. Tente de novo.";
      return;
    }
    salvarCep(d);
    encontradas = achou;
    const redes = [...new Set(achou.map((u) => REDES[u.rede].nome))].join(", ");
    msgCep.textContent = `${achou.length} ${achou.length === 1 ? "loja encontrada" : "lojas encontradas"} (${redes}). Escolha a sua:`;
    if (achou.length === 1) { nova = { rede: achou[0].rede, unidade: achou[0] }; escolhida = null; }
    desenhar();
  }

  async function novaLoja() {
    const nome = await pedirTexto({ title: "Nova loja", label: "Nome do supermercado",
      validate: (v) => (v.length < 2 ? "Digite o nome da loja." : v.length > 40 ? "Use até 40 letras." : "") });
    if (!nome) return;
    const l = await criarLoja(nome);
    lojas = await listarLojas();
    marcar(l.id);
  }

  btn.addEventListener("click", async () => {
    let destino = escolhida;
    if (nova) {
      const u = nova.unidade;
      const l = await lojaRede({ rede: nova.rede, unidadeId: u?.id, unidadeNome: u?.nome, cep: u ? cepSalvo() : "", regionId: u?.regionId || null });
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
    h("section", { class: "hero" }, h("h2", {}, "Onde você compra?"), h("p", {}, "Nas redes com preço automático o preço aparece sozinho ao escanear. Nas outras lojas você anota o preço.")),
    h("section", { class: "card atacadao" },
      h("div", { class: "atacadao-topo" }, h("div", { class: "siglas" }, ...LISTA_REDES.filter((r) => r.regional).map((r) => av(r.id))),
        h("div", {}, h("strong", {}, "Atacadão, Sam's Club, Bistek"), h("small", { class: "selo selo-site" }, "preço automático por loja"))),
      h("form", { class: "dlg-form", novalidate: true, onsubmit: procurar },
        h("label", { class: "rotulo", for: "cep" }, "Seu CEP"),
        h("div", { class: "linha" }, cep, btnCep)),
      msgCep, unidadesBox),
    h("h3", { class: "secao" }, "Preço automático, igual em toda a rede"),
    unicasBox,
    h("h3", { class: "secao" }, "Outros mercados (preço manual)"),
    manuais,
    h("div", { class: "rodape-fixo" }, btn, h("p", { class: "nota" }, "Seu carrinho fica só no seu aparelho.")));
}
