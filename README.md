# ScanCarrinho

PWA para calcular o total da compra no supermercado escaneando o carrinho (ou códigos de barras).

**Abrir o app:** https://viniciusjrcarlos.github.io/scancarrinho/

## Estrutura do projeto

```
scancarrinho/
├── index.html
├── manifest.webmanifest
├── sw.js
├── css/
│   ├── tokens.css
│   ├── base.css
│   ├── components.css
│   └── screens.css
├── js/
│   ├── boot.js
│   ├── app.js
│   ├── db.js
│   ├── scanner.js
│   ├── prices.js
│   ├── screens/
│   └── ui/
├── icons/
├── docs/
│   └── mockups/
└── README.md
```

## Funcionalidades planejadas (MVP)

1. Seleção de supermercado
2. Scan de código de barras (BarcodeDetector)
3. Lista de produtos com quantidades e preços
4. Cálculo do total
5. Funcionamento offline (service worker + IndexedDB)
6. Instalável como PWA

## Tecnologias

- HTML + CSS + JavaScript puro (ES modules)
- Barcode Detection API
- IndexedDB
- Service Worker
- GitHub Pages

## Como desenvolver e testar

1. Clone o repositório
2. Abra no navegador (ou use live server)
3. No celular: Chrome → Adicionar à tela inicial
4. Teste a câmera em HTTPS (GitHub Pages ou localhost com certificado)

Siga o mesmo padrão do KeyPass e Anota Conta.

## Versões e publicação

- Todo push na `main` publica automaticamente no GitHub Pages (`.github/workflows/pages.yml`; a pasta `docs/` não é publicada).
- Ao lançar uma versão nova, atualize juntos: `js/version.js`, `CACHE` em `sw.js` (ex.: `scancarrinho-v0.2.0`) e o `CHANGELOG.md`, e crie a tag (`v0.2.0`).
- Para voltar a uma versão validada: **Actions › Publicar no GitHub Pages › Run workflow** com a tag (ou `gh workflow run pages.yml -f ref=v0.1.0`). Nunca usamos `push --force`.

---
© 2026 Vinicius Carlos. Veja `LICENSE`.
