/*
 * Leitor de código de barras com a câmera (Barcode Detection API).
 * Se o navegador não tiver a API (ex.: Safari no iPhone) ou a câmera for negada,
 * a tela de scan usa a digitação manual do código.
 */
const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

export async function scannerDisponivel() {
  if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) return false;
  try {
    const sup = await window.BarcodeDetector.getSupportedFormats();
    return FORMATOS.some((f) => sup.includes(f));
  } catch { return false; }
}

/* Liga a câmera no <video> e chama onCode(codigo) a cada leitura nova. Devolve { stop }. */
export async function iniciarScanner(video, onCode, { intervalo = 250, repetirApos = 2500 } = {}) {
  const sup = await window.BarcodeDetector.getSupportedFormats();
  const detector = new window.BarcodeDetector({ formats: FORMATOS.filter((f) => sup.includes(f)) });
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  video.srcObject = stream;
  video.setAttribute("playsinline", "");
  video.muted = true;
  await video.play();
  let ativo = true, timer = 0;
  const vistos = new Map();
  const loop = async () => {
    if (!ativo) return;
    try {
      if (video.readyState >= 2) {
        const achados = await detector.detect(video);
        const agora = Date.now();
        for (const b of achados) {
          const c = b.rawValue?.trim();
          if (!c) continue;
          if (agora - (vistos.get(c) || 0) > repetirApos) { vistos.set(c, agora); onCode(c); }
          else vistos.set(c, agora);
        }
      }
    } catch { /* quadro sem leitura: tenta no próximo */ }
    if (ativo) timer = setTimeout(loop, intervalo);
  };
  loop();
  return {
    stop() {
      ativo = false;
      clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
