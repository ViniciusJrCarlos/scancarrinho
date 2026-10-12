/*
 * IndexedDB do ScanCarrinho (tudo fica só no aparelho).
 * stores   lojas (id)                 products produtos (barcode)
 * prices   histórico de preços (id auto, índice [storeId, barcode])
 * cart     carrinho atual (barcode = chave; quantidade é somada)
 * history  compras finalizadas (id auto)
 * v3: preços e carrinho ganham "origem" (site | manual | aproximado); lojas ganham "tipo".
 */
const DB_NAME = "scancarrinho";
const DB_VERSION = 3;
let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = (e) => {
      const db = r.result;
      if (e.oldVersion < 2) {
        // v1 (esqueleto 0.1.0) nunca gravou dados: recria com o formato novo.
        for (const n of ["cart", "prices"]) if (db.objectStoreNames.contains(n)) db.deleteObjectStore(n);
        db.createObjectStore("stores", { keyPath: "id" });
        db.createObjectStore("products", { keyPath: "barcode" });
        db.createObjectStore("prices", { keyPath: "id", autoIncrement: true })
          .createIndex("storeBarcode", ["storeId", "barcode"]);
        db.createObjectStore("cart", { keyPath: "barcode" });
        db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
      }
      if (e.oldVersion >= 2 && e.oldVersion < 3) {
        // Migração v2 -> v3: mantém tudo; dados antigos eram digitados (origem "manual").
        const tx = r.transaction;
        const marcar = (nome, campo, valor) => {
          tx.objectStore(nome).openCursor().onsuccess = (ev) => {
            const c = ev.target.result;
            if (!c) return;
            if (c.value[campo] == null) c.update({ ...c.value, [campo]: valor });
            c.continue();
          };
        };
        marcar("prices", "origem", "manual");
        marcar("cart", "origem", "manual");
        marcar("stores", "tipo", "manual");
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error("Feche as outras abas do ScanCarrinho e tente de novo."));
  });
  return dbPromise;
}
const p = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
async function os(name, mode = "readonly") { return (await openDB()).transaction(name, mode).objectStore(name); }
export const dbGet = async (n, k) => p((await os(n)).get(k));
export const dbAll = async (n) => p((await os(n)).getAll());
export const dbPut = async (n, v) => p((await os(n, "readwrite")).put(v));
export const dbDel = async (n, k) => p((await os(n, "readwrite")).delete(k));
export const dbClear = async (n) => p((await os(n, "readwrite")).clear());
export const dbByIndex = async (n, idx, q) => p((await os(n)).index(idx).getAll(q));
