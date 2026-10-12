// IndexedDB para carrinho e preços
const DB_NAME = 'scancarrinho';
const DB_VERSION = 1;

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cart')) {
        db.createObjectStore('cart', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('prices')) {
        db.createObjectStore('prices', { keyPath: 'barcode' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
