import { dbAll, dbGet, dbPut } from "./db.js";
/*
 * Lojas. Atacadão: uma loja por unidade (id "atacadao:<unidade>"), preço automático.
 * Carrefour, Pão de Açúcar, Extra, Assaí e lojas criadas pelo usuário: preço manual.
 */
const PADRAO = [
  { id: "carrefour", name: "Carrefour", color: "#1E5BB8" },
  { id: "pao-de-acucar", name: "Pão de Açúcar", color: "#2E7D32" },
  { id: "extra", name: "Extra", color: "#C62828" },
  { id: "assai", name: "Assaí", color: "#E65100" },
];
const CORES = ["#6D4C41", "#00838F", "#5E35B1", "#AD1457", "#558B2F", "#EF6C00"];
const CHAVE = "scancarrinho.loja";
const CHAVE_CEP = "scancarrinho.cep";
export const COR_ATACADAO = "#F57C00";

export function iniciais(nome) {
  const ps = nome.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 || /\d/.test(w));
  const base = ps.length ? ps : nome.split(/\s+/);
  return (base.length > 1 ? base[0][0] + base[1][0] : base[0].slice(0, 2)).toUpperCase();
}
export async function listarLojas() {
  let lojas = await dbAll("stores");
  if (!lojas.some((l) => !l.custom && l.tipo !== "atacadao")) {
    for (const [i, l] of PADRAO.entries()) await dbPut("stores", { ...l, initials: iniciais(l.name), custom: false, tipo: "manual", order: i });
    lojas = await dbAll("stores");
  }
  return lojas.map((l) => ({ tipo: "manual", ...l })).sort((a, b) => a.order - b.order);
}
export async function criarLoja(nome) {
  const lojas = await listarLojas();
  const existe = lojas.find((l) => l.name.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"));
  if (existe) return existe;
  const loja = { id: "loja-" + Date.now().toString(36), name: nome, initials: iniciais(nome),
    color: CORES[lojas.length % CORES.length], custom: true, tipo: "manual", order: lojas.length };
  await dbPut("stores", loja);
  return loja;
}
/* Cria (ou atualiza) a loja de uma unidade do Atacadão. */
export async function lojaAtacadao({ unidadeId, unidadeNome, cep, regionId }) {
  const id = "atacadao:" + unidadeId;
  const atual = await dbGet("stores", id);
  const loja = { ...(atual || {}), id, name: "Atacadão " + unidadeNome, initials: "AT", color: COR_ATACADAO, custom: true,
    tipo: "atacadao", unidadeId, unidadeNome, cep, regionId, order: atual?.order ?? -1 };
  await dbPut("stores", loja);
  return loja;
}
export const lojaAtualId = () => localStorage.getItem(CHAVE);
export const definirLojaAtual = (id) => localStorage.setItem(CHAVE, id);
export const cepSalvo = () => localStorage.getItem(CHAVE_CEP) || "";
export const salvarCep = (cep) => localStorage.setItem(CHAVE_CEP, cep);
export const buscarLoja = async (id) => {
  const l = id ? await dbGet("stores", id) : undefined;
  return l ? { tipo: "manual", ...l } : undefined;
};
