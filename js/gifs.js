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
   * Convierte un archivo de video (subido por el usuario, arrastrado,
   * o pegado) en fotogramas listos para animar -mismo formato que
   * decodeAndCompose/loadFromUrl: { width, height, frames: [{canvas,
   * delay}] }-, para que se pueda insertar en el lienzo exactamente
   * igual que cualquier plantilla GIF (Interactions.insertDecodedGif).
   *
   * Como el archivo ya está en la computadora del usuario, se lee con
   * un <video> oculto y un blob: URL -eso NUNCA "contamina" el canvas,
   * a diferencia de una ruta de archivo relativa bajo file://-, así que
   * funciona igual de bien abriendo el editor con doble clic que
   * publicado en internet.
   *
   * Para no generar GIFs enormes/lentísimos de procesar, se recorta a
   * los primeros `maxDurationSec` segundos, se muestrea a `fps`
   * fotogramas por segundo, y se reduce el tamaño si hace falta para
   * que el lado más largo no pase de `maxDimension` píxeles.
   */
  async framesFromVideoFile(file, { fps = 10, maxDurationSec = 8, maxDimension = 480 } = {}) {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    try {
      await GifEngine.waitForVideoEvent(video, "loadedmetadata", 15000);

      // Bug conocido de Chrome (y otros navegadores) con ciertos
      // archivos -sobre todo videos grabados con el celular-: la
      // duración llega como "Infinity" hasta que se busca cerca del
      // final. Si pasa, forzamos ese truco antes de seguir.
      let rawDuration = video.duration;
      if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
        rawDuration = await GifEngine.resolveInfiniteDuration(video);
      }

      const duration = Math.min(
        Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : maxDurationSec,
        maxDurationSec
      );

      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      if (!sourceWidth || !sourceHeight) {
        throw new Error("No se pudo leer el tamaño del video.");
      }

      const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));

      const frameCount = Math.max(1, Math.round(duration * fps));
      const delay = Math.round(1000 / fps);

      const drawCanvas = document.createElement("canvas");
      drawCanvas.width = width;
      drawCanvas.height = height;
      const drawCtx = drawCanvas.getContext("2d");

      const frames = [];
      let consecutiveSeekTimeouts = 0;
      for (let i = 0; i < frameCount; i++) {
        const t = Math.min(Math.max(duration - 0.02, 0), i / fps);
        const seeked = await GifEngine.seekVideoTo(video, t);

        if (!seeked) {
          consecutiveSeekTimeouts += 1;
          // Si el navegador no avisa NUNCA que terminó de buscar (pasa
          // con algunos archivos raros), no tiene sentido esperar el
          // mismo tiempo perdido en cada uno de los fotogramas que
          // faltan -mejor avisar de una vez con un error claro-.
          if (consecutiveSeekTimeouts >= 3) {
            throw new Error("El navegador no pudo leer los fotogramas de este video. Prueba con otro formato (.mp4 o .webm) u otro navegador.");
          }
        } else {
          consecutiveSeekTimeouts = 0;
        }

        drawCtx.drawImage(video, 0, 0, width, height);
        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = width;
        frameCanvas.height = height;
        frameCanvas.getContext("2d").drawImage(drawCanvas, 0, 0);
        frames.push({ canvas: frameCanvas, delay });
      }

      if (!frames.length) throw new Error("No se pudo extraer ningún fotograma del video.");

      return { width, height, frames };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },

  /**
   * Espera a que un <video> dispare cierto evento, con límite de tiempo:
   * si el navegador nunca lo dispara (pasa con algunos archivos raros),
   * esto falla con un error claro en vez de dejar la conversión colgada
   * para siempre.
   */
  waitForVideoEvent(video, eventName, timeoutMs) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn) => {
        if (done) return;
        done = true;
        video.removeEventListener(eventName, onEvent);
        video.removeEventListener("error", onError);
        clearTimeout(timer);
        fn();
      };
      const onEvent = () => finish(resolve);
      const onError = () => finish(() => reject(new Error("No se pudo leer el video. Prueba con otro archivo.")));
      const timer = setTimeout(
        () => finish(() => reject(new Error("El video tardó demasiado en cargar. Prueba con un archivo más pequeño."))),
        timeoutMs
      );
      video.addEventListener(eventName, onEvent);
      video.addEventListener("error", onError);
    });
  },

  /**
   * Truco para el bug de "duration: Infinity" en ciertos archivos
   * (común en videos grabados con el celular, en Chrome y otros
   * navegadores): buscar un tiempo enorme obliga al navegador a
   * calcular la duración real, que aparece en el evento
   * "durationchange". Si no se resuelve en unos segundos, seguimos
   * de todas formas (el llamador ya tiene un valor de respaldo).
   */
  resolveInfiniteDuration(video) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        video.removeEventListener("durationchange", onDurationChange);
        clearTimeout(timer);
        video.currentTime = 0;
        resolve(value);
      };
      const onDurationChange = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) finish(video.duration);
      };
      const timer = setTimeout(() => finish(NaN), 3000);
      video.addEventListener("durationchange", onDurationChange);
      try {
        video.currentTime = 1e101;
      } catch (err) {
        finish(NaN);
      }
    });
  },

  /**
   * Mueve la cabeza de reproducción de un <video> a un momento exacto y
   * espera a que el fotograma esté listo (con límite de tiempo: si el
   * navegador no dispara "seeked" -pasa con algunos archivos-, seguimos
   * con el fotograma que haya en vez de colgarnos para siempre).
   * Devuelve true si "seeked" sí se disparó a tiempo, o false si se
   * agotó el límite -así quien llama puede decidir rendirse antes si
   * pasa varias veces seguidas, en vez de perder el mismo tiempo en
   * cada uno de los fotogramas que faltan-.
   */
  seekVideoTo(video, time) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (seeked) => {
        if (done) return;
        done = true;
        video.removeEventListener("seeked", onSeeked);
        clearTimeout(timer);
        resolve(seeked);
      };
      const onSeeked = () => finish(true);
      const timer = setTimeout(() => finish(false), 800);
      video.addEventListener("seeked", onSeeked);
      video.currentTime = time;
    });
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
