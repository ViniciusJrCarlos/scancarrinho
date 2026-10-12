# ScanCarrinho

PWA para calcular o total da compra no supermercado escaneando o carrinho (ou códigos de barras).

**Abrir o app:** https://viniciusjrcarlos.github.io/scancarrinho/

## Funcionalidades (v0.2.0)

| Tela | O que faz |
|---|---|
| Loja | Escolhe o supermercado (4 padrão + "Nova loja"). Os preços ficam guardados por loja. |
| Escanear | Lê o código pela câmera ou por digitação. Produto conhecido entra direto (+1); novo pede nome, categoria e preço. "Item sem código" para granel/feira. |
| Produto | Último preço e preço médio nesta loja, histórico de preços, quantidade e preço. |
| Lista | Itens, quantidade, total da linha, +1, editar, remover, esvaziar e total do carrinho. |
| Resumo | Total, total por categoria (%), comparação com a média dos seus preços e "Finalizar compra". |

Tudo fica só no aparelho (IndexedDB) e funciona offline. Sem servidor, sem cadastro.

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
  db.js                  IndexedDB (lojas, produtos, preços, carrinho, histórico)
  scanner.js             câmera + BarcodeDetector
  prices.js              fonte de preços plugável (padrão: local)
  cart.js / products.js / stores.js / categories.js
  ui/                    dom, ícones SVG, dinheiro (R$), avisos, diálogos, instalar, navegação
  screens/               loja, scan, produto, lista, resumo
icons/                   ícones do PWA (192, 512, maskable, apple-touch)
docs/                    documentação e mockups (só referência, não publicados)
.github/workflows/       publicação automática no GitHub Pages
```

## Fonte de preços

`js/prices.js` define a interface (`history`, `latest`, `average`, `record`). Hoje usa `localPriceSource` (preços digitados por você). Para ligar uma fonte real no futuro: `setPriceSource(minhaFonte)`.

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
- Ao lançar uma versão nova, atualize juntos: `js/version.js`, `CACHE` em `sw.js` (ex.: `scancarrinho-v0.2.0`) e o `CHANGELOG.md`, e crie a tag (`v0.2.0`).
- Para voltar a uma versão validada: **Actions › Publicar no GitHub Pages › Run workflow** com a tag (ou `gh workflow run pages.yml -f ref=v0.1.0`). Nunca usamos `push --force`.

---
© 2026 Vinicius Carlos. Veja `LICENSE`.
