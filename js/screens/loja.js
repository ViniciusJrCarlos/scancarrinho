import { h } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { go } from "../ui/nav.js";
import { confirmar, pedirTexto } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { listarLojas, criarLoja, lojaAtualId, definirLojaAtual } from "../stores.js";
import { contagem, esvaziar } from "../cart.js";

export function avatarLoja(l, cls = "avatar") {
  const a = h("span", { class: cls, "aria-hidden": "true" }, l.initials);
  a.style.background = l.color;
  return a;
}

export async function render(view, { topo }) {
  topo({ titulo: "ScanCarrinho", voltar: lojaAtualId() ? "#/scan" : null });
  let escolhida = lojaAtualId();
  let lojas = await listarLojas();
  const lista = h("div", { class: "lojas", role: "radiogroup", "aria-label": "Supermercados" });
  const busca = h("input", { class: "campo", type: "search", placeholder: "Buscar supermercado…", "aria-label": "Buscar supermercado" });
  const btn = h("button", { class: "btn btn-primario btn-grande", type: "button" }, icon("scan"), "Continuar");

  const desenhar = () => {
    const q = busca.value.trim().toLocaleLowerCase("pt-BR");
    const vis = lojas.filter((l) => !q || l.name.toLocaleLowerCase("pt-BR").includes(q));
    lista.replaceChildren(
      ...vis.map((l) => h("button", { type: "button", role: "radio", "aria-checked": String(l.id === escolhida),
        class: "card loja" + (l.id === escolhida ? " marcada" : ""), onclick: () => { escolhida = l.id; desenhar(); } },
        avatarLoja(l),
        h("span", { class: "loja-txt" }, h("strong", {}, l.name), h("small", {}, l.custom ? "Loja criada por você" : "Supermercado")),
        h("span", { class: "radio" }, l.id === escolhida ? icon("check") : null))),
      ...(vis.length ? [] : [h("p", { class: "vazio" }, "Nenhuma loja com esse nome.")]),
      h("button", { type: "button", class: "card loja nova", onclick: novaLoja },
        h("span", { class: "avatar avatar-novo" }, icon("plus")), h("span", { class: "loja-txt" }, h("strong", {}, "Nova loja"), h("small", {}, "Adicionar outro mercado"))));
    btn.disabled = !escolhida;
  };
  async function novaLoja() {
    const nome = await pedirTexto({ title: "Nova loja", label: "Nome do supermercado", value: busca.value.trim(),
      validate: (v) => (v.length < 2 ? "Digite o nome da loja." : v.length > 40 ? "Use até 40 letras." : "") });
    if (!nome) return;
    const l = await criarLoja(nome);
    lojas = await listarLojas();
    escolhida = l.id;
    busca.value = "";
    desenhar();
  }
  btn.addEventListener("click", async () => {
    if (!escolhida) return;
    const atual = lojaAtualId();
    if (atual && atual !== escolhida && (await contagem()) > 0) {
      const ok = await confirmar("Trocar de loja?", "Os preços do carrinho são da loja anterior. Para trocar, o carrinho atual será esvaziado.", { ok: "Esvaziar e trocar", danger: true });
      if (!ok) return;
      await esvaziar();
    }
    definirLojaAtual(escolhida);
    toast("Loja: " + lojas.find((l) => l.id === escolhida).name);
    go("#/scan");
  });
  busca.addEventListener("input", desenhar);
  desenhar();
  view.append(
    h("section", { class: "hero" }, h("h2", {}, "Selecione sua loja"), h("p", {}, "Escolha o supermercado para começar suas compras. Os preços ficam guardados por loja.")),
    h("label", { class: "busca" }, icon("search"), busca),
    lista,
    h("div", { class: "rodape-fixo" }, btn, h("p", { class: "nota" }, "Tudo fica só no seu aparelho e funciona sem internet.")));
}
