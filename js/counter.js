/* =========================================================
   MEME MAKER — counter.js
   ---------------------------------------------------------
   Cuenta cuántos memes se han descargado desde este navegador y
   lo muestra en el encabezado. Se guarda en localStorage, así
   que es un contador por dispositivo/navegador -no un contador
   global de todos los usuarios del sitio-, y sube cada vez que
   se exporta un meme con éxito (export.js llama a increment()).
   ========================================================= */

const MemeCounter = {
  STORAGE_KEY: "memeStudioCreatedCount",

  get() {
    try {
      const raw = localStorage.getItem(MemeCounter.STORAGE_KEY);
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch (err) {
      // localStorage puede no estar disponible (modo privado, etc.).
      return 0;
    }
  },

  increment() {
    const next = MemeCounter.get() + 1;
    try {
      localStorage.setItem(MemeCounter.STORAGE_KEY, String(next));
    } catch (err) {
      // Sin localStorage el contador no persiste, pero no rompe nada.
    }
    MemeCounter.render();
    return next;
  },

  render() {
    const el = document.getElementById("meme-counter-value");
    if (el) el.textContent = MemeCounter.get();
  },

  setup() {
    MemeCounter.render();
  },
};

window.MemeCounter = MemeCounter;
