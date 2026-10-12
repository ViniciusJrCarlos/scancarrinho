import { dbByIndex, dbPut } from "./db.js";
/*
 * Fonte de preços plugável.
 * Uma fonte é um objeto com: id, label e os métodos assíncronos
 *   history(storeId, barcode) -> [{ cents, date }] (mais antigo primeiro)
 *   latest(storeId, barcode)  -> centavos | null
 *   average(storeId, barcode) -> { cents, count } | null (média dos preços registrados)
 *   record(storeId, barcode, cents) -> grava um preço informado
 * Hoje a fonte padrão é a local (preços digitados por você, por loja, no IndexedDB).
 * No futuro, uma fonte real (API) pode ser ligada com setPriceSource(...).
 */
export const localPriceSource = {
  id: "local",
  label: "Preços anotados por você",
  async history(storeId, barcode) {
    const l = await dbByIndex("prices", "storeBarcode", [storeId, barcode]);
    return l.sort((a, b) => a.date - b.date);
  },
  async latest(storeId, barcode) {
    const h = await this.history(storeId, barcode);
    return h.length ? h.at(-1).cents : null;
  },
  async average(storeId, barcode) {
    const h = await this.history(storeId, barcode);
    if (!h.length) return null;
    return { cents: Math.round(h.reduce((s, x) => s + x.cents, 0) / h.length), count: h.length };
  },
  async record(storeId, barcode, cents) {
    await dbPut("prices", { storeId, barcode, cents, date: Date.now() });
  },
};
const METODOS = ["history", "latest", "average", "record"];
let fonte = localPriceSource;
export function setPriceSource(src) {
  for (const m of METODOS) if (typeof src?.[m] !== "function") throw new TypeError(`Fonte de preços sem o método ${m}()`);
  fonte = src;
}
export const getPriceSource = () => fonte;
export const historicoPreco = (s, b) => fonte.history(s, b);
export const ultimoPreco = (s, b) => fonte.latest(s, b);
export const mediaPreco = (s, b) => fonte.average(s, b);
/* Registra o preço informado. Cada vez que você confirma um preço novo ele entra no histórico. */
export async function registrarPreco(storeId, barcode, cents, { sempre = false } = {}) {
  const ult = await fonte.latest(storeId, barcode);
  if (sempre || ult !== cents) await fonte.record(storeId, barcode, cents);
}
