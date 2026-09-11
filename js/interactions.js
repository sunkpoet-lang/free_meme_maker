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
      // Se guarda para recién al SOLTAR (ver onPointerUp) llevar la
      // vista hasta "Propiedades" -si se hiciera acá, al tocar, la
      // página se movería de golpe con el dedo todavía abajo, justo
      // interrumpiendo el arrastre que muchas veces sigue después-.
      App.dragState.pendingScrollToProperties = App.selectedId !== hit.id;
      App.selectedId = hit.id;
      App.dragState.mode = "move";
      App.dragState.pointerStart = { x, y };
      App.dragState.elementStart = JSON.parse(JSON.stringify(hit));
    } else {
      App.selectedId = null;
      App.dragState.mode = null;
      App.dragState.pendingScrollToProperties = false;
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

    // Las guías de alineación solo aplican al mover (no al rotar/redimensionar);
    // se recalculan en cada movimiento y se borran si no aplica ninguna.
    App.dragState.guides = { x: null, y: null };

    if (mode === "move") {
      const snapped = Interactions.computeSnap(el, elementStart.x + dx, elementStart.y + dy);
      el.x = snapped.x;
      el.y = snapped.y;
      App.dragState.guides = snapped.guides;
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
      App.dragState.guides = { x: null, y: null };
      Render.draw();
      History.commit();
      Panels.refreshProperties();
    }

    // Recién ahora -con el dedo ya levantado, se haya arrastrado o no-
    // se lleva la vista hasta "Propiedades" si hace falta.
    if (App.dragState.pendingScrollToProperties) {
      App.dragState.pendingScrollToProperties = false;
      Panels.scrollToPropertiesIfNeeded();
    }
  },

  /** Distancia máxima (en píxeles de PANTALLA, no del lienzo) para que un
   *  borde/centro "se pegue" a una guía -como el imán de alineación de
   *  CapCut-. Se convierte a píxeles del lienzo según el zoom actual. */
  SNAP_THRESHOLD_SCREEN_PX: 8,

  /**
   * Calcula, para un elemento que se está moviendo hacia (proposedX,
   * proposedY), si el borde izquierdo/centro/derecho (y arriba/centro/
   * abajo) queda lo bastante cerca de: el centro del lienzo, los bordes
   * del lienzo, o el borde/centro de cualquier otro elemento -y, de ser
   * así, "engancha" esa posición exacta en vez de la propuesta-.
   *
   * Devuelve { x, y, guides: { x, y } }: x/y son las coordenadas finales
   * (ya ajustadas), y guides.x/guides.y son la posición (en el eje
   * correspondiente) de la línea guía a dibujar, o null si no hay
   * ninguna guía activa en ese eje.
   */
  computeSnap(el, proposedX, proposedY) {
    const canvas = App.canvas;
    const rect = canvas.getBoundingClientRect();
    // Si el lienzo se ve más chico/grande en pantalla que su tamaño real
    // (por ejemplo, un lienzo de 1080px mostrado en 400px de ancho), el
    // umbral de "8px de pantalla" hay que traducirlo a píxeles del lienzo.
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    const thresholdX = Interactions.SNAP_THRESHOLD_SCREEN_PX * scaleX;
    const thresholdY = Interactions.SNAP_THRESHOLD_SCREEN_PX * scaleY;

    const box = Render.getBoundingBox(el);
    const halfW = box.width / 2;
    const halfH = box.height / 2;

    // Candidatos a los que "engancharse": el centro y los bordes del
    // lienzo, más el centro y los bordes de cada otro elemento.
    const targetsX = [0, canvas.width / 2, canvas.width];
    const targetsY = [0, canvas.height / 2, canvas.height];
    for (const other of App.elements) {
      if (other.id === el.id) continue;
      const obox = Render.getBoundingBox(other);
      targetsX.push(other.x - obox.width / 2, other.x, other.x + obox.width / 2);
      targetsY.push(other.y - obox.height / 2, other.y, other.y + obox.height / 2);
    }

    // Los tres "bordes" del elemento que se mueve: izquierda, centro y
    // derecha (y arriba/centro/abajo). "offset" es su distancia al
    // centro del elemento, para poder recalcular x/y a partir de dónde
    // terminó enganchando ese borde en particular.
    const edgesX = [
      { offset: -halfW, pos: proposedX - halfW },
      { offset: 0, pos: proposedX },
      { offset: halfW, pos: proposedX + halfW },
    ];
    const edgesY = [
      { offset: -halfH, pos: proposedY - halfH },
      { offset: 0, pos: proposedY },
      { offset: halfH, pos: proposedY + halfH },
    ];

    const bestOnAxis = (edges, targets, threshold) => {
      let best = null;
      for (const edge of edges) {
        for (const target of targets) {
          const dist = Math.abs(edge.pos - target);
          if (dist <= threshold && (!best || dist < best.dist)) {
            best = { dist, value: target - edge.offset, guideValue: target };
          }
        }
      }
      return best;
    };

    const bestX = bestOnAxis(edgesX, targetsX, thresholdX);
    const bestY = bestOnAxis(edgesY, targetsY, thresholdY);

    return {
      x: bestX ? bestX.value : proposedX,
      y: bestY ? bestY.value : proposedY,
      guides: {
        x: bestX ? bestX.guideValue : null,
        y: bestY ? bestY.guideValue : null,
      },
    };
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
        if (item.kind === "file" && item.type.startsWith("video/")) {
          const file = item.getAsFile();
          if (file) {
            evt.preventDefault();
            Interactions.loadVideoFile(file);
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
        const file = files[0];
        if (file.type && file.type.startsWith("video/")) {
          Interactions.loadVideoFile(file);
        } else {
          Interactions.loadImageFile(file);
        }
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
   * Convierte un video subido (o arrastrado/pegado) a un GIF animado y
   * lo inserta en el lienzo, igual que cualquier plantilla GIF. Se
   * recorta a los primeros segundos y se reduce el tamaño (ver
   * GifEngine.framesFromVideoFile) para que no quede pesadísimo.
   */
  async loadVideoFile(file) {
    Panels.setBusy(true, "Convirtiendo el video a GIF… esto puede tardar unos segundos.");
    try {
      const decoded = await GifEngine.framesFromVideoFile(file);
      Interactions.insertDecodedGif(decoded);
    } catch (err) {
      console.warn("No se pudo convertir este video a GIF:", err);
      alert("No se pudo convertir este video a GIF. Prueba con otro archivo (formatos como .mp4, .mov o .webm funcionan mejor).");
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
