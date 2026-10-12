# ScanCarrinho — Escopo (preço automático pelo Atacadão)

> Documento de escopo. Versão: 12/10/2026. Autor: Vinicius Carlos.
> Estado atual: v0.1.0 publicada; v0.2.0 pronta localmente (não publicada).

## 1. Objetivo

Durante as compras, **escanear o código de barras (EAN)** e o app **mostrar sozinho o preço** do produto na **unidade do Atacadão** escolhida pelo usuário (por CEP), somando o **total do carrinho**. Sem digitar preço: a digitação fica só como **plano B** quando o produto não for encontrado.

Fora do escopo agora: preço automático de Carrefour, Pão de Açúcar, Extra e Assaí (sites bloqueiam acesso automático; ficam como lojas "futuras", com preço manual).

## 2. Fluxo do usuário

1. **Primeiro uso:** abre o app → escolhe **Atacadão** → digita o **CEP** → escolhe a **unidade** (ex.: "Tatuapé") na lista retornada.
2. **No mercado:** aba **Escanear** → aponta a câmera para o código (ou digita o código).
3. O app busca o produto e o preço **daquela unidade**:
   - **Achou com preço:** entra no carrinho (+1), mostra "Moça 395g · R$ 9,98 · preço do site". Escanear de novo soma a quantidade.
   - **Achou, mas sem estoque na unidade:** entra com o preço retornado e o aviso "sem estoque no site — confira na gôndola".
   - **Não achou / sem internet / erro:** abre o cadastro manual (nome + preço), como na v0.2.0.
4. **Lista:** itens, quantidade, preço, total da linha, média de preço do produto, total do carrinho; editar quantidade ou corrigir preço.
5. **Resumo:** total, total por categoria (%), comparação com a média e "Finalizar compra" (vai para o histórico).

## 3. Telas (adaptação da v0.2.0)

| Tela | Mudança |
|---|---|
| **Loja** | Vira "Onde você compra?": cartão **Atacadão** (ativo, "preço automático") + campo **CEP** → lista de **unidades** (radio) → Continuar. Carrefour, Pão de Açúcar, Extra, Assaí e "+ Nova loja" ficam abaixo como "preço manual (em breve automático)". Trocar de unidade com carrinho cheio pede confirmação. |
| **Escanear** | Igual + indicador de busca ("Buscando preço…"), selo da origem do preço e plano B manual. Mostra "Unidade: Tatuapé · trocar". |
| **Produto** | Mostra **preço do site (unidade X)** com data/hora da consulta, **preço médio observado**, histórico, quantidade. Preço editável só por "Corrigir preço" (marca como manual). Botão "Atualizar preço". |
| **Lista** | Igual + selo por item: `site`, `manual` ou `aproximado`; aviso quando algum preço tem mais de 24 h. |
| **Resumo** | Igual + linha "Preços do site Atacadão (unidade X) — podem diferir da gôndola". |

## 4. Arquitetura

```
Celular (PWA no GitHub Pages)  ──HTTPS──▶  Cloudflare Worker (proxy)  ──▶  www.atacadao.com.br (VTEX)
  IndexedDB + cache offline                  allowlist + cache + CORS + limite
```

O PWA **não** chama o Atacadão direto: o site não envia cabeçalhos CORS (teste de 12/10/2026: sem `Access-Control-Allow-Origin`, OPTIONS → 405).

### 4.1 Endpoints do Worker (os únicos permitidos)

| Worker | Chama no Atacadão | Retorna |
|---|---|---|
| `GET /unidades?cep=01310100` | `GET /io/api/checkout/pub/regions?country=BRA&postalCode={cep}` | `{ regionId, unidades: [{ id: "atacadaobr340", nome: "Tatuapé" }] }` |
| `GET /produto?ean=7891000100103` | `GET /io/api/catalog_system/pub/products/search?fq=alternateIds_Ean:{ean}` | `{ ean, sku, nome, marca, imagem, categoria }` ou 404 |
| `GET /preco?ean=…&unidade=atacadaobr340` | produto (acima) + `POST /io/api/checkout/pub/orderForms/simulation?sc=1` com `{items:[{id:sku,quantity:1,seller:unidade}],country:"BRA"}` | `{ ean, sku, nome, centavos, disponivel, unidade, consultadoEm, origem:"atacadao" }` |

- Validação: `cep` = 8 dígitos; `ean` = 8 a 14 dígitos; `unidade` = `^atacadaobr\d+$`. Qualquer outro caminho → 404. O Worker **nunca** repassa URL livre (não é proxy aberto).
- Resposta enxuta (só os campos acima), sem cookies do Atacadão.

### 4.2 Cache (Workers KV, com expiração automática)

No `workers.dev` a Cache API não guarda nada, por isso o cache usa o KV (plano grátis: 100 mil leituras e 1 mil gravações por dia).

| Dado | Tempo |
|---|---|
| Unidades por CEP | 7 dias |
| Produto (EAN → SKU/nome) | 7 dias |
| "Não encontrado" | 1 dia |
| Preço por EAN + unidade | 6 horas |

### 4.3 CORS

- `Access-Control-Allow-Origin: https://viniciusjrcarlos.github.io` (só essa origem; `http://localhost:8080` só em modo desenvolvimento).
- Métodos: `GET, OPTIONS`. Responde ao OPTIONS com 204. Outras origens → 403.

### 4.4 Limites e proteção

- Por IP: até **60 consultas/min** e **1.000/dia** no Worker (contador em memória por instância, melhor esforço; ajustável). Acima → 429 com `Retry-After`.
- Ao Atacadão: no máximo **1 consulta de preço por EAN+unidade a cada 6 h** (cache) e **timeout de 8 s**.
- `User-Agent` identificável: `ScanCarrinho/0.3 (uso pessoal; contato: GitHub ViniciusJrCarlos)`.

### 4.5 Erros (formato único)

`{ "erro": "codigo", "mensagem": "texto em pt-BR" }`

| Código | Quando | O que o app faz |
|---|---|---|
| `nao_encontrado` (200 + `encontrado:false`) | EAN fora do catálogo / CEP sem unidade | Abre cadastro manual |
| `sem_estoque` (200 + `disponivel:false`) | Sem estoque na unidade | Usa o preço com aviso |
| `limite` (429) | Muitas consultas | Toast "Aguarde um instante" + manual |
| `origem_indisponivel` (502/504) | Atacadão fora/mudou/bloqueou | Usa último preço salvo (`aproximado`) ou manual |
| `invalido` (400) | Parâmetro errado | Mensagem de erro |

### 4.6 No PWA

- Nova fonte em `js/prices.js`: `atacadaoPriceSource` (implementa `history/latest/average/record` + `lookup(ean, unidade)`), ligada com `setPriceSource()`. A fonte local continua por baixo.
- `js/config.js`: `WORKER_URL`.
- CSP: `connect-src 'self' https://<worker>.workers.dev` (só o Worker).
- Consulta sempre com timeout de 8 s e sem bloquear a tela.

## 5. Modelo de dados (IndexedDB, versão 3)

| Store | Chave | Campos |
|---|---|---|
| `stores` | `id` | `name`, `initials`, `color`, `tipo` (`atacadao` \| `manual`), `unidadeId`, `unidadeNome`, `cep`, `regionId` |
| `products` | `barcode` | `name`, `category`, `brand`, `sku`, `image`, `origem` (`atacadao` \| `manual`), `updated` |
| `prices` | `id` auto, índice `[storeId, barcode]` | `cents`, `date`, `origem` (`site` \| `manual`), `disponivel` |
| `cart` | `barcode` | `qty`, `cents`, `storeId`, `origem`, `consultadoEm`, `added` |
| `history` | `id` auto | `date`, `storeId`, `storeName`, `total`, `qtd`, `itens[]` |

Migração v2 → v3: mantém dados; adiciona campos novos com valores padrão (`origem: "manual"`).
Preferências (`localStorage`): loja/unidade atual, CEP, ordenação.

## 6. Lógica de preço

1. **Preço do site:** o valor da simulação para a unidade escolhida (`sellingPrice`, em centavos). Selo `site` + data/hora.
2. **Registro:** cada consulta com preço **diferente do último** (ou mais de 24 h depois) entra em `prices` com `origem: "site"`.
3. **Preço médio:** média de todos os preços observados do produto naquela unidade (site + manual). Mostrado com "média de N registros".
4. **Aproximado:** quando o preço usado não é da consulta atual (sem internet, erro, limite) → usa o último salvo e marca `aproximado`.
5. **Manual:** só quando não encontrado ou se o usuário "corrigir preço" (o valor corrigido vale para o carrinho e entra no histórico como `manual`).
6. **Total:** soma de `cents × qty`. Comparação com a média = Σ (média × qty) − total.
7. Valores sempre em **centavos inteiros**; exibição em `R$` pt-BR.

## 7. Offline

- App (telas, scripts, ícones) já funciona offline (service worker, rede primeiro + cache).
- Sem internet: produtos já vistos usam o **último preço salvo** (`aproximado`); novos vão para o cadastro manual. Ao voltar a internet, a Lista oferece "Atualizar preços".
- Unidades/CEP ficam salvos; não precisa de internet para trocar entre unidades já usadas.

## 8. Limites e riscos

- **API não oficial:** endpoints públicos da VTEX do Atacadão, sem contrato. Podem mudar ou bloquear a qualquer momento → app degrada para último preço/manual.
- **Termos de uso:** proíbem "uso não autorizado do conteúdo". `robots.txt` não bloqueia `/io/api/`. Uso **pessoal**, com cache e poucas consultas = risco baixo. Para app público/comercial: pedir autorização ao Atacadão.
- **Preço do site ≠ gôndola:** pode haver diferença (ofertas da loja física, preço de atacado por quantidade). O app avisa.
- **Cobertura:** nem todo EAN está no catálogo (ex.: 7896004000855 não está).
- **Cloudflare grátis:** ~**100 mil requisições/dia** e limite de CPU por requisição — sobra para uso pessoal.
- **Privacidade:** o Worker recebe só EAN, CEP e unidade; não guarda logs pessoais. O carrinho fica só no aparelho.

## 9. O que o Vinicius precisa fazer

1. Criar uma conta grátis na **Cloudflare** (dash.cloudflare.com).
2. Fazer **login uma vez** (`npx wrangler login` ou no navegador do box) para publicar o Worker. Nenhum cartão necessário.
3. Aprovar o nome do Worker (ex.: `scancarrinho-api.<conta>.workers.dev`).
4. Testar no celular com o CEP de casa e uma unidade real.

## 10. Roadmap

| Versão | Conteúdo | Estado |
|---|---|---|
| **v0.1.0** | Esqueleto PWA publicado | Publicada |
| **v0.2.0** | Telas Loja/Escanear/Produto/Lista/Resumo, preço manual por loja, média, histórico, offline, CSP, instalar | **Pronta localmente** (aguardando aprovação para publicar) |
| **v0.3.0** | Worker (`/worker` no repositório) + Atacadão por CEP/unidade, preço automático, selos site/manual/aproximado, IndexedDB v3 | Próxima |
| **v0.4.0** | Leitor do **QR Code da NFC-e** (nota fiscal) para registrar os preços reais pagos | Planejada |
| **v0.5.0** | Polimento: tema escuro/alto contraste, backup/exportação, atualização de preços em lote, acessibilidade, ícone final | Planejada |

## 11. Plano de testes

- **Worker (automático, curl):** `/unidades` com CEPs de SP/RJ/Curitiba; `/produto` e `/preco` com 7891000100103, 7891910000197, 7894900011517 (encontrados) e 7896004000855 (404); parâmetros inválidos → 400; caminho fora da lista → 404; origem diferente → 403; OPTIONS → 204 com CORS certo; rajada → 429; cache (2ª chamada com `cf-cache-status`/tempo menor).
- **PWA (Chrome headless, tela de celular):** escolher Atacadão + CEP + unidade; digitar EAN conhecido → item com preço `site`; repetir → soma; EAN desconhecido → manual; Worker fora do ar (mock) → `aproximado`/manual; totais e médias; offline; 0 erros no console; CSP sem violações.
- **Celular real:** câmera lendo EAN no Android/Chrome; iPhone com digitação; instalação; uso offline dentro do mercado.

## 12. Critérios de aceite (v0.3.0)

1. Escolher Atacadão, informar CEP e escolher unidade em até 3 toques após digitar o CEP.
2. Escanear um EAN do catálogo mostra nome e preço da unidade em **até 3 s** (com internet), **sem digitar nada**.
3. Escanear o mesmo EAN de novo soma a quantidade; total do carrinho correto em centavos.
4. Cada item mostra a origem do preço (`site`, `manual` ou `aproximado`) e o preço médio observado.
5. EAN não encontrado abre o cadastro manual; erro do Worker não trava o app.
6. Offline: app abre, lista e totais funcionam; itens já vistos usam o último preço (`aproximado`).
7. Worker só responde aos 3 endpoints, só para `https://viniciusjrcarlos.github.io`, com cache e limite ativos.
8. Nenhum erro no console; CSP restrita (só o domínio do Worker em `connect-src`).
9. CHANGELOG, `js/version.js`, `CACHE` do `sw.js` e tag `v0.3.0` atualizados juntos; publicação sem `push --force`.
