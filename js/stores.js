import { dbAll, dbGet, dbPut } from "./db.js";
/* Lojas: 4 padrão (só iniciais e cor, sem logos de marca) + lojas criadas pelo usuário. */
const PADRAO = [
  { id: "carrefour", name: "Carrefour", color: "#1E5BB8" },
  { id: "pao-de-acucar", name: "Pão de Açúcar", color: "#2E7D32" },
  { id: "extra", name: "Extra", color: "#C62828" },
  { id: "assai", name: "Assaí", color: "#E65100" },
];
const CORES = ["#6D4C41", "#00838F", "#5E35B1", "#AD1457", "#558B2F", "#EF6C00"];
const CHAVE = "scancarrinho.loja";

export function iniciais(nome) {
  const ps = nome.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 || /\d/.test(w));
  const base = ps.length ? ps : nome.split(/\s+/);
  return (base.length > 1 ? base[0][0] + base[1][0] : base[0].slice(0, 2)).toUpperCase();
}
export async function listarLojas() {
  let lojas = await dbAll("stores");
  if (!lojas.length) {
    for (const [i, l] of PADRAO.entries()) await dbPut("stores", { ...l, initials: iniciais(l.name), custom: false, order: i });
    lojas = await dbAll("stores");
  }
  return lojas.sort((a, b) => a.order - b.order);
}
export async function criarLoja(nome) {
  const lojas = await listarLojas();
  const existe = lojas.find((l) => l.name.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"));
  if (existe) return existe;
  const loja = { id: "loja-" + Date.now().toString(36), name: nome, initials: iniciais(nome),
    color: CORES[lojas.length % CORES.length], custom: true, order: lojas.length };
  await dbPut("stores", loja);
  return loja;
}
export const lojaAtualId = () => localStorage.getItem(CHAVE);
export const definirLojaAtual = (id) => localStorage.setItem(CHAVE, id);
export const buscarLoja = (id) => (id ? dbGet("stores", id) : Promise.resolve(undefined));
