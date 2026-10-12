/* Configuração do app. O endereço do Worker também está na CSP do index.html (connect-src). */
export const WORKER_URL = "https://scancarrinho-precos.viniciusjrcarlos.workers.dev";
export const TEMPO_MAX_MS = 8000;          // espera máxima por uma consulta
export const PRECO_VELHO_MS = 24 * 3600e3; // preço com mais de 24 h pede atualização
export const REUSAR_PRECO_MS = 6 * 3600e3; // mesmo item escaneado de novo em até 6 h não consulta de novo
