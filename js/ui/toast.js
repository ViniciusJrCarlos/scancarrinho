import { h } from "./dom.js";
/* Aviso rápido no rodapé, com ação opcional (ex.: "Ver", "Atualizar"). */
export function toast(msg, { action, onAction, ms = 2600, sticky = false } = {}) {
  const box = document.getElementById("toasts");
  // Um aviso por vez: o novo substitui o anterior (não cobre a tela).
  box.replaceChildren();
  const close = () => { el.classList.add("saindo"); setTimeout(() => el.remove(), 250); };
  const el = h("div", { class: "toast", role: "status" },
    h("span", {}, msg),
    action && h("button", { type: "button", class: "toast-btn", onclick: () => { close(); onAction?.(); } }, action));
  box.append(el);
  if (!sticky) setTimeout(close, ms);
  return close;
}
