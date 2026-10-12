import { dbAll, dbClear, dbDel, dbGet, dbPut } from "./db.js";
import { buscarProduto } from "./products.js";
import { mediaPreco } from "./prices.js";
/* Carrinho: chave = código de barras. Escanear de novo soma a quantidade. */
const avisar = () => window.dispatchEvent(new CustomEvent("carrinho"));
export const itemDoCarrinho = (barcode) => dbGet("cart", barcode);
export async function adicionar(barcode, qty, cents, storeId) {
  const cur = await dbGet("cart", barcode);
  await dbPut("cart", { barcode, qty: (cur?.qty || 0) + qty, cents, storeId, added: cur?.added || Date.now() });
  avisar();
}
export async function definir(barcode, qty, cents, storeId) {
  const cur = await dbGet("cart", barcode);
  await dbPut("cart", { barcode, qty, cents, storeId, added: cur?.added || Date.now() });
  avisar();
}
export async function remover(barcode) { await dbDel("cart", barcode); avisar(); }
export async function esvaziar() { await dbClear("cart"); avisar(); }
/* Itens com produto, total da linha e média do preço naquela loja. */
export async function itensDetalhados() {
  const itens = await dbAll("cart");
  return Promise.all(itens.map(async (i) => {
    const prod = (await buscarProduto(i.barcode)) || { name: i.barcode, category: "outros" };
    const media = await mediaPreco(i.storeId, i.barcode);
    return { ...i, name: prod.name, category: prod.category, total: i.cents * i.qty, media };
  }));
}
export async function totais() {
  const itens = await itensDetalhados();
  const total = itens.reduce((s, i) => s + i.total, 0);
  const totalMedia = itens.reduce((s, i) => s + (i.media ? i.media.cents : i.cents) * i.qty, 0);
  const qtd = itens.reduce((s, i) => s + i.qty, 0);
  return { itens, total, totalMedia, qtd };
}
export async function contagem() { return (await dbAll("cart")).reduce((s, i) => s + i.qty, 0); }
