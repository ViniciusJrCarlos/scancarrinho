import { dbGet, dbPut } from "./db.js";
export const buscarProduto = (barcode) => dbGet("products", barcode);
export async function salvarProduto(p) {
  const atual = (await dbGet("products", p.barcode)) || {};
  return dbPut("products", { ...atual, ...p, origem: p.origem || atual.origem || "manual", updated: Date.now() });
}
/* Código válido: só números, de 4 a 14 dígitos (EAN-8, EAN-13, UPC...). Itens sem código usam "SEM-...". */
export const codigoValido = (c) => /^\d{4,14}$/.test(c) || /^SEM-[a-z0-9]+$/.test(c);
export const novoCodigoSemBarra = () => "SEM-" + Date.now().toString(36);
