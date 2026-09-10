/* =========================================================
   MEME MAKER — app.js
   ---------------------------------------------------------
   Punto de entrada. Solo conecta las piezas que viven en los
   demás archivos (state.js, elements.js, render.js,
   interactions.js, panels.js, export.js) una vez que el HTML
   terminó de cargar. Cada archivo se explica a sí mismo en su
   propio encabezado.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.setup();

  App.canvas = document.getElementById("meme-canvas");
  App.ctx = App.canvas.getContext("2d");

  Render.draw();
  History.commit(); // primer snapshot: lienzo vacío (para poder deshacer hasta aquí)

  Interactions.setup();
  Panels.setup();
  Exporter.setup();
  MemeCounter.setup();
  StickerEditor.setup();

  console.log("Meme Maker · Editor completo cargado correctamente.");
});
