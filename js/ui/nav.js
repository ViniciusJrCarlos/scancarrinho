/* Navegação por hash (#/loja, #/scan, #/lista, #/produto/<codigo>, #/resumo). */
export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = hash;
}
