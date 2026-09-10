/* =========================================================
   MEME MAKER — customstickers.js
   ---------------------------------------------------------
   "Mis stickers": stickers recortados por el propio usuario con el
   editor de stickers (ver sticker-editor.js), guardados como PNG
   (para conservar la transparencia del recorte). Igual que "Mis
   plantillas", como esta aplicación no tiene servidor, se guardan en
   el almacenamiento local del navegador (localStorage) — quedan
   disponibles la próxima vez que abras esta misma página EN ESTE
   MISMO NAVEGADOR y equipo, pero no se comparten entre dispositivos.
   ========================================================= */

const CUSTOM_STICKERS_KEY = "memeMaker.customStickers";
const MAX_CUSTOM_STICKERS = 24;

const CustomStickers = {
  load() {
    try {
      const raw = localStorage.getItem(CUSTOM_STICKERS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.warn("No se pudieron leer los stickers guardados:", err);
      return [];
    }
  },

  saveAll(list) {
    try {
      localStorage.setItem(CUSTOM_STICKERS_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      // Lo más común: se llenó el espacio de almacenamiento del navegador.
      console.warn("No se pudo guardar el sticker:", err);
      return false;
    }
  },

  add({ dataUrl, width, height }) {
    const list = CustomStickers.load();
    const entry = {
      id: "stk_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      dataUrl,
      width,
      height,
      createdAt: Date.now(),
    };
    list.unshift(entry);
    if (list.length > MAX_CUSTOM_STICKERS) list.length = MAX_CUSTOM_STICKERS;

    const ok = CustomStickers.saveAll(list);
    return ok ? entry : null;
  },

  remove(id) {
    const list = CustomStickers.load().filter((s) => s.id !== id);
    CustomStickers.saveAll(list);
  },
};

window.CustomStickers = CustomStickers;
