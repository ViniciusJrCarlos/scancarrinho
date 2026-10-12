/* Categorias fixas usadas no resumo. */
export const CATEGORIAS = [
  { id: "hortifruti", nome: "Frutas e Verduras", cor: "#43A047" },
  { id: "mercearia", nome: "Mercearia", cor: "#F57C00" },
  { id: "laticinios", nome: "Laticínios e Frios", cor: "#1E88E5" },
  { id: "bebidas", nome: "Bebidas", cor: "#8E24AA" },
  { id: "carnes", nome: "Carnes", cor: "#C62828" },
  { id: "padaria", nome: "Padaria", cor: "#A1887F" },
  { id: "limpeza", nome: "Limpeza", cor: "#00897B" },
  { id: "higiene", nome: "Higiene", cor: "#5C6BC0" },
  { id: "outros", nome: "Outros", cor: "#757575" },
];
export const categoria = (id) => CATEGORIAS.find((c) => c.id === id) || CATEGORIAS.at(-1);
