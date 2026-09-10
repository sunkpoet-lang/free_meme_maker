/* =========================================================
   MEME MAKER — interactions.js
   ---------------------------------------------------------
   Todo lo relacionado con la interacción del usuario:
     - seleccionar / mover / redimensionar / rotar con el mouse
       o el dedo (usamos Pointer Events, que funcionan igual
       para mouse, mouse y pantallas táctiles)
     - atajos de teclado (undo/redo, copiar/pegar, eliminar)
     - cargar imágenes por arrastrar (drag&drop) o pegar (Ctrl+V)
   ========================================================= */

const Interactions = {
  setup() {
    const canvas = App.canvas;

    canvas.addEventListener("pointerdown", Interactions.onPointerDown);
    canvas.addEventListener("pointermove", Interactions.onPointerMove);
    canvas.addEventListener("pointerup", Interactions.onPointerUp);
    canvas.addEventListener("pointercancel", Interactions.onPointerUp);

    document.addEventListener("keydown", Interactions.onKeyDown);
    document.addEventListener("paste", Interactions.onPaste);

    Interactions.setupDragAndDrop();
  },

  /** Convierte coordenadas del mouse/dedo (en pantalla) a coordenadas del canvas. */
  getCanvasCoords(evt) {
    const rect = App.canvas.getBoundingClientRect();
    const scaleX = App.canvas.width / rect.width;
    const scaleY = App.canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  },

  onPointerDown(evt) {
    const { x, y } = Interactions.getCanvasCoords(evt);
    App.canvas.setPointerCapture(evt.pointerId);

    const selected = Elements.find(App.selectedId);

    if (selected) {
      const handle = Render.hitTestHandles(x, y, selected);
      if (handle) {
        App.dragState.mode = handle;
        App.dragState.pointerStart = { x, y };
        App.dragState.elementStart = JSON.parse(JSON.stringify(selected));
        return;
      }
    }

    const hit = Elements.hitTest(x, y);
    if (hit) {
      App.selectedId = hit.id;
      App.dragState.mode = "move";
      App.dragState.pointerStart = { x, y };
      App.dragState.elementStart = JSON.parse(JSON.stringify(hit));
    } else {
      App.selectedId = null;
      App.dragState.mode = null;
    }

    Render.draw();
    Panels.refreshLayers();
    Panels.refreshProperties();
  },

  onPointerMove(evt) {
    if (!App.dragState.mode) return;
    const el = Elements.find(App.selectedId);
    if (!el) return;

    const { x, y } = Interactions.getCanvasCoords(evt);
    const { pointerStart, elementStart, mode } = App.dragState;
    const dx = x - pointerStart.x;
    const dy = y - pointerStart.y;

    if (mode === "move") {
      el.x = elementStart.x + dx;
      el.y = elementStart.y + dy;
    } else if (mode === "rotate") {
      const angleRad = Math.atan2(y - el.y, x - el.x);
      el.rotation = (angleRad * 180) / Math.PI + 90;
    } else if (mode === "resize") {
      if (el.type === "text") {
        const startDist = Math.hypot(pointerStart.x - elementStart.x, pointerStart.y - elementStart.y) || 1;
        const currentDist = Math.hypot(x - el.x, y - el.y);
        const ratio = currentDist / startDist;
        el.fontSize = Math.max(8, Math.round(elementStart.fontSize * ratio));
      } else {
        const local = Render.toLocal(x, y, el);
        el.width = Math.max(20, Math.round(local.x * 2));
        el.height = Math.max(20, Math.round(local.y * 2));
      }
    }

    Render.draw();
  },

  onPointerUp() {
    if (App.dragState.mode) {
      App.dragState.mode = null;
      App.dragState.elementStart = null;
      History.commit();
      Panels.refreshProperties();
    }
  },

  isEditingText() {
    const tag = document.activeElement && document.activeElement.tagName;
    return tag === "INPUT" || tag === "TEXTAREA";
  },

  onKeyDown(evt) {
    if (Interactions.isEditingText()) return;

    const ctrlOrCmd = evt.ctrlKey || evt.metaKey;
    const key = evt.key.toLowerCase();

    if (ctrlOrCmd && key === "z" && !evt.shiftKey) {
      evt.preventDefault();
      History.undo();
    } else if (ctrlOrCmd && ((key === "z" && evt.shiftKey) || key === "y")) {
      evt.preventDefault();
      History.redo();
    } else if (ctrlOrCmd && key === "c") {
      evt.preventDefault();
      Elements.copySelected();
    } else if (evt.key === "Delete" || evt.key === "Backspace") {
      evt.preventDefault();
      Elements.deleteSelected();
    }
    // Ctrl+V se maneja en onPaste, para no duplicar lógica.
  },

  /**
   * Un único punto de entrada para Ctrl+V:
   *  - si el portapapeles del sistema trae una imagen, la agrega.
   *  - si no, duplica el último elemento copiado con Ctrl+C (si hay).
   */
  onPaste(evt) {
    if (Interactions.isEditingText()) return;

    const items = evt.clipboardData && evt.clipboardData.items;
    if (items) {
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            evt.preventDefault();
            Interactions.loadImageFile(file);
            return;
          }
        }
      }
    }

    evt.preventDefault();
    Elements.pasteClipboardElement();
  },

  setupDragAndDrop() {
    const wrapper = document.getElementById("canvas-wrapper");

    ["dragenter", "dragover"].forEach((name) => {
      wrapper.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        wrapper.classList.add("drag-over");
      });
    });

    ["dragleave", "dragend"].forEach((name) => {
      wrapper.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        wrapper.classList.remove("drag-over");
      });
    });

    wrapper.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.remove("drag-over");
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        Interactions.loadImageFile(files[0]);
      }
    });
  },

  /**
   * Carga un archivo de imagen y lo agrega como un nuevo elemento.
   *
   * Caso especial: si el lienzo todavía está vacío (es la primera
   * imagen que se sube), en vez de "encajarla" dentro del tamaño
   * actual, AJUSTAMOS EL LIENZO a las proporciones de esa imagen
   * (respetando un mínimo/máximo razonable) para que se vea completa,
   * sin franjas negras. Si ya hay elementos en el lienzo, se agrega
   * como un elemento más, ajustado para que quepa sin deformarse.
   */
  loadImageFile(file) {
    if (!file.type || !file.type.startsWith("image/")) {
      console.warn("El archivo no es una imagen:", file.type);
      return;
    }

    // Los GIF necesitan su propio camino: hay que descomponerlos en
    // fotogramas (con GifEngine) para poder animarlos de verdad al
    // exportar, en vez de tratarlos como una imagen fija.
    const isGif = file.type === "image/gif" || /\.gif$/i.test(file.name || "");
    if (isGif) {
      Interactions.loadGifFile(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        App.imageCache[dataUrl] = img;

        const isCanvasEmpty = App.elements.length === 0;

        if (isCanvasEmpty) {
          const size = Panels.computeAutoCanvasSize(img.width, img.height);
          Panels.applyCanvasSize(size.width, size.height, { commit: false });
          Elements.addImage({ src: dataUrl, width: size.width, height: size.height });
        } else {
          const maxW = App.canvas.width * 0.8;
          const maxH = App.canvas.height * 0.8;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const width = img.width * scale;
          const height = img.height * scale;
          Elements.addImage({ src: dataUrl, width, height });
        }

        Render.draw();
        Panels.refreshLayers();
        Panels.refreshProperties();
        History.commit();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  },

  /**
   * Carga un GIF propio del usuario (subido, arrastrado o pegado) y lo
   * descompone en fotogramas reales con GifEngine -así luego se puede
   * exportar animado de verdad, con el texto/stickers ya puestos "horneados"
   * en cada fotograma-. Como el archivo ya está en la computadora del
   * usuario, esto NO depende de ninguna descarga por internet, así que
   * no tiene el problema de CORS que sí afecta a las plantillas GIF que
   * se intentan traer desde sitios externos.
   */
  async loadGifFile(file) {
    Panels.setBusy(true, "Leyendo y preparando tu GIF…");
    try {
      const buffer = await file.arrayBuffer();
      const decoded = GifEngine.decodeAndCompose(buffer);
      Interactions.insertDecodedGif(decoded);
    } catch (err) {
      console.warn("No se pudo leer este GIF:", err);
      alert("No se pudo leer este archivo como GIF animado. Asegúrate de que sea un .gif válido.");
    } finally {
      Panels.setBusy(false);
    }
  },

  /**
   * Carga un GIF a partir de una URL que el propio usuario pega (por
   * ejemplo, un enlace copiado de Tenor, Giphy o Imgflip). Se descarga con
   * GifEngine.loadFromUrl, que ya intenta primero de forma directa y, si
   * el sitio de origen no autoriza CORS, prueba automáticamente varios
   * proxies de respaldo antes de rendirse.
   */
  async loadGifFromUrl(url) {
    Panels.setBusy(true, "Descargando el GIF desde la URL…");
    try {
      const decoded = await GifEngine.loadFromUrl(url);
      Interactions.insertDecodedGif(decoded);
      return true;
    } catch (err) {
      console.warn("No se pudo cargar el GIF desde esa URL:", url, err);
      alert("No se pudo cargar un GIF desde esa URL. Revisa que el enlace apunte directamente a un archivo .gif y que el sitio permita descargarlo.");
      return false;
    } finally {
      Panels.setBusy(false);
    }
  },

  /**
   * Inserta en el lienzo un GIF ya descompuesto en fotogramas ({width,
   * height, frames}), sea cual sea su origen (archivo local, arrastrado,
   * pegado, o URL). Comparte el mismo criterio de tamaño que subir una
   * imagen normal: si el lienzo está vacío, se ajusta a la proporción del
   * GIF; si ya hay contenido, se agrega como un elemento más.
   */
  insertDecodedGif({ width, height, frames }) {
    const gifId = "gif_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    App.gifCache[gifId] = { width, height, frames };

    const previewSrc = frames[0].canvas.toDataURL("image/png");
    App.imageCache[previewSrc] = frames[0].canvas;

    const isCanvasEmpty = App.elements.length === 0;
    let el;
    if (isCanvasEmpty) {
      const size = Panels.computeAutoCanvasSize(width, height);
      Panels.applyCanvasSize(size.width, size.height, { commit: false });
      el = Elements.addImage({ src: previewSrc, width: size.width, height: size.height });
    } else {
      const maxW = App.canvas.width * 0.8;
      const maxH = App.canvas.height * 0.8;
      const scale = Math.min(maxW / width, maxH / height, 1);
      el = Elements.addImage({ src: previewSrc, width: width * scale, height: height * scale });
    }
    el.animatedGifId = gifId;

    Render.draw();
    Panels.refreshLayers();
    Panels.refreshProperties();
    History.commit();
    return el;
  },
};

window.Interactions = Interactions;
