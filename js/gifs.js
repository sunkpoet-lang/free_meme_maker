/* =========================================================
   MEME MAKER — gifs.js
   ---------------------------------------------------------
   Soporte para plantillas GIF animadas. Usa dos librerías
   vendidas localmente (js/lib/gifuct.js y js/lib/gifenc.js,
   ambas sin dependencias externas ni Web Workers, así que
   funcionan igual abriendo el archivo con doble clic que
   subiéndolo a internet):

     - gifuct: descompone un GIF en sus fotogramas individuales.
     - gifenc: vuelve a armar fotogramas en un GIF animado nuevo.

   Estrategia general:
     1. Al elegir una plantilla GIF, la descomponemos y componemos
        cada fotograma (respetando el "disposal method" de cada
        uno, que indica si hay que limpiar o mantener lo anterior
        antes de pintar el siguiente). Guardamos esos fotogramas
        ya compuestos en App.gifCache, aparte de App.elements
        (que solo guarda datos livianos — los fotogramas pesan
        demasiado para meterlos en el historial de deshacer).
     2. Mientras se edita, el lienzo solo muestra el primer
        fotograma como imagen de fondo normal (igual que cualquier
        otra plantilla) — así no hay que tocar el resto del editor.
     3. Al exportar como "GIF animado", recorremos cada fotograma
        guardado, lo ponemos momentáneamente como si fuera la
        imagen de fondo, dibujamos TODO el lienzo con el motor de
        siempre (Render.draw) para que el texto/stickers/formas
        queden bien colocados encima, y codificamos el resultado
        fotograma por fotograma.
   ========================================================= */

const GifEngine = {
  /**
   * Servicios intermediarios (proxy) gratuitos que descargan la imagen por
   * nosotros y la devuelven con permiso CORS habilitado. Solo se usan como
   * respaldo, cuando la descarga directa falla -lo cual pasa seguido con
   * sitios como Imgflip, que no autorizan leer sus archivos desde otro
   * origen (y menos desde un archivo abierto con doble clic, que el
   * navegador trata como "sin origen"). Si alguno deja de funcionar en el
   * futuro, se puede reemplazar aquí sin tocar el resto del código.
   */
  CORS_PROXIES: [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ],

  /**
   * Descarga los bytes crudos de una URL, intentando primero de forma
   * directa (más rápido, sin depender de terceros) y, si eso falla
   * -normalmente por CORS-, probando uno a uno los proxies de respaldo.
   */
  async fetchBytes(url) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.arrayBuffer();
    } catch (err) {
      // Probablemente bloqueado por CORS -seguimos con los proxies.
    }

    for (const buildProxyUrl of GifEngine.CORS_PROXIES) {
      try {
        const res = await fetch(buildProxyUrl(url));
        if (res.ok) return await res.arrayBuffer();
      } catch (err) {
        // Probamos el siguiente proxy de la lista.
      }
    }

    throw new Error("No se pudo descargar el archivo (ni directo ni a través de los proxies de respaldo).");
  },

  /**
   * Descarga los bytes crudos de un GIF y los descompone en
   * fotogramas ya compuestos y listos para dibujar (cada uno como
   * un <canvas> del tamaño completo del GIF).
   * Puede fallar si ni la descarga directa ni ninguno de los proxies
   * de respaldo consiguen el archivo — quien llame debe capturar el
   * error y avisar al usuario en vez de romper la app.
   */
  async loadFromUrl(url) {
    const buffer = await GifEngine.fetchBytes(url);
    return GifEngine.decodeAndCompose(buffer);
  },

  /**
   * Descompone un ArrayBuffer de un GIF en fotogramas compuestos.
   * Devuelve { width, height, frames: [{ canvas, delay }] }.
   */
  decodeAndCompose(arrayBuffer) {
    const parsed = gifuct.parseGIF(arrayBuffer);
    const rawFrames = gifuct.decompressFrames(parsed, true);
    if (!rawFrames.length) throw new Error("El GIF no tiene fotogramas válidos.");

    const width = parsed.lsd.width;
    const height = parsed.lsd.height;

    const composeCanvas = document.createElement("canvas");
    composeCanvas.width = width;
    composeCanvas.height = height;
    const composeCtx = composeCanvas.getContext("2d", { willReadFrequently: true });

    const frames = [];
    let pendingRestore = null;

    for (const frame of rawFrames) {
      if (pendingRestore) {
        composeCtx.putImageData(pendingRestore, 0, 0);
        pendingRestore = null;
      }

      const dims = frame.dims;

      // Si este fotograma pide "restaurar al anterior" al terminar,
      // guardamos una foto del lienzo compuesto ANTES de pintarlo.
      let restoreSnapshot = null;
      if (frame.disposalType === 3) {
        restoreSnapshot = composeCtx.getImageData(0, 0, width, height);
      }

      const patchCanvas = document.createElement("canvas");
      patchCanvas.width = dims.width;
      patchCanvas.height = dims.height;
      patchCanvas
        .getContext("2d")
        .putImageData(new ImageData(new Uint8ClampedArray(frame.patch), dims.width, dims.height), 0, 0);

      composeCtx.drawImage(patchCanvas, dims.left, dims.top);

      // Guardamos este fotograma ya compuesto como su propio canvas
      // independiente (congelado en este punto).
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = width;
      frameCanvas.height = height;
      frameCanvas.getContext("2d").drawImage(composeCanvas, 0, 0);
      frames.push({ canvas: frameCanvas, delay: frame.delay || 100 });

      if (frame.disposalType === 2) {
        // "clear to background": limpiar el área de este fotograma
        // antes del siguiente.
        composeCtx.clearRect(dims.left, dims.top, dims.width, dims.height);
      } else if (frame.disposalType === 3) {
        pendingRestore = restoreSnapshot;
      }
      // disposalType 0/1: no hacer nada, el siguiente fotograma se
      // dibuja encima de lo que ya quedó.
    }

    return { width, height, frames };
  },

  /**
   * Codifica una lista de fotogramas (canvases del mismo tamaño)
   * como un GIF animado nuevo. Devuelve un Uint8Array con los bytes
   * del archivo .gif final.
   */
  encode(frameList, width, height) {
    const gif = gifenc.GIFEncoder();

    for (const { canvas, delay } of frameList) {
      const ctx = canvas.getContext("2d");
      const { data } = ctx.getImageData(0, 0, width, height);
      const palette = gifenc.quantize(data, 256);
      const index = gifenc.applyPalette(data, palette);
      gif.writeFrame(index, width, height, { palette, delay, repeat: 0 });
    }

    gif.finish();
    return gif.bytes();
  },
};

window.GifEngine = GifEngine;
