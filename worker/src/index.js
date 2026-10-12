/*
 * ScanCarrinho — Worker de preços (proxy de redes VTEX: Atacadão, Sam's Club, Bistek, Supernosso, Covabra).
 * Só 3 endpoints, com validação rígida. Nunca repassa URL livre (não é proxy aberto).
 *   GET /unidades?cep=01310100[&rede=sams]
 *   GET /produto?ean=7891000100103[&rede=bistek]
 *   GET /preco?ean=7891000100103&unidade=atacadaobr340[&rede=atacadao][&nome=...]
 * Sem "rede" = atacadao (compatível com o app v0.3.0).
 * Redes regionais (preço muda por loja) pedem "unidade"; as de preço único não.
 * Se o EAN não existir na rede, tenta busca por nome (resultado marcado aproximado:true).
 * Cache no KV (workers.dev não usa a Cache API), CORS só para o site do app,
 * limite por IP (melhor esforço, em memória) e tempo máximo de 8 s na origem.
 */
const REDES = {
  atacadao:   { nome: "Atacadão",    base: "https://www.atacadao.com.br",  api: "/io/api", regional: true,  unidade: /^atacadaobr\d{1,6}$/ },
  sams:       { nome: "Sam's Club",  base: "https://www.samsclub.com.br",  api: "/api",    regional: true,  unidade: /^samsclub\d{1,6}$/ },
  bistek:     { nome: "Bistek",      base: "https://www.bistek.com.br",    api: "/api",    regional: true,  unidade: /^bistek\d{1,4}$/ },
  supernosso: { nome: "Supernosso",  base: "https://www.supernosso.com",   api: "/api",    regional: false, seller: "1" },
  covabra:    { nome: "Covabra",     base: "https://www.covabra.com.br",   api: "/api",    regional: false, seller: "1" },
};
const UA = "ScanCarrinho/0.4 (uso pessoal; GitHub ViniciusJrCarlos)";
const TEMPO_MAX_MS = 8000;
const TTL = { unidades: 7 * 86400, produto: 7 * 86400, naoEncontrado: 86400, preco: 6 * 3600 };
const LIMITE_MIN = 60;      // consultas por minuto por IP
const LIMITE_DIA = 1000;    // consultas por dia por IP

const RE = { cep: /^\d{8}$/, ean: /^\d{8,14}$/ };
// Chaves de cache: o Atacadão mantém as chaves da v0.3.0; as outras redes ganham prefixo.
const pref = (rede) => (rede === "atacadao" ? "" : rede + ":");

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

// ---------- Chamadas à origem ----------
class OrigemErro extends Error {}
async function buscar(rede, caminho, init = {}, semPrefixo = false) {
  const R = REDES[rede];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_MAX_MS);
  try {
    const r = await fetch(R.base + (semPrefixo ? "" : R.api) + caminho, {
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

async function unidades(env, rede, cep) {
  return comCache(env, pref(rede) + "u:" + cep, TTL.unidades, async () => {
    const d = await buscar(rede, `/checkout/pub/regions?country=BRA&postalCode=${cep}`);
    const r = Array.isArray(d) ? d[0] : null;
    const lista = (r?.sellers || []).filter((s) => REDES[rede].unidade.test(s.id)).map((s) => ({ id: s.id, nome: s.name && s.name !== s.id ? s.name : `${REDES[rede].nome} loja ${s.id.replace(/\D/g, "")}` }));
    return { valor: { rede, cep, regionId: r?.id || null, unidades: lista } };
  });
}

function montarProduto(p, ean) {
  const item = p.items.find((i) => i.ean === ean) || p.items[0];
  const cat = (p.categories?.[0] || "").split("/").filter(Boolean);
  return {
    sku: String(item.itemId), nome: p.productName, marca: p.brand || "", eanEncontrado: item.ean || "",
    imagem: item.images?.[0]?.imageUrl || "", categoria: cat[0] || "", subcategoria: cat.at(-1) || "",
  };
}

async function produto(env, rede, ean) {
  return comCache(env, pref(rede) + "p:" + ean, TTL.produto, async () => {
    const d = await buscar(rede, `/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`);
    const p = Array.isArray(d) ? d[0] : null;
    if (!p?.items?.length) return { valor: { ean, encontrado: false }, ttl: TTL.naoEncontrado };
    const { eanEncontrado, ...info } = montarProduto(p, ean);
    return { valor: { ean, encontrado: true, ...info } };
  });
}

// Nome para a busca aproximada: o enviado pelo app, ou o desse EAN em outra rede.
async function nomeDoEan(env, rede, ean, nomeApp) {
  if (nomeApp) return nomeApp;
  for (const outra of Object.keys(REDES)) {
    if (outra === rede) continue;
    try { const p = await produto(env, outra, ean); if (p.encontrado) return p.nome; } catch { /* tenta a próxima */ }
  }
  return "";
}
const limparNome = (n) => n.replace(/[^\p{L}\p{N}\s,.]/gu, " ").replace(/\b(cada|un|und|unidade)\b/gi, " ")
  .replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");

const VARIANTES = new Set(["zero", "diet", "light", "lactose", "integral", "desnatado", "semidesnatado", "sem", "acucar", "laranja", "uva", "limao", "guarana"]);
async function porNome(env, rede, ean, nomeApp) {
  const nome = limparNome(await nomeDoEan(env, rede, ean, nomeApp));
  if (nome.length < 3) return { ean, encontrado: false };
  return comCache(env, `${rede}:n:${nome.toLowerCase()}`, TTL.produto, async () => {
    const d = await buscar(rede, `/api/io/_v/api/intelligent-search/product_search?query=${encodeURIComponent(nome)}&count=5`, {}, true);
    // Escolhe o resultado com mais palavras em comum; evita kits/packs se não foram pedidos.
    const tokens = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 1);
    const alvo = new Set(tokens(nome));
    const nota = (x) => tokens(x.productName).reduce((n, w) => n + (alvo.has(w) ? 1 : 0), 0)
      - tokens(x.productName).filter((w) => VARIANTES.has(w) && !alvo.has(w)).length * 2
      - (/\b(kit|pack|combo|leve|caixa com)\b/i.test(x.productName) && !/\b(kit|pack|combo)\b/i.test(nome) ? 3 : 0);
    const p = (d?.products || []).filter((x) => x.items?.length).map((x, i) => [nota(x) - i * 0.01, x]).sort((a, b) => b[0] - a[0])[0]?.[1];
    if (!p) return { valor: { ean, encontrado: false }, ttl: TTL.naoEncontrado };
    const info = montarProduto(p, ean);
    return { valor: { ean, encontrado: true, aproximado: true, buscaPor: nome, nomeEncontrado: info.nome, ...info } };
  });
}

async function preco(env, rede, ean, unidade, nomeApp) {
  const R = REDES[rede];
  let prod = await produto(env, rede, ean);
  if (!prod.encontrado) prod = await porNome(env, rede, ean, nomeApp);
  if (!prod.encontrado) return prod;
  const seller = R.regional ? unidade : R.seller;
  return comCache(env, `${pref(rede)}v:${ean}:${seller}${prod.aproximado ? ":a" + prod.sku : ""}`, TTL.preco, async () => {
    const d = await buscar(rede, "/checkout/pub/orderForms/simulation?sc=1", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: prod.sku, quantity: 1, seller }], country: "BRA" }),
    });
    const it = d?.items?.[0];
    const centavos = Number.isInteger(it?.sellingPrice) && it.sellingPrice > 0 ? it.sellingPrice
      : Number.isInteger(it?.price) && it.price > 0 ? it.price : null;
    const { cache, ...p } = prod;
    return { valor: {
      ...p, encontrado: centavos != null, rede, unidade: R.regional ? unidade : null,
      centavos, disponivel: it?.availability === "available", consultadoEm: new Date().toISOString(), origem: rede,
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
      if (url.pathname === "/") return json({ app: "ScanCarrinho — preços", endpoints: rotas,
        redes: Object.entries(REDES).map(([id, r]) => ({ id, nome: r.nome, regional: r.regional })) }, 200, ch || {});
      return erro("nao_encontrado", "Endereço inexistente.", 404, ch || {});
    }
    if (req.headers.get("Origin") && !ch) return erro("origem_proibida", "Origem não permitida.", 403);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: ch || {} });
    if (req.method !== "GET") return erro("invalido", "Use GET.", 405, ch || {});
    const h = ch || {};

    const espera = limitar(req.headers.get("CF-Connecting-IP") || "?");
    if (espera) return erro("limite", "Muitas consultas. Aguarde um instante.", 429, { ...h, "Retry-After": String(espera) });

    const q = url.searchParams;
    const rede = q.get("rede") || "atacadao";
    if (!Object.hasOwn(REDES, rede)) return erro("invalido", "Rede desconhecida.", 400, h);
    const R = REDES[rede];
    try {
      if (url.pathname === "/unidades") {
        const cep = (q.get("cep") || "").replace(/\D/g, "");
        if (!RE.cep.test(cep)) return erro("invalido", "CEP deve ter 8 dígitos.", 400, h);
        if (!R.regional) return json({ rede, cep, regionId: null, unidades: [], regional: false }, 200, h);
        const r = await unidades(env, rede, cep);
        // Sem unidade para o CEP é resposta normal (200 com lista vazia), não erro.
        return json(r, 200, h);
      }
      const ean = q.get("ean") || "";
      if (!RE.ean.test(ean)) return erro("invalido", "Código (EAN) deve ter de 8 a 14 dígitos.", 400, h);
      if (url.pathname === "/produto") {
        const r = await produto(env, rede, ean);
        // "Não encontrado" é resposta normal (200 + encontrado:false) para o app não registrar erro.
        return json(r.encontrado ? r : { ean, encontrado: false, erro: "nao_encontrado", mensagem: `Produto não encontrado no ${R.nome}.` }, 200, h);
      }
      const unidade = q.get("unidade") || "";
      if (R.regional && !R.unidade.test(unidade)) return erro("invalido", "Unidade inválida.", 400, h);
      const nome = (q.get("nome") || "").slice(0, 120);
      const r = await preco(env, rede, ean, unidade, nome);
      return json(r.encontrado ? r : { ean, encontrado: false, erro: "nao_encontrado", mensagem: "Produto ou preço não encontrado nesta unidade." }, 200, h);
    } catch (e) {
      const tempo = /tempo/.test(e.message);
      return erro("origem_indisponivel", `O site do ${R.nome} não respondeu. Tente de novo.`, tempo ? 504 : 502, h);
    }
  },
};
