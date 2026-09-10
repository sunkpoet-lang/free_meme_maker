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
      // El control de calidad (compresión) solo aplica a JPG/WEBP.
      qualityRow.hidden = formatSelect.value !== "jpeg" && formatSelect.value !== "webp";
    };
    syncQualityVisibility();
    formatSelect.addEventListener("change", syncQualityVisibility);

    document.getElementById("btn-export").addEventListener("click", Exporter.exportImage);
    Exporter.updateGifOptionVisibility();
  },

  mimeFor(format) {
    if (format === "jpeg") return "image/jpeg";
    if (format === "webp") return "image/webp";
    return "image/png";
  },

  extensionFor(format) {
    return format === "jpeg" ? "jpg" : format;
  },

  /**
   * La opción "GIF animado" del selector de formato solo tiene
   * sentido si hay una plantilla GIF en el lienzo -si no, la
   * ocultamos (y si estaba seleccionada y deja de aplicar, volvemos
   * a PNG para no dejar el exportador en un estado confuso).
   */
  updateGifOptionVisibility() {
    const option = document.getElementById("export-format-gif-option");
    const formatSelect = document.getElementById("export-format");
    if (!option || !formatSelect) return;

    const hasAnimated = App.elements.some((el) => el.animatedGifId);
    option.hidden = !hasAnimated;

    if (!hasAnimated && formatSelect.value === "gif") {
      formatSelect.value = "png";
      formatSelect.dispatchEvent(new Event("change"));
    }
  },

  exportImage() {
    const format = document.getElementById("export-format").value;

    if (format === "gif") {
      Exporter.exportAnimatedGif();
      return;
    }

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

  /**
   * Genera un GIF animado nuevo: recorre cada fotograma de la(s)
   * plantilla(s) GIF del lienzo, y en cada uno dibuja TODO el lienzo
   * con el motor normal (Render.draw) -así el texto, stickers y
   * formas quedan bien colocados encima de cada fotograma, igual que
   * se ven en el editor- y codifica el resultado como un archivo
   * .gif nuevo con GifEngine (gifs.js).
   */
  async exportAnimatedGif() {
    const animatedElements = App.elements.filter((el) => el.animatedGifId);
    if (animatedElements.length === 0) {
      alert("Agrega primero una plantilla GIF animada desde \"Explorar plantillas\".");
      return;
    }

    Panels.setBusy(true, "Generando GIF animado… esto puede tardar unos segundos.");
    // Pequeña pausa para que el navegador alcance a pintar el overlay
    // de "procesando" antes de que el trabajo ocupe el hilo principal.
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Cuántos fotogramas tendrá el GIF final: los de la primera
    // plantilla animada que se agregó ("la que manda" el tiempo). Si
    // hay más de una plantilla GIF en el lienzo, cada una repite su
    // propio ciclo de fotogramas dentro de esa misma duración total.
    const driving = App.gifCache[animatedElements[0].animatedGifId];
    const frameCount = driving.frames.length;

    // Guardamos qué imagen tenía cada elemento animado en la caché
    // para devolverla tal cual al terminar (drawImageElement lee de
    // ahí, así que la vamos a "engañar" fotograma a fotograma).
    const originalCacheEntries = animatedElements.map((el) => App.imageCache[el.src]);

    try {
      const outputFrames = [];

      for (let i = 0; i < frameCount; i++) {
        animatedElements.forEach((el) => {
          const data = App.gifCache[el.animatedGifId];
          const frame = data.frames[i % data.frames.length];
          App.imageCache[el.src] = frame.canvas;
        });

        Render.draw(false);

        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = App.canvas.width;
        frameCanvas.height = App.canvas.height;
        frameCanvas.getContext("2d").drawImage(App.canvas, 0, 0);
        outputFrames.push({ canvas: frameCanvas, delay: driving.frames[i].delay });

        // Cada tantos fotogramas cedemos el hilo principal un instante,
        // para que la pestaña no se sienta "trabada" en GIFs largos.
        if (i % 5 === 4) await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const bytes = GifEngine.encode(outputFrames, App.canvas.width, App.canvas.height);
      const blob = new Blob([bytes], { type: "image/gif" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "meme.gif";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.warn("No se pudo generar el GIF animado:", err);
      alert("Ocurrió un error al generar el GIF animado. Intenta de nuevo.");
    } finally {
      // Devolvemos la caché de imágenes a como estaba y volvemos a
      // dibujar la vista normal del editor (con selección visible).
      animatedElements.forEach((el, idx) => {
        App.imageCache[el.src] = originalCacheEntries[idx];
      });
      Render.draw(true);
      Panels.setBusy(false);
    }
  },
};

window.Exporter = Exporter;
