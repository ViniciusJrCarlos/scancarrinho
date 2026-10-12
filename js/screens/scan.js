import { h, vibrate } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { go } from "../ui/nav.js";
import { toast } from "../ui/toast.js";
import { brl } from "../ui/money.js";
import { buscarLoja, lojaAtualId } from "../stores.js";
import { buscarProduto, codigoValido, novoCodigoSemBarra } from "../products.js";
import { ultimoPreco } from "../prices.js";
import { adicionar, totais } from "../cart.js";
import { iniciarScanner, scannerDisponivel } from "../scanner.js";
import { avatarLoja } from "./loja.js";

/* Usado pela câmera e pela digitação: produto conhecido com preço nesta loja entra direto (+1). */
export async function tratarCodigo(codigo, { aoAdicionar } = {}) {
  const storeId = lojaAtualId();
  const prod = await buscarProduto(codigo);
  const preco = prod ? await ultimoPreco(storeId, codigo) : null;
  if (prod && preco != null) {
    await adicionar(codigo, 1, preco, storeId);
    vibrate();
    toast(`${prod.name} +1 · ${brl(preco)}`, { action: "Editar", onAction: () => go("#/produto/" + encodeURIComponent(codigo) + "?de=scan") });
    aoAdicionar?.();
    return true;
  }
  vibrate([40, 40, 40]);
  go("#/produto/" + encodeURIComponent(codigo) + "?de=scan");
  return false;
}

export async function render(view, { topo }) {
  topo({ titulo: "Escanear" });
  const loja = await buscarLoja(lojaAtualId());
  const video = h("video", { class: "video", playsinline: true, muted: true, "aria-label": "Imagem da câmera" });
  const status = h("p", { class: "scan-status" }, "Preparando a câmera…");
  const camBox = h("div", { class: "camera" }, video, h("div", { class: "mira", "aria-hidden": "true" }), status);
  const resumoBar = h("a", { href: "#/lista", class: "barra-total" });
  let scanner = null, saiu = false, ocupado = false;

  const atualizarBarra = async () => {
    const t = await totais();
    resumoBar.replaceChildren(icon("cart"), h("span", {}, `${t.qtd} ${t.qtd === 1 ? "item" : "itens"}`), h("strong", {}, brl(t.total)), h("span", { class: "seta" }, "Ver lista ›"));
  };

  const inp = h("input", { class: "campo", inputmode: "numeric", placeholder: "Ex.: 7891234567890", autocomplete: "off", "aria-label": "Código de barras", maxlength: "14" });
  const erro = h("p", { class: "erro", hidden: true });
  const form = h("form", { class: "card manual", novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const c = inp.value.replace(/\D/g, "");
    if (!codigoValido(c)) { erro.textContent = "Digite só os números do código (4 a 14 dígitos)."; erro.hidden = false; inp.focus(); return; }
    erro.hidden = true;
    inp.value = "";
    await tratarCodigo(c, { aoAdicionar: atualizarBarra });
  } },
    h("label", { class: "rotulo", for: "codigo-manual" }, icon("keyboard"), " Digitar o código"),
    h("div", { class: "linha" }, Object.assign(inp, { id: "codigo-manual" }), h("button", { class: "btn btn-primario", type: "submit" }, "Adicionar")),
    erro,
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
        try { status.textContent = "Lido: " + c; await tratarCodigo(c, { aoAdicionar: atualizarBarra }); }
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
    camBox, form, resumoBar);
  atualizarBarra();
  ligar();
  const aoOcultar = () => { if (document.visibilityState === "hidden") { scanner?.stop(); scanner = null; } else if (!scanner && !saiu && camBox.classList.contains("ligada")) ligar(); };
  document.addEventListener("visibilitychange", aoOcultar);
  return () => { saiu = true; scanner?.stop(); document.removeEventListener("visibilitychange", aoOcultar); };
}
