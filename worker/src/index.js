/*
 * ScanCarrinho — Worker de preços (proxy do Atacadão).
 * Só 3 endpoints, com validação rígida. Nunca repassa URL livre (não é proxy aberto).
 *   GET /unidades?cep=01310100
 *   GET /produto?ean=7891000100103
 *   GET /preco?ean=7891000100103&unidade=atacadaobr340
 * Cache no KV (workers.dev não usa a Cache API), CORS só para o site do app,
 * limite por IP (melhor esforço, em memória) e tempo máximo de 8 s no Atacadão.
 */
const ORIGEM = "https://www.atacadao.com.br";
const UA = "ScanCarrinho/0.3 (uso pessoal; GitHub ViniciusJrCarlos)";
const TEMPO_MAX_MS = 8000;
const TTL = { unidades: 7 * 86400, produto: 7 * 86400, naoEncontrado: 86400, preco: 6 * 3600 };
const LIMITE_MIN = 60;      // consultas por minuto por IP
const LIMITE_DIA = 1000;    // consultas por dia por IP

const RE = { cep: /^\d{8}$/, ean: /^\d{8,14}$/, unidade: /^atacadaobr\d{1,6}$/ };

// ---------- CORS ----------
function origensPermitidas(env) {
  const extra = (env.DEV_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return [env.ALLOWED_ORIGIN || "https://viniciusjrcarlos.github.io", ...extra];
}
function cors(req, env) {
  const o = req.headers.get("Origin");
  if (!o || !origensPermitidas(env).includes(o)) return null;
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra },
  });
}
const erro = (codigo, mensagem, status, extra) => json({ erro: codigo, mensagem }, status, extra);

// ---------- Limite por IP (melhor esforço: por instância do Worker) ----------
const contadores = new Map();
function limitar(ip) {
  const agora = Date.now();
  const min = Math.floor(agora / 60000), dia = Math.floor(agora / 86400000);
  let c = contadores.get(ip);
  if (!c || c.dia !== dia) c = { dia, nDia: 0, min, nMin: 0 };
  if (c.min !== min) { c.min = min; c.nMin = 0; }
  c.nMin++; c.nDia++;
  contadores.set(ip, c);
  if (contadores.size > 5000) contadores.clear();
  if (c.nDia > LIMITE_DIA) return 3600;
  if (c.nMin > LIMITE_MIN) return 60 - Math.floor((agora % 60000) / 1000);
  return 0;
}

// ---------- Chamadas ao Atacadão ----------
class OrigemErro extends Error {}
async function buscar(caminho, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_MAX_MS);
  try {
    const r = await fetch(ORIGEM + caminho, {
      ...init, signal: ctrl.signal, redirect: "follow",
      headers: { "User-Agent": UA, "Accept": "application/json", ...(init.headers || {}) },
    });
    if (!r.ok && r.status !== 206) throw new OrigemErro("HTTP " + r.status);
    const ct = r.headers.get("Content-Type") || "";
    if (!ct.includes("json")) throw new OrigemErro("resposta não-JSON");
    return await r.json();
  } catch (e) {
    throw e instanceof OrigemErro ? e : new OrigemErro(e.name === "AbortError" ? "tempo esgotado" : String(e.message || e));
  } finally { clearTimeout(t); }
}

// ---------- Cache (KV) ----------
async function comCache(env, chave, ttl, produzir) {
  if (env.CACHE) {
    const v = await env.CACHE.get(chave, "json");
    if (v) return { ...v, cache: true };
  }
  const { valor, ttl: ttlFinal = ttl } = await produzir();
  if (env.CACHE) await env.CACHE.put(chave, JSON.stringify(valor), { expirationTtl: Math.max(60, ttlFinal) });
  return { ...valor, cache: false };
}

async function unidades(env, cep) {
  return comCache(env, "u:" + cep, TTL.unidades, async () => {
    const d = await buscar(`/io/api/checkout/pub/regions?country=BRA&postalCode=${cep}`);
    const r = Array.isArray(d) ? d[0] : null;
    const lista = (r?.sellers || []).filter((s) => RE.unidade.test(s.id)).map((s) => ({ id: s.id, nome: s.name }));
    return { valor: { cep, regionId: r?.id || null, unidades: lista } };
  });
}

async function produto(env, ean) {
  return comCache(env, "p:" + ean, TTL.produto, async () => {
    const d = await buscar(`/io/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`);
    const p = Array.isArray(d) ? d[0] : null;
    if (!p) return { valor: { ean, encontrado: false }, ttl: TTL.naoEncontrado };
    const item = p.items.find((i) => i.ean === ean) || p.items[0];
    const cat = (p.categories?.[0] || "").split("/").filter(Boolean);
    return { valor: {
      ean, encontrado: true, sku: String(item.itemId), nome: p.productName, marca: p.brand || "",
      imagem: item.images?.[0]?.imageUrl || "", categoria: cat[0] || "", subcategoria: cat.at(-1) || "",
    } };
  });
}

async function preco(env, ean, unidade) {
  const prod = await produto(env, ean);
  if (!prod.encontrado) return prod;
  return comCache(env, `v:${ean}:${unidade}`, TTL.preco, async () => {
    const d = await buscar("/io/api/checkout/pub/orderForms/simulation?sc=1", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: prod.sku, quantity: 1, seller: unidade }], country: "BRA" }),
    });
    const it = d?.items?.[0];
    const centavos = Number.isInteger(it?.sellingPrice) ? it.sellingPrice : Number.isInteger(it?.price) ? it.price : null;
    return { valor: {
      ean, encontrado: centavos != null, sku: prod.sku, nome: prod.nome, marca: prod.marca, imagem: prod.imagem,
      categoria: prod.categoria, subcategoria: prod.subcategoria, unidade,
      centavos, disponivel: it?.availability === "available", consultadoEm: new Date().toISOString(), origem: "atacadao",
    }, ttl: centavos == null ? TTL.naoEncontrado : TTL.preco };
  });
}

// ---------- Rotas ----------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const ch = cors(req, env);
    const rotas = ["/unidades", "/produto", "/preco"];
    if (!rotas.includes(url.pathname)) {
      if (url.pathname === "/") return json({ app: "ScanCarrinho — preços", endpoints: rotas }, 200, ch || {});
      return erro("nao_encontrado", "Endereço inexistente.", 404, ch || {});
    }
    if (req.headers.get("Origin") && !ch) return erro("origem_proibida", "Origem não permitida.", 403);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: ch || {} });
    if (req.method !== "GET") return erro("invalido", "Use GET.", 405, ch || {});
    const h = ch || {};

    const espera = limitar(req.headers.get("CF-Connecting-IP") || "?");
    if (espera) return erro("limite", "Muitas consultas. Aguarde um instante.", 429, { ...h, "Retry-After": String(espera) });

    const q = url.searchParams;
    try {
      if (url.pathname === "/unidades") {
        const cep = (q.get("cep") || "").replace(/\D/g, "");
        if (!RE.cep.test(cep)) return erro("invalido", "CEP deve ter 8 dígitos.", 400, h);
        const r = await unidades(env, cep);
        // Sem unidade para o CEP é resposta normal (200 com lista vazia), não erro.
        return json(r, 200, h);
      }
      const ean = q.get("ean") || "";
      if (!RE.ean.test(ean)) return erro("invalido", "Código (EAN) deve ter de 8 a 14 dígitos.", 400, h);
      if (url.pathname === "/produto") {
        const r = await produto(env, ean);
        // "Não encontrado" é resposta normal (200 + encontrado:false) para o app não registrar erro.
        return json(r.encontrado ? r : { ean, encontrado: false, erro: "nao_encontrado", mensagem: "Produto não encontrado no Atacadão." }, 200, h);
      }
      const unidade = q.get("unidade") || "";
      if (!RE.unidade.test(unidade)) return erro("invalido", "Unidade inválida.", 400, h);
      const r = await preco(env, ean, unidade);
      return json(r.encontrado ? r : { ean, encontrado: false, erro: "nao_encontrado", mensagem: "Produto ou preço não encontrado nesta unidade." }, 200, h);
    } catch (e) {
      const tempo = /tempo/.test(e.message);
      return erro("origem_indisponivel", "O site do Atacadão não respondeu. Tente de novo.", tempo ? 504 : 502, h);
    }
  },
};
