import { h } from "./dom.js";
/* Diálogo próprio (no estilo do app). Resolve com o valor do botão ou null ao cancelar. */
export function openDialog({ title, body, actions }) {
  return new Promise((resolve) => {
    const back = h("div", { class: "dlg-fundo" });
    const done = (v) => { document.removeEventListener("keydown", onKey); back.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    const dlg = h("div", { class: "dlg", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("h2", {}, title),
      body,
      h("div", { class: "dlg-acoes" }, actions.map((a) =>
        h("button", { type: "button", class: "btn " + (a.danger ? "btn-perigo" : a.primary ? "btn-primario" : "btn-claro"),
          onclick: async () => { const v = a.get ? await a.get() : a.value; if (v !== undefined) done(v); } }, a.label))));
    back.addEventListener("click", (e) => { if (e.target === back) done(null); });
    back.append(dlg);
    document.body.append(back);
    document.addEventListener("keydown", onKey);
    (dlg.querySelector("input,select") || dlg.querySelector(".btn-primario,.btn-perigo"))?.focus();
  });
}
export const confirmar = (title, text, { ok = "Confirmar", danger = false } = {}) =>
  openDialog({ title, body: h("p", {}, text), actions: [{ label: "Cancelar", value: false }, { label: ok, value: true, danger, primary: !danger }] })
    .then((v) => v === true);
/* Pede um texto. validate devolve mensagem de erro ou "" quando está ok. */
export function pedirTexto({ title, label, value = "", placeholder = "", inputmode = "text", validate = () => "" }) {
  const inp = h("input", { class: "campo", value, placeholder, inputmode, autocomplete: "off" });
  const err = h("p", { class: "erro", hidden: true });
  const form = h("form", { class: "dlg-form", onsubmit: (e) => { e.preventDefault(); form.closest(".dlg").querySelector(".btn-primario").click(); } },
    h("label", {}, h("span", { class: "rotulo" }, label), inp), err);
  return openDialog({ title, body: form, actions: [{ label: "Cancelar", value: null }, { label: "OK", primary: true,
    get: () => { const v = inp.value.trim(); const m = validate(v); if (m) { err.textContent = m; err.hidden = false; inp.focus(); return undefined; } return v; } }] });
}
