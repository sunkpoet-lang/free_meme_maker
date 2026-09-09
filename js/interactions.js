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
   * Carga un archivo de imagen y lo agrega como un nuevo elemento,
   * ajustado para que quepa dentro del lienzo (sin deformarse).
   */
  loadImageFile(file) {
    if (!file.type || !file.type.startsWith("image/")) {
      console.warn("El archivo no es una imagen:", file.type);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        App.imageCache[dataUrl] = img;

        const maxW = App.canvas.width * 0.8;
        const maxH = App.canvas.height * 0.8;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const width = img.width * scale;
        const height = img.height * scale;

        Elements.addImage({ src: dataUrl, width, height });
        Render.draw();
        Panels.refreshLayers();
        Panels.refreshProperties();
        History.commit();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  },
};

window.Interactions = Interactions;
