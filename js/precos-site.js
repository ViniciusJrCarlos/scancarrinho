import { WORKER_URL, TEMPO_MAX_MS } from "./config.js";
/*
 * Cliente do Worker de preços (Atacadão, Sam's Club, Bistek, Supernosso, Covabra). Nunca lança erro: devolve
 * { ok: true, dados } ou { ok: false, erro: "nao_encontrado" | "limite" | "origem_indisponivel" | "offline" | "invalido", mensagem }.
 */
async function chamar(caminho) {
  if (!navigator.onLine) return { ok: false, erro: "offline", mensagem: "Sem internet." };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_MAX_MS);
  try {
    const r = await fetch(WORKER_URL + caminho, { signal: ctrl.signal, cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.encontrado === false) return { ok: false, erro: "nao_encontrado", mensagem: d.mensagem || "Não encontrado." };
    if (r.ok && Array.isArray(d.unidades) && !d.unidades.length) return { ok: false, erro: "nao_encontrado", mensagem: "Nenhuma unidade para este CEP." };
    if (r.ok) return { ok: true, dados: d };
    return { ok: false, erro: d.erro || "origem_indisponivel", mensagem: d.mensagem || "Erro " + r.status };
  } catch (e) {
    return { ok: false, erro: e?.name === "AbortError" ? "origem_indisponivel" : "offline",
      mensagem: e?.name === "AbortError" ? "A consulta demorou demais." : "Não foi possível consultar o preço." };
  } finally { clearTimeout(t); }
}
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();
export const buscarUnidades = (cep, rede = "atacadao") => chamar("/unidades?" + q({ cep, rede }));
/* nome: nome do produto já conhecido, ajuda a busca aproximada quando o código não existe na rede. */
export const buscarPreco = (ean, { rede = "atacadao", unidade, nome } = {}) =>
  chamar("/preco?" + q({ ean, rede, unidade, nome: (nome || "").slice(0, 120) }));
