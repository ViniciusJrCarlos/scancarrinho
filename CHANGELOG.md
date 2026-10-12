# Changelog

Todas as mudanças importantes do ScanCarrinho ficam registradas aqui.
Cada versão validada recebe uma tag no Git (ex.: `v0.1.0`).

## [0.1.0] — 2026-10-12

Primeira versão (esqueleto do MVP) publicada no GitHub Pages.

### Adicionado
- PWA instalável (manifest com ícones normais e "maskable", ícone para iPhone) que funciona offline (service worker com rede primeiro e cache como reserva).
- Estrutura base: tela inicial, IndexedDB (`js/db.js`) e scanner com BarcodeDetector (`js/scanner.js`).
- Publicação automática no GitHub Pages via GitHub Actions (sem a pasta `docs/`).

### Ainda não incluído
- Seleção de supermercado, lista de produtos, preços e cálculo do total.
