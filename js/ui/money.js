/* Valores guardados em centavos (inteiros) para não ter erro de arredondamento. */
const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (cents) => fmt.format((cents || 0) / 100);
/* Aceita "4,50", "4.50", "R$ 1.234,56". Devolve centavos ou NaN. */
export function parseBRL(text) {
  let s = String(text ?? "").trim().replace(/R\$|\s/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}
export const centsToInput = (c) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
export const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);
export const dataCurta = (ms) => new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
