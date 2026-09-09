/* =========================================================
   MEME MAKER — export.js
   ---------------------------------------------------------
   Descarga el meme terminado. La clave para que NUNCA tenga
   marca de agua: lo único que leemos es el contenido real del
   <canvas> (App.canvas.toDataURL), sin dibujar nada extra antes
   de exportar. Justo antes de generar la imagen, volvemos a
   dibujar la escena SIN el recuadro/manijas de selección
   (Render.draw(false)), para que tampoco esa interfaz de edición
   termine en el archivo descargado.
   ========================================================= */

const Exporter = {
  setup() {
    const formatSelect = document.getElementById("export-format");
    const qualityRow = document.getElementById("quality-row");

    const syncQualityVisibility = () => {
      qualityRow.hidden = formatSelect.value === "png";
    };
    syncQualityVisibility();
    formatSelect.addEventListener("change", syncQualityVisibility);

    document.getElementById("btn-export").addEventListener("click", Exporter.exportImage);
  },

  mimeFor(format) {
    if (format === "jpeg") return "image/jpeg";
    if (format === "webp") return "image/webp";
    return "image/png";
  },

  extensionFor(format) {
    return format === "jpeg" ? "jpg" : format;
  },

  exportImage() {
    const format = document.getElementById("export-format").value;
    const quality = parseFloat(document.getElementById("export-quality").value);
    const mime = Exporter.mimeFor(format);

    // Redibujamos sin la UI de selección para que el archivo
    // exportado sea EXACTAMENTE el meme, nada más.
    Render.draw(false);

    const dataUrl = App.canvas.toDataURL(mime, format === "png" ? undefined : quality);

    // Restauramos la vista normal del editor (con la selección visible).
    Render.draw(true);

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `meme.${Exporter.extensionFor(format)}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

window.Exporter = Exporter;
