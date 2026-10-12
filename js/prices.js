import { dbByIndex, dbPut } from "./db.js";
import { buscarPreco } from "./precos-site.js";
import { redeDaLoja, REDES } from "./redes.js";
/*
 * Fonte de preços plugável.
 * Uma fonte é um objeto com: id, label e os métodos assíncronos
 *   history(storeId, barcode) -> [{ cents, date, origem }] (mais antigo primeiro)
 *   latest(storeId, barcode)  -> centavos | null
 *   average(storeId, barcode) -> { cents, count } | null (média dos preços observados)
 *   record(storeId, barcode, cents, origem) -> grava um preço observado
 * e, opcionalmente, lookup(barcode, loja, nome) -> consulta automática de preço.
 * Fontes: localPriceSource (preços anotados) e sitePriceSource (Worker das redes + histórico local).
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
  async record(storeId, barcode, cents, origem = "manual") {
    await dbPut("prices", { storeId, barcode, cents, date: Date.now(), origem });
  },
};

/* Redes automáticas: consulta o Worker (preço da unidade ou da rede). O histórico continua local. */
export const sitePriceSource = {
  ...localPriceSource,
  id: "site",
  label: "Preço do site da rede",
  async lookup(barcode, loja, nome) {
    const rede = redeDaLoja(loja);
    if (!rede || !/^\d{8,14}$/.test(barcode)) return { ok: false, erro: "nao_suportado" };
    return buscarPreco(barcode, { rede, unidade: REDES[rede].regional ? loja.unidadeId : "", nome });
  },
};
export const atacadaoPriceSource = sitePriceSource; // nome da v0.3.0

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
export const consultarPreco = (b, loja, nome) => (fonte.lookup ? fonte.lookup(b, loja, nome) : Promise.resolve({ ok: false, erro: "nao_suportado" }));
/* Registra o preço observado quando muda (ou, para o site, quando o último tem mais de 24 h). */
export async function registrarPreco(storeId, barcode, cents, { origem = "manual", sempre = false } = {}) {
  const h = await fonte.history(storeId, barcode);
  const ult = h.at(-1);
  const velho = ult && Date.now() - ult.date > 24 * 3600e3;
  if (sempre || !ult || ult.cents !== cents || (origem !== "manual" && velho)) await fonte.record(storeId, barcode, cents, origem);
}
