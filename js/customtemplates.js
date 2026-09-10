/* =========================================================
   MEME MAKER — customtemplates.js
   ---------------------------------------------------------
   "Mis plantillas": plantillas guardadas por el propio usuario,
   con nombre y descripción. Como esta aplicación no tiene
   servidor, se guardan en el almacenamiento local del navegador
   (localStorage) — quedan disponibles la próxima vez que abras
   esta misma página EN ESTE MISMO NAVEGADOR y equipo, pero no
   se comparten entre dispositivos ni se suben a ningún lado.
   ========================================================= */

const CUSTOM_TEMPLATES_KEY = "memeMaker.customTemplates";
const MAX_CUSTOM_TEMPLATES = 30;

const CustomTemplates = {
  load() {
    try {
      const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.warn("No se pudieron leer las plantillas guardadas:", err);
      return [];
    }
  },

  saveAll(list) {
    try {
      localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      // Lo más común: se llenó el espacio de almacenamiento del navegador.
      console.warn("No se pudo guardar la plantilla:", err);
      return false;
    }
  },

  add({ name, description, dataUrl }) {
    const list = CustomTemplates.load();
    const entry = {
      id: "tpl_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name,
      description: description || "",
      dataUrl,
      createdAt: Date.now(),
    };
    list.unshift(entry);
    if (list.length > MAX_CUSTOM_TEMPLATES) list.length = MAX_CUSTOM_TEMPLATES;

    const ok = CustomTemplates.saveAll(list);
    return ok ? entry : null;
  },

  remove(id) {
    const list = CustomTemplates.load().filter((t) => t.id !== id);
    CustomTemplates.saveAll(list);
  },

  /**
   * Reduce una imagen ya cargada (HTMLImageElement) a un tamaño
   * razonable y la codifica como JPEG en base64, para no llenar el
   * almacenamiento del navegador con imágenes enormes.
   *
   * Importante: si "img" viene de otro sitio (por ejemplo Imgflip)
   * y ese sitio no permite el uso "crossOrigin", esta función puede
   * lanzar un error de seguridad — lo manejamos en panels.js.
   */
  resizeToDataUrl(img, maxDim) {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d");
    tctx.drawImage(img, 0, 0, w, h);

    return tmp.toDataURL("image/jpeg", 0.85);
  },
};

window.CustomTemplates = CustomTemplates;
