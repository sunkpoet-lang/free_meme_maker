/* =========================================================
   MEME MAKER — state.js
   ---------------------------------------------------------
   Estado global de la aplicación. Como no usamos ningún
   framework, guardamos todo en un único objeto "App" que el
   resto de los archivos leen y modifican. Es la fuente única
   de verdad del editor.
   ========================================================= */

const App = {
  canvas: null,
  ctx: null,

  elements: [],        // elementos en el lienzo, en orden (0 = más al fondo)
  selectedId: null,     // id del elemento seleccionado (o null)

  clipboardElement: null, // último elemento copiado con Ctrl+C

  backgroundColor: "#000000",

  history: [],          // snapshots (texto JSON) del array "elements"
  historyIndex: -1,

  imageCache: {},        // src (dataURL) -> HTMLImageElement ya cargada

  // id de plantilla GIF -> { width, height, frames: [{canvas, delay}] }.
  // Aparte de "elements" a propósito: los fotogramas pesan demasiado
  // para guardarlos en cada foto del historial de deshacer/rehacer.
  gifCache: {},

  dragState: {
    mode: null,           // "move" | "resize" | "rotate" | null
    pointerStart: { x: 0, y: 0 },
    elementStart: null,    // copia del elemento al iniciar el arrastre
    // Guías de alineación activas mientras se arrastra (ver
    // Interactions.computeSnap en interactions.js y
    // Render.drawAlignmentGuides en render.js). null = sin guía en ese eje.
    guides: { x: null, y: null },
  },
};

// Se expone en "window" a propósito: así es más fácil inspeccionar
// o depurar el estado desde la consola del navegador mientras
// desarrollas (por ejemplo escribiendo "App" en la consola).
window.App = App;

let _idCounter = 1;
function generateId() {
  return "el_" + _idCounter++;
}

/* =========================================================
   HISTORIAL (undo / redo)
   ---------------------------------------------------------
   Estrategia simple y fácil de mantener: guardamos una "foto"
   completa (JSON) de la lista de elementos después de cada
   cambio confirmado. Deshacer/rehacer solo mueve un índice
   dentro de esa lista de fotos. No es la técnica más
   eficiente en memoria, pero para un editor de memes (pocos
   elementos) es más que suficiente y es mucho más fácil de
   entender y depurar que un sistema de comandos.
   ========================================================= */

const History = {
  commit() {
    // Si el usuario deshizo y luego hace un cambio nuevo,
    // descartamos el futuro (rehacer) que ya no aplica.
    App.history = App.history.slice(0, App.historyIndex + 1);
    App.history.push(JSON.stringify(App.elements));
    App.historyIndex++;

    // Evita que el historial crezca sin límite.
    const MAX_HISTORY = 60;
    if (App.history.length > MAX_HISTORY) {
      App.history.shift();
      App.historyIndex--;
    }
  },

  undo() {
    if (App.historyIndex <= 0) return;
    App.historyIndex--;
    App.elements = JSON.parse(App.history[App.historyIndex]);
    App.selectedId = null;
    Render.draw();
    Panels.refreshLayers();
    Panels.refreshProperties();
  },

  redo() {
    if (App.historyIndex >= App.history.length - 1) return;
    App.historyIndex++;
    App.elements = JSON.parse(App.history[App.historyIndex]);
    Render.draw();
    Panels.refreshLayers();
    Panels.refreshProperties();
  },
};

window.History = History;
