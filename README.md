# ScanCarrinho

PWA para calcular o total da compra no supermercado escaneando o carrinho (ou códigos de barras).

**Abrir o app:** https://viniciusjrcarlos.github.io/scancarrinho/

## Funcionalidades (v0.4.0)

| Tela | O que faz |
|---|---|
| Loja | Preço automático: **Atacadão**, **Sam's Club** e **Bistek** (digite o CEP e escolha a loja) e **Supernosso** e **Covabra** (preço único da rede). Outras lojas: preço manual. |
| Escanear | Lê o código pela câmera ou por digitação. Nas redes automáticas o preço aparece sozinho; se o código não existir na rede, busca pelo nome (aproximado); se nada achar, pede nome e preço. "Item sem código" para granel/feira. |
| Produto | Preço do site (com hora da consulta), "Atualizar preço", "Corrigir preço", preço médio observado e histórico. |
| Lista | Itens, quantidade, total da linha, +1, editar, remover, esvaziar e total do carrinho. |
| Resumo | Total, total por categoria (%), comparação com a média dos seus preços e "Finalizar compra". |

Selos em cada item: **preço do site**, **manual** ou **aproximado** (último preço salvo quando não há internet, ou produto parecido achado pelo nome; o nome achado aparece no item).

O carrinho fica só no aparelho (IndexedDB) e o app funciona offline. Para o preço automático, o app consulta o Worker (veja abaixo); sem internet, usa o último preço salvo.

## Worker de preços (Cloudflare)

Os sites das redes não permitem chamadas diretas do navegador (CORS), então o app consulta um Worker próprio:
**https://scancarrinho-precos.viniciusjrcarlos.workers.dev**

| Endpoint | O que faz |
|---|---|
| `GET /unidades?cep=01310100&rede=sams` | Lojas da rede que atendem o CEP (redes regionais) |
| `GET /produto?ean=7891000100103&rede=bistek` | Nome, marca e categoria pelo código de barras |
| `GET /preco?ean=…&rede=atacadao&unidade=atacadaobr340` | Preço (centavos), estoque e hora da consulta. Se o código não existir na rede, busca pelo nome e responde `aproximado: true` + `nomeEncontrado` |

Redes (`rede`): `atacadao` (padrão), `sams`, `bistek` (pedem `unidade`, ex.: `samsclub4825`, `bistek16`), `supernosso`, `covabra` (preço único, sem `unidade`).

- Só aceita esses 3 endereços, com parâmetros validados (não é proxy aberto).
- CORS só para `https://viniciusjrcarlos.github.io`. Cache no KV (preço 6 h). Limite por IP. Tempo máximo de 8 s.
- "Não encontrado" responde 200 com `encontrado: false`.
- Código em `worker/` (não é publicado no GitHub Pages). Publicar: `cd worker && npx wrangler deploy` (Node 22+).
- Preços do site podem diferir da gôndola. Uso pessoal; as APIs das redes (VTEX) não são oficiais e podem mudar. Detalhes em `docs/ESCOPO.md`.

## Estrutura do projeto

```
index.html               casca do app (CSP, manifest, abas)
manifest.webmanifest     dados do PWA (nome, ícones, cores)
sw.js                    service worker (offline, rede primeiro, versão do cache)
css/                     tokens, base, componentes e telas
js/
  boot.js                liga o app, o instalar e o service worker
  app.js                 navegação por hash (#/loja, #/scan, #/lista, #/produto/<código>, #/resumo)
  version.js             versão do app
  config.js              endereço do Worker e tempos
  atacadao.js            cliente do Worker (unidades e preço)
  auto.js                aplica o preço do site no produto, histórico e carrinho
  db.js                  IndexedDB v3 (lojas, produtos, preços, carrinho, histórico)
  scanner.js             câmera + BarcodeDetector
  prices.js              fonte de preços plugável (local e site das redes)
  cart.js / products.js / stores.js / categories.js
  ui/                    dom, ícones SVG, dinheiro (R$), avisos, diálogos, instalar, navegação
  screens/               loja, scan, produto, lista, resumo
icons/                   ícones do PWA (192, 512, maskable, apple-touch)
worker/                  Worker da Cloudflare (proxy de preços; não publicado no Pages)
docs/                    escopo, documentação e mockups (só referência, não publicados)
.github/workflows/       publicação automática no GitHub Pages
```

## Fonte de preços

`js/prices.js` define a interface (`history`, `latest`, `average`, `record` e o opcional `lookup`). O app liga `atacadaoPriceSource` (Worker + histórico local) com `setPriceSource()`. Outra fonte real pode ser ligada da mesma forma.

## Tecnologias

- HTML + CSS + JavaScript puro (ES modules)
- Barcode Detection API
- IndexedDB
- Service Worker
- GitHub Pages

## Como desenvolver e testar

1. Clone o repositório
2. Rode `python3 -m http.server 8080` e abra http://localhost:8080
3. No celular: Chrome → Adicionar à tela inicial
4. Teste a câmera em HTTPS (GitHub Pages ou localhost com certificado)


## Versões e publicação

- Todo push na `main` publica automaticamente no GitHub Pages (`.github/workflows/pages.yml`; a pasta `docs/` não é publicada).
- Ao lançar uma versão nova, atualize juntos: `js/version.js`, `CACHE` em `sw.js` (ex.: `scancarrinho-v0.4.0`) e o `CHANGELOG.md`, e crie a tag (`v0.4.0`).
- Para voltar a uma versão validada: **Actions › Publicar no GitHub Pages › Run workflow** com a tag (ou `gh workflow run pages.yml -f ref=v0.1.0`). Nunca usamos `push --force`.

---
© 2026 Vinicius Carlos. Veja `LICENSE`.
