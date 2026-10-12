// Boot da aplicação
import { initApp } from './app.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
