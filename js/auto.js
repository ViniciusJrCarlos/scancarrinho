import { consultarPreco, registrarPreco } from "./prices.js";
import { buscarProduto, salvarProduto } from "./products.js";
import { categoriaDoSite } from "./categories.js";
import { itemDoCarrinho, definir } from "./cart.js";
/* Preço automático (Atacadão): grava produto e preço observado e devolve os dados para o carrinho. */
export async function guardarResultadoSite(codigo, storeId, d) {
  const prod = await buscarProduto(codigo);
  const categoria = prod?.origem === "manual" && prod.category ? prod.category : categoriaDoSite(d.categoria, d.subcategoria);
  await salvarProduto({ barcode: codigo, name: d.nome, brand: d.marca || "", sku: d.sku, category: categoria, origem: "atacadao" });
  await registrarPreco(storeId, codigo, d.centavos, { origem: "site" });
  return { origem: "site", consultadoEm: Date.parse(d.consultadoEm) || Date.now(), disponivel: d.disponivel !== false };
}
/* Atualiza o preço de um item do carrinho pelo site. Devolve o resultado da consulta. */
export async function atualizarItem(codigo, loja) {
  const r = await consultarPreco(codigo, loja);
  if (!r.ok) return r;
  const it = await itemDoCarrinho(codigo);
  const meta = await guardarResultadoSite(codigo, loja.id, r.dados);
  if (it) await definir(codigo, it.qty, r.dados.centavos, loja.id, meta);
  return r;
}
