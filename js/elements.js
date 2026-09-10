/* =========================================================
   MEME MAKER — elements.js
   ---------------------------------------------------------
   Todo lo relacionado con crear, buscar, duplicar y borrar
   elementos (imágenes, textos, formas). También vive aquí la
   lista de fuentes, estilos de texto predefinidos, stickers
   y plantillas de ejemplo.
   ========================================================= */

const FONT_OPTIONS = [
  "Impact",
  "Arial",
  "Helvetica",
  "Comic Sans MS",
  "Anton",
  "Bebas Neue",
  "Montserrat",
  "Roboto",
  "Oswald",
];

const TEXT_STYLE_PRESETS = {
  "Meme clásico": { color: "#ffffff", strokeColor: "#000000", strokeWidth: 8, shadowBlur: 0, shadowColor: "#000000" },
  "Meme moderno": { color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, shadowBlur: 10, shadowColor: "#000000" },
  "Impact": { color: "#ffffff", strokeColor: "#000000", strokeWidth: 6, shadowBlur: 0, shadowColor: "#000000" },
  "Texto rojo": { color: "#ff3b30", strokeColor: "#000000", strokeWidth: 6, shadowBlur: 0, shadowColor: "#000000" },
  "Texto amarillo": { color: "#ffd60a", strokeColor: "#000000", strokeWidth: 6, shadowBlur: 0, shadowColor: "#000000" },
  "Texto limpio": { color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, shadowBlur: 0, shadowColor: "#000000" },
};

const STICKER_EMOJIS = [
  "😂", "😭", "🔥", "💀", "👍", "👎", "😱", "🤔", "💯", "❤️", "🎉", "👀",
  "😩", "🥵", "🥶", "😤", "😡", "🤬", "🥺", "😳", "🙏", "💅", "🫡", "🗿",
  "🤡", "🐸", "💩", "🫠", "🤯", "😴", "🙄", "😏", "😈", "👻", "💦", "✨",
  "💔", "🖕", "✌️", "👌", "🤙", "🫰", "💪", "🧠", "😬", "🤢", "🤮", "🙌",
  "🤦", "🤷", "😅", "🍆", "🍑", "⚠️",
];

// Plantillas de ejemplo. En vez de depender de imágenes externas
// (que requerirían internet y podrían tener derechos de autor),
// las generamos nosotros mismos con Canvas. La arquitectura ya
// deja preparados los campos "nombre/categoría/tags" para que en
// el futuro se reemplacen por imágenes reales sin tocar el resto
// del editor.
const TEMPLATES = [
  { name: "Reacción", category: "Reacción", color: "#6c5ce7", tags: ["reaccion", "cara"] },
  { name: "Animal gracioso", category: "Animales", color: "#00b894", tags: ["animal", "gracioso"] },
  { name: "Escena de película", category: "Películas", color: "#0984e3", tags: ["pelicula", "escena"] },
  { name: "Momento de serie", category: "Series", color: "#e17055", tags: ["serie", "momento"] },
  { name: "Gamer rage", category: "Videojuegos", color: "#d63031", tags: ["gaming", "rage"] },
  { name: "Random", category: "Random", color: "#fdcb6e", tags: ["random"] },
];

const Elements = {
  find(id) {
    return App.elements.find((el) => el.id === id) || null;
  },

  hitTest(x, y) {
    // Recorremos de arriba (último) hacia abajo (primero) para
    // seleccionar el elemento visualmente más al frente primero.
    for (let i = App.elements.length - 1; i >= 0; i--) {
      const el = App.elements[i];
      const box = Render.getBoundingBox(el);
      if (Render.pointInBox(x, y, el, box)) return el;
    }
    return null;
  },

  addImage({ src, width, height }) {
    const el = {
      id: generateId(),
      type: "image",
      src,
      x: App.canvas.width / 2,
      y: App.canvas.height / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
    };
    App.elements.push(el);
    App.selectedId = el.id;
    return el;
  },

  addText({ content = "TU TEXTO AQUÍ", fontSize = 48, x, y, isSticker = false } = {}) {
    const preset = TEXT_STYLE_PRESETS["Meme clásico"];
    const el = {
      id: generateId(),
      type: "text",
      content,
      x: x ?? App.canvas.width / 2,
      y: y ?? App.canvas.height / 2,
      fontSize,
      fontFamily: "Impact",
      bold: false,
      italic: false,
      align: "center",
      letterSpacing: 0,
      rotation: 0,
      opacity: 1,
      color: preset.color,
      strokeColor: preset.strokeColor,
      strokeWidth: isSticker ? 0 : preset.strokeWidth,
      shadowColor: preset.shadowColor,
      shadowBlur: preset.shadowBlur,
    };
    App.elements.push(el);
    App.selectedId = el.id;
    return el;
  },

  addShape({ shapeType, width = 160, height = 160 }) {
    const el = {
      id: generateId(),
      type: "shape",
      shapeType, // "rect" | "circle" | "line" | "arrow"
      x: App.canvas.width / 2,
      y: App.canvas.height / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      fillColor: "#6c5ce7",
      strokeColor: "#ffffff",
      strokeWidth: 4,
    };
    App.elements.push(el);
    App.selectedId = el.id;
    return el;
  },

  duplicate(id) {
    const el = Elements.find(id);
    if (!el) return null;
    const copy = JSON.parse(JSON.stringify(el));
    copy.id = generateId();
    copy.x += 24;
    copy.y += 24;
    App.elements.push(copy);
    App.selectedId = copy.id;
    return copy;
  },

  delete(id) {
    App.elements = App.elements.filter((el) => el.id !== id);
    if (App.selectedId === id) App.selectedId = null;
  },

  deleteSelected() {
    if (!App.selectedId) return;
    Elements.delete(App.selectedId);
    Render.draw();
    Panels.refreshLayers();
    Panels.refreshProperties();
    History.commit();
  },

  bringToFront(id) {
    const idx = App.elements.findIndex((el) => el.id === id);
    if (idx === -1) return;
    const [el] = App.elements.splice(idx, 1);
    App.elements.push(el);
  },

  sendToBack(id) {
    const idx = App.elements.findIndex((el) => el.id === id);
    if (idx === -1) return;
    const [el] = App.elements.splice(idx, 1);
    App.elements.unshift(el);
  },

  copySelected() {
    const el = Elements.find(App.selectedId);
    if (!el) return;
    App.clipboardElement = JSON.parse(JSON.stringify(el));
  },

  pasteClipboardElement() {
    if (!App.clipboardElement) return;
    const copy = JSON.parse(JSON.stringify(App.clipboardElement));
    copy.id = generateId();
    copy.x += 24;
    copy.y += 24;
    App.elements.push(copy);
    App.selectedId = copy.id;
    Render.draw();
    Panels.refreshLayers();
    Panels.refreshProperties();
    History.commit();
  },
};

/**
 * Genera la imagen (dataURL) de una plantilla de ejemplo,
 * dibujándola nosotros mismos en un canvas temporal.
 */
function generateTemplateDataURL(template, width, height) {
  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  const tctx = tmp.getContext("2d");

  tctx.fillStyle = template.color;
  tctx.fillRect(0, 0, width, height);

  tctx.fillStyle = "rgba(255,255,255,0.15)";
  for (let i = 0; i < 5; i++) {
    tctx.beginPath();
    tctx.arc(Math.random() * width, Math.random() * height, 40 + Math.random() * 60, 0, Math.PI * 2);
    tctx.fill();
  }

  tctx.fillStyle = "#ffffff";
  tctx.font = "700 " + Math.round(width * 0.07) + "px Arial";
  tctx.textAlign = "center";
  tctx.textBaseline = "middle";
  tctx.fillText(template.name, width / 2, height / 2);

  tctx.font = "400 " + Math.round(width * 0.035) + "px Arial";
  tctx.fillText(template.category, width / 2, height / 2 + width * 0.09);

  return tmp.toDataURL("image/png");
}

window.Elements = Elements;
