/*
 * Redes com preço automático (via Worker). "regional": o preço muda por loja,
 * então o usuário escolhe a unidade pelo CEP. As outras têm preço único na rede.
 */
export const REDES = {
  atacadao:   { id: "atacadao",   nome: "Atacadão",   sigla: "AT", cor: "#F57C00", regional: true,  onde: "todo o Brasil" },
  sams:       { id: "sams",       nome: "Sam's Club", sigla: "SC", cor: "#0067A0", regional: true,  onde: "várias capitais" },
  bistek:     { id: "bistek",     nome: "Bistek",     sigla: "BI", cor: "#C62828", regional: true,  onde: "SC e RS" },
  supernosso: { id: "supernosso", nome: "Supernosso", sigla: "SN", cor: "#00897B", regional: false, onde: "Grande BH" },
  covabra:    { id: "covabra",    nome: "Covabra",    sigla: "CO", cor: "#6A1B9A", regional: false, onde: "Campinas e região" },
};
export const LISTA_REDES = Object.values(REDES);
/* Lojas da v0.3.0 têm tipo "atacadao"; a partir da v0.4.0, tipo "auto" + rede. */
export const redeDaLoja = (l) => (l?.tipo === "auto" && REDES[l.rede] ? l.rede : l?.tipo === "atacadao" ? "atacadao" : null);
export const ehAuto = (l) => !!redeDaLoja(l);
export const nomeRede = (l) => REDES[redeDaLoja(l)]?.nome || "site";
