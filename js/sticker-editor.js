/* =========================================================
   MEME MAKER — sticker-editor.js
   ---------------------------------------------------------
   "Crear sticker": subes una foto y borras el fondo arrastrando el
   dedo o el mouse sobre ella (como el creador de stickers de
   WhatsApp), hasta dejar solo la parte que quieres usar. El
   resultado se recorta automáticamente al contenido que quede, se
   guarda en "Mis stickers" (junto a los emojis, ver
   customstickers.js) y se agrega al lienzo al instante.

   Todo pasa en el navegador con un <canvas> -no hay ningún recorte
   "automático" con inteligencia artificial (eso pesaría demasiado
   para una app sin servidor)-, así que funciona igual abriendo el
   archivo con doble clic que publicado en internet.
   ========================================================= */

const StickerEditor = {
  MAX_WORKING_DIMENSION: 520,
  MAX_UNDO_STEPS: 25,

  canvas: null,
  ctx: null,
  sourceImage: null,
  originalImageData: null,
  undoStack: [],
  isDrawing: false,
  lastPoint: null,
  objectUrl: null,

  setup() {
    StickerEditor.canvas = document.getElementById("sticker-editor-canvas");
    StickerEditor.ctx = StickerEditor.canvas.getContext("2d", { willReadFrequently: true });

    const btn = document.getElementById("btn-quick-create-sticker");
    const input = document.getElementById("sticker-source-input");
    btn.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      if (input.files && input.files[0]) {
        StickerEditor.open(input.files[0]);
      }
      input.value = ""; // permite volver a elegir el mismo archivo
    });

    document.getElementById("btn-sticker-undo").addEventListener("click", StickerEditor.undo);
    document.getElementById("btn-sticker-reset").addEventListener("click", StickerEditor.reset);
    document.getElementById("btn-sticker-cancel").addEventListener("click", StickerEditor.close);
    document.getElementById("btn-sticker-save").addEventListener("click", StickerEditor.save);

    const canvas = StickerEditor.canvas;
    canvas.style.touchAction = "none"; // para poder dibujar con el dedo sin que la página haga scroll
    canvas.addEventListener("pointerdown", StickerEditor.onPointerDown);
    canvas.addEventListener("pointermove", StickerEditor.onPointerMove);
    canvas.addEventListener("pointerup", StickerEditor.onPointerUp);
    canvas.addEventListener("pointercancel", StickerEditor.onPointerUp);
    canvas.addEventListener("pointerleave", StickerEditor.onPointerUp);
  },

  /** Abre el editor con una imagen recién elegida por el usuario. */
  open(file) {
    if (!file.type || !file.type.startsWith("image/")) {
      alert("Elige un archivo de imagen (JPG, PNG, etc.) para crear el sticker.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      StickerEditor.objectUrl = objectUrl;
      StickerEditor.sourceImage = img;
      StickerEditor.setupCanvasFromImage(img);
      document.getElementById("sticker-editor-overlay").hidden = false;
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      alert("No se pudo leer esta imagen. Prueba con otro archivo.");
    };
    img.src = objectUrl;
  },

  setupCanvasFromImage(img) {
    const scale = Math.min(1, StickerEditor.MAX_WORKING_DIMENSION / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = StickerEditor.canvas;
    canvas.width = width;
    canvas.height = height;

    StickerEditor.ctx.clearRect(0, 0, width, height);
    StickerEditor.ctx.drawImage(img, 0, 0, width, height);
    StickerEditor.originalImageData = StickerEditor.ctx.getImageData(0, 0, width, height);
    StickerEditor.undoStack = [];
  },

  /** Convierte la posición de un evento de puntero a coordenadas del canvas (sin importar cómo esté escalado en pantalla). */
  pointerToCanvasCoords(evt) {
    const rect = StickerEditor.canvas.getBoundingClientRect();
    const scaleX = StickerEditor.canvas.width / rect.width;
    const scaleY = StickerEditor.canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  },

  brushRadius() {
    const slider = document.getElementById("sticker-brush-size");
    return Math.max(4, parseInt(slider.value, 10) || 35) / 2;
  },

  eraseAt(x, y) {
    const ctx = StickerEditor.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, StickerEditor.brushRadius(), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /** Borra una línea continua entre dos puntos (varios círculos seguidos), para que el trazo no se vea "punteado" con movimientos rápidos. */
  eraseLine(from, to) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(1, StickerEditor.brushRadius() / 3);
    const count = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      StickerEditor.eraseAt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    }
  },

  onPointerDown(evt) {
    evt.preventDefault();
    StickerEditor.canvas.setPointerCapture(evt.pointerId);
    StickerEditor.isDrawing = true;

    // Guardamos el lienzo ANTES de este trazo, para poder deshacerlo.
    StickerEditor.undoStack.push(
      StickerEditor.ctx.getImageData(0, 0, StickerEditor.canvas.width, StickerEditor.canvas.height)
    );
    if (StickerEditor.undoStack.length > StickerEditor.MAX_UNDO_STEPS) StickerEditor.undoStack.shift();

    const point = StickerEditor.pointerToCanvasCoords(evt);
    StickerEditor.eraseAt(point.x, point.y);
    StickerEditor.lastPoint = point;
  },

  onPointerMove(evt) {
    if (!StickerEditor.isDrawing) return;
    evt.preventDefault();
    const point = StickerEditor.pointerToCanvasCoords(evt);
    StickerEditor.eraseLine(StickerEditor.lastPoint, point);
    StickerEditor.lastPoint = point;
  },

  onPointerUp() {
    StickerEditor.isDrawing = false;
    StickerEditor.lastPoint = null;
  },

  undo() {
    if (!StickerEditor.undoStack.length) return;
    const snapshot = StickerEditor.undoStack.pop();
    StickerEditor.ctx.putImageData(snapshot, 0, 0);
  },

  reset() {
    if (!StickerEditor.originalImageData) return;
    StickerEditor.ctx.putImageData(StickerEditor.originalImageData, 0, 0);
    StickerEditor.undoStack = [];
  },

  close() {
    document.getElementById("sticker-editor-overlay").hidden = true;
    if (StickerEditor.objectUrl) {
      URL.revokeObjectURL(StickerEditor.objectUrl);
      StickerEditor.objectUrl = null;
    }
    StickerEditor.sourceImage = null;
    StickerEditor.originalImageData = null;
    StickerEditor.undoStack = [];
  },

  /** Calcula el rectángulo que encierra todo lo que NO es transparente. */
  computeContentBounds() {
    const { width, height } = StickerEditor.canvas;
    const { data } = StickerEditor.ctx.getImageData(0, 0, width, height);

    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return null; // se borró todo

    const pad = 3;
    return {
      x: Math.max(0, minX - pad),
      y: Math.max(0, minY - pad),
      width: Math.min(width, maxX + pad) - Math.max(0, minX - pad),
      height: Math.min(height, maxY + pad) - Math.max(0, minY - pad),
    };
  },

  save() {
    const bounds = StickerEditor.computeContentBounds();
    if (!bounds) {
      alert("Borraste toda la imagen -no queda nada para usar como sticker. Prueba \"Reiniciar\" y borra solo el fondo.");
      return;
    }

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = bounds.width;
    cropCanvas.height = bounds.height;
    cropCanvas
      .getContext("2d")
      .drawImage(StickerEditor.canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);

    const dataUrl = cropCanvas.toDataURL("image/png");

    // Tamaño con el que se inserta en el lienzo: proporcional al recorte,
    // sin pasarse de un poco menos de la mitad del lienzo actual.
    const maxInsertSize = Math.min(App.canvas.width, App.canvas.height) * 0.45;
    const insertScale = Math.min(1, maxInsertSize / Math.max(bounds.width, bounds.height));
    const insertWidth = Math.max(20, Math.round(bounds.width * insertScale));
    const insertHeight = Math.max(20, Math.round(bounds.height * insertScale));

    App.imageCache[dataUrl] = cropCanvas;
    Elements.addImage({ src: dataUrl, width: insertWidth, height: insertHeight });
    Render.draw();
    Panels.refreshLayers();
    Panels.refreshProperties();
    History.commit();

    CustomStickers.add({ dataUrl, width: bounds.width, height: bounds.height });
    Panels.refreshCustomStickers();

    StickerEditor.close();
  },
};

window.StickerEditor = StickerEditor;
