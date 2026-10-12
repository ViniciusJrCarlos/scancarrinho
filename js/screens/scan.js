import { h, vibrate } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { go } from "../ui/nav.js";
import { toast } from "../ui/toast.js";
import { brl } from "../ui/money.js";
import { REUSAR_PRECO_MS } from "../config.js";
import { buscarLoja, lojaAtualId } from "../stores.js";
import { buscarProduto, codigoValido, novoCodigoSemBarra } from "../products.js";
import { ultimoPreco, consultarPreco } from "../prices.js";
import { adicionar, itemDoCarrinho, totais } from "../cart.js";
import { guardarResultadoSite } from "../auto.js";
import { iniciarScanner, scannerDisponivel } from "../scanner.js";
import { avatarLoja } from "./loja.js";
import { ehAuto, nomeRede } from "../redes.js";

const irProduto = (codigo, extra = "") => go("#/produto/" + encodeURIComponent(codigo) + "?de=scan" + extra);

/*
 * Usado pela câmera e pela digitação.
 * Rede automática (Atacadão, Sam's Club, Bistek, Supernosso, Covabra): busca o preço no site.
 * Código inexistente na rede: o Worker tenta pelo nome (preço "aproximado", com o nome achado).
 * Sem resposta: usa o último preço salvo (aproximado) ou pede o preço.
 * Outras lojas: produto conhecido com preço entra direto (+1); novo pede nome e preço.
 */
export async function tratarCodigo(codigo, { aoAdicionar, aoBuscar } = {}) {
  const storeId = lojaAtualId();
  const loja = await buscarLoja(storeId);
  const prod = await buscarProduto(codigo);

  if (ehAuto(loja) && /^\d{8,14}$/.test(codigo)) {
    const noCarrinho = await itemDoCarrinho(codigo);
    if (noCarrinho?.origem === "site" && Date.now() - (noCarrinho.consultadoEm || 0) < REUSAR_PRECO_MS) {
      await adicionar(codigo, 1, noCarrinho.cents, storeId);
      vibrate();
      toast(`${prod?.name || codigo} +1 · ${brl(noCarrinho.cents)}`);
      aoAdicionar?.();
      return true;
    }
    aoBuscar?.(true);
    const r = await consultarPreco(codigo, loja, prod?.name);
    aoBuscar?.(false);
    if (r.ok) {
      const meta = await guardarResultadoSite(codigo, storeId, r.dados);
      await adicionar(codigo, 1, r.dados.centavos, storeId, meta);
      vibrate();
      const nomeItem = meta.nomeEncontrado ? prod?.name || r.dados.nome : r.dados.nome;
      toast(`${nomeItem} +1 · ${brl(r.dados.centavos)} · ` + (meta.nomeEncontrado ? (nomeItem === meta.nomeEncontrado ? "aproximado (achado pelo nome)" : `aproximado (parecido: ${meta.nomeEncontrado})`) : "preço do site")
        + (meta.disponivel ? "" : " (sem estoque no site: confira na gôndola)"),
        { action: "Ver", onAction: () => irProduto(codigo) });
      aoAdicionar?.();
      return true;
    }
    if (r.erro === "nao_encontrado") {
      vibrate([40, 40, 40]);
      irProduto(codigo, "&motivo=nao_encontrado");
      return false;
    }
    const ult = prod ? await ultimoPreco(storeId, codigo) : null;
    if (prod && ult != null) {
      await adicionar(codigo, 1, ult, storeId, { origem: "aproximado" });
      vibrate();
      toast(`${prod.name} +1 · ${brl(ult)} · aproximado (${r.erro === "offline" ? "sem internet" : "site sem resposta"})`);
      aoAdicionar?.();
      return true;
    }
    toast(r.erro === "limite" ? "Muitas consultas. Aguarde um instante ou informe o preço." : "Sem preço automático agora. Informe o preço.");
    irProduto(codigo, "&motivo=" + r.erro);
    return false;
  }

  const preco = prod ? await ultimoPreco(storeId, codigo) : null;
  if (prod && preco != null) {
    await adicionar(codigo, 1, preco, storeId, { origem: "manual" });
    vibrate();
    toast(`${prod.name} +1 · ${brl(preco)}`, { action: "Editar", onAction: () => irProduto(codigo) });
    aoAdicionar?.();
    return true;
  }
  vibrate([40, 40, 40]);
  irProduto(codigo);
  return false;
}

export async function render(view, { topo }) {
  topo({ titulo: "Escanear" });
  const loja = await buscarLoja(lojaAtualId());
  const auto = ehAuto(loja);
  const video = h("video", { class: "video", playsinline: true, muted: true, "aria-label": "Imagem da câmera" });
  const status = h("p", { class: "scan-status" }, "Preparando a câmera…");
  const camBox = h("div", { class: "camera" }, video, h("div", { class: "mira", "aria-hidden": "true" }), status);
  const resumoBar = h("a", { href: "#/lista", class: "barra-total" });
  const buscando = h("p", { class: "buscando", hidden: true, role: "status" }, h("span", { class: "giro", "aria-hidden": "true" }), "Buscando preço no " + nomeRede(loja) + "…");
  let scanner = null, saiu = false, ocupado = false;

  const atualizarBarra = async () => {
    const t = await totais();
    resumoBar.replaceChildren(icon("cart"), h("span", {}, `${t.qtd} ${t.qtd === 1 ? "item" : "itens"}`), h("strong", {}, brl(t.total)), h("span", { class: "seta" }, "Ver lista ›"));
  };
  const opcoes = { aoAdicionar: atualizarBarra, aoBuscar: (b) => { buscando.hidden = !b; } };

  const inp = h("input", { class: "campo", id: "codigo-manual", inputmode: "numeric", placeholder: "Ex.: 7891234567890", autocomplete: "off", "aria-label": "Código de barras", maxlength: "14" });
  const erro = h("p", { class: "erro", hidden: true });
  const btnAdd = h("button", { class: "btn btn-primario", type: "submit" }, "Adicionar");
  const form = h("form", { class: "card manual", novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (ocupado) return;
    const c = inp.value.replace(/\D/g, "");
    if (!codigoValido(c)) { erro.textContent = "Digite só os números do código (4 a 14 dígitos)."; erro.hidden = false; inp.focus(); return; }
    erro.hidden = true;
    inp.value = "";
    ocupado = true; btnAdd.disabled = true;
    try { await tratarCodigo(c, opcoes); } finally { ocupado = false; btnAdd.disabled = false; }
  } },
    h("label", { class: "rotulo", for: "codigo-manual" }, icon("keyboard"), " Digitar o código"),
    h("div", { class: "linha" }, inp, btnAdd),
    erro, buscando,
    h("button", { type: "button", class: "btn btn-claro btn-bloco", onclick: () => go("#/produto/" + novoCodigoSemBarra() + "?de=scan") }, icon("plus"), "Item sem código (granel, feira…)"));

  const ligar = async () => {
    if (!(await scannerDisponivel())) {
      status.textContent = "Este navegador não lê código pela câmera. Digite o código abaixo.";
      camBox.classList.add("sem-camera");
      return;
    }
    try {
      status.textContent = "Aponte para o código de barras";
      const s = await iniciarScanner(video, async (c) => {
        if (ocupado || saiu) return;
        ocupado = true;
        try { status.textContent = "Lido: " + c; await tratarCodigo(c, opcoes); }
        finally { ocupado = false; }
      });
      if (saiu) s.stop(); else scanner = s;
      camBox.classList.add("ligada");
    } catch (e) {
      camBox.classList.add("sem-camera");
      status.textContent = e?.name === "NotAllowedError"
        ? "Sem permissão para a câmera. Libere nas configurações do navegador ou digite o código abaixo."
        : "Não foi possível abrir a câmera. Digite o código abaixo.";
    }
  };

  view.append(
    h("a", { href: "#/loja", class: "pilula-loja" }, loja ? avatarLoja(loja, "avatar avatar-mini") : null, h("span", {}, loja?.name || "Loja"), h("small", {}, "trocar")),
    auto ? h("p", { class: "selo-auto" }, icon("tag"), " Preço automático pelo site do " + nomeRede(loja)) : null,
    camBox, form, resumoBar);
  atualizarBarra();
  ligar();
  const aoOcultar = () => { if (document.visibilityState === "hidden") { scanner?.stop(); scanner = null; } else if (!scanner && !saiu && camBox.classList.contains("ligada")) ligar(); };
  document.addEventListener("visibilitychange", aoOcultar);
  return () => { saiu = true; scanner?.stop(); document.removeEventListener("visibilitychange", aoOcultar); };
}
