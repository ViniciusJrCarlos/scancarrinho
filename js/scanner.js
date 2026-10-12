// Scanner de código de barras
export async function startScanner() {
  if (!('BarcodeDetector' in window)) {
    console.warn('BarcodeDetector não suportado');
    return;
  }
  const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
  // Lógica de câmera + detecção
}
