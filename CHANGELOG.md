# Changelog

Todas as mudanças importantes do ScanCarrinho ficam registradas aqui.
Cada versão validada recebe uma tag no Git (ex.: `v0.1.0`).

## [0.3.0] — 2026-10-12

Preço automático pelo site do Atacadão: escaneou, o preço da sua unidade aparece sozinho.

### Adicionado
- Worker na Cloudflare (`worker/`, `scancarrinho-precos`): endpoints `/unidades`, `/produto` e `/preco`, validação rígida, cache no KV (unidades e produtos 7 dias, preço 6 h), CORS só para `https://viniciusjrcarlos.github.io`, limite por IP e tempo máximo de 8 s.
- Tela "Onde você compra?": Atacadão com CEP e escolha da unidade; Carrefour, Pão de Açúcar, Extra, Assaí e lojas criadas ficam com preço manual.
- Preço automático ao escanear (fonte `atacadaoPriceSource` ligada com `setPriceSource`). Escanear de novo em até 6 h soma sem nova consulta.
- Selos de origem do preço: **preço do site**, **manual** e **aproximado**, mais aviso "sem estoque no site".
- Detalhe do produto: preço do site travado com hora da consulta, "Atualizar preço pelo site" e "Corrigir preço" (vira manual). Média dos preços observados (site + manual).
- Lista: aviso e botão "Atualizar preços" para itens aproximados ou com mais de 24 h.
- Sem internet ou site fora do ar: usa o último preço salvo (aproximado); produto novo vai para o cadastro manual.
- `docs/ESCOPO.md` com o escopo completo.

### Alterado
- IndexedDB versão 3 (mantém os dados da 0.2.0; preços antigos ficam como "manual").
- CSP: `connect-src` liberado só para o Worker de produção.

### Ainda não incluído
- Preço automático de Carrefour, Pão de Açúcar, Extra e Assaí (sites bloqueiam acesso automático).
- Leitura do QR Code da nota fiscal (NFC-e) — planejado para a 0.4.0.

## [0.2.0] — 2026-10-12

App funcional: escolher a loja, escanear ou digitar o código, anotar o preço e ver o total.

### Adicionado
- Telas em pt-BR: **Seleção de loja**, **Escanear**, **Detalhe do produto**, **Lista** e **Resumo**, com abas Escanear, Lista e Resumo.
- Lojas padrão (Carrefour, Pão de Açúcar, Extra, Assaí) com iniciais e cor (sem logos de marca), busca e "+ Nova loja".
- Scanner pela câmera traseira (Barcode Detection API: EAN-13, EAN-8, UPC-A, UPC-E, Code 128) e digitação manual do código quando o navegador não tem a API (ex.: iPhone) ou a câmera é negada. Opção "Item sem código" (granel, feira).
- Preço digitado na primeira leitura e guardado por loja, com histórico. Detalhe mostra o último preço e o preço médio (média dos preços registrados) naquela loja.
- Carrinho com o código de barras como chave: escanear de novo soma a quantidade. Editar quantidade/preço, remover, esvaziar e ordenar (nome, maior valor, mais recentes).
- Resumo: total, total por categoria com porcentagem, comparação com a média dos seus preços e "Finalizar compra" (guarda no histórico de compras).
- `js/prices.js` com fonte de preços plugável (`setPriceSource`); a padrão é local (IndexedDB).
- Content-Security-Policy restrita, botão "Instalar app" (Android/PC e passo a passo do iPhone) e aviso "Nova versão disponível · Atualizar".

### Corrigido
- Tela vazia da 0.1.0 (o app só mostrava o título).
- Meta `apple-mobile-web-app-capable` (obsoleta) trocada por `mobile-web-app-capable`.
- Banco IndexedDB v2: carrinho por código de barras (antes duplicava itens).

### Ainda não incluído
- Preços de outras lojas/mercado (precisa de uma fonte real de preços).
- Fotos dos produtos e "Próximo de você" (localização).

## [0.1.0] — 2026-10-12

Primeira versão (esqueleto do MVP) publicada no GitHub Pages.

### Adicionado
- PWA instalável (manifest com ícones normais e "maskable", ícone para iPhone) que funciona offline (service worker com rede primeiro e cache como reserva).
- Estrutura base: tela inicial, IndexedDB (`js/db.js`) e scanner com BarcodeDetector (`js/scanner.js`).
- Publicação automática no GitHub Pages via GitHub Actions (sem a pasta `docs/`).

### Ainda não incluído
- Seleção de supermercado, lista de produtos, preços e cálculo do total.
