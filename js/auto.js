import { consultarPreco, registrarPreco } from "./prices.js";
import { buscarProduto, salvarProduto } from "./products.js";
import { categoriaDoSite } from "./categories.js";
import { itemDoCarrinho, definir } from "./cart.js";
/*
 * Preço automático: grava produto e preço observado e devolve os dados para o carrinho.
 * Resultado "aproximado" (achado pelo nome, não pelo código): não troca o nome que você já tem.
 */
export async function guardarResultadoSite(codigo, storeId, d) {
  const prod = await buscarProduto(codigo);
  const categoria = prod?.origem === "manual" && prod.category ? prod.category : categoriaDoSite(d.categoria, d.subcategoria);
  const aprox = d.aproximado === true;
  if (aprox) { if (!prod) await salvarProduto({ barcode: codigo, name: d.nome, brand: d.marca || "", category: categoria, origem: d.origem || "site" }); }
  else await salvarProduto({ barcode: codigo, name: d.nome, brand: d.marca || "", sku: d.sku, category: categoria, origem: d.origem || "site" });
  const origem = aprox ? "aproximado" : "site";
  await registrarPreco(storeId, codigo, d.centavos, { origem });
  return { origem, consultadoEm: Date.parse(d.consultadoEm) || Date.now(), disponivel: d.disponivel !== false,
    nomeEncontrado: aprox ? d.nomeEncontrado || d.nome : undefined };
}
/* Atualiza o preço de um item do carrinho pelo site. Devolve o resultado da consulta. */
export async function atualizarItem(codigo, loja) {
  const r = await consultarPreco(codigo, loja, (await buscarProduto(codigo))?.name);
  if (!r.ok) return r;
  const it = await itemDoCarrinho(codigo);
  const meta = await guardarResultadoSite(codigo, loja.id, r.dados);
  if (it) await definir(codigo, it.qty, r.dados.centavos, loja.id, meta);
  return r;
}
