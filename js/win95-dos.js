/* =========================================================
   MEME MAKER — win95-dos.js
   ---------------------------------------------------------
   Consola de MS-DOS animada, SOLO para el tema Windows 95 (ver
   css/themes.css y js/theme.js). Vive fija en el panel derecho, junto
   a "Capas" (no es un overlay que aparezca y desaparezca), y tiene
   tres estados:

   1. REPOSO: muestra nada más "C:\MEMES>" con el cursor parpadeando.
      Es lo que se ve la mayor parte del tiempo.
   2. UNA PASADA (playOnce): cada vez que se descarga un meme (ver el
      "enganche" a MemeCounter.increment más abajo) la consola se abre
      con una animación y teclea sola el guion completo una vez, como
      si estuviera "compilando" el meme; al terminar vuelve a quedar
      en reposo. Esto cubre también la descarga normal de PNG/JPG/WEBP,
      que es instantánea y nunca pasa por el overlay de "procesando".
   3. EN BUCLE (loop): mientras el overlay de "procesando"
      (#busy-overlay, ver panels.js) esté visible -por ejemplo,
      generando un GIF animado, que sí puede tardar varios segundos-
      el guion se repite sin parar hasta que el overlay se cierra.

   No toca panels.js/export.js/counter.js para nada: solo observa el
   atributo "hidden" de #busy-overlay, el atributo "data-theme" de
   <html>, y envuelve MemeCounter.increment (mismo patrón que ya usa
   win95-sounds.js). Así el efecto es puramente aditivo.
   ========================================================= */

const Win95Dos = {
  // Se incrementa cada vez que hay que cortar la corrida en curso
  // (nueva descarga mientras se estaba escribiendo, cambio de tema,
  // etc.). El bucle asíncrono se fija en su propio número antes de
  // cada paso; si ya no coincide con Win95Dos.runId, se detiene solo.
  runId: 0,

  // "idle" (en reposo) | "looping" (procesando algo largo) | "playing" (una pasada, por una descarga)
  mode: "idle",

  MAX_LINES: 9,

  /** Arma el guion de líneas "Etiqueta.......... OK" con los puntos
   *  alineados, para que se vea como un log de instalación clásico. */
  buildScript() {
    const okLine = (label, dotsWidth) => {
      const dots = ".".repeat(Math.max(3, dotsWidth - label.length));
      return { kind: "output", text: `${label}${dots} OK`, charDelay: 6, pause: 90 };
    };
    return [
      { kind: "prompt", text: "C:\\MEMES>CREAR_MEME.EXE", charDelay: 40, pause: 350 },
      { kind: "blank", pause: 130 },
      okLine("Inicializando editor", 28),
      okLine("Cargando lienzo", 28),
      okLine("Agregando capas", 28),
      okLine("Renderizando salida", 28),
      okLine("Comprimiendo archivo", 28),
      { kind: "blank", pause: 130 },
      { kind: "highlight", text: "CREANDO MEME...", charDelay: 50, pause: 900 },
      { kind: "blank", pause: 200 },
      { kind: "prompt", text: "C:\\MEMES>", charDelay: 55, pause: 300 },
    ];
  },

  isWin95() {
    return document.documentElement.getAttribute("data-theme") === "win95";
  },

  isBusyOverlayVisible() {
    const overlay = document.getElementById("busy-overlay");
    return !!overlay && !overlay.hidden;
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /** Pequeño "efecto de ventanita que se abre" -reinicia la animación
   *  CSS aunque ya se haya jugado antes, quitando y volviendo a poner
   *  la clase-. */
  flashWindowOpen() {
    const win = document.getElementById("win95-dos-window");
    if (!win) return;
    win.classList.remove("win95-dos-window--opening");
    void win.offsetWidth; // fuerza reflow para poder reiniciar el @keyframes
    win.classList.add("win95-dos-window--opening");
  },

  /** Dibuja el prompt fijo de reposo: "C:\MEMES>" + cursor (el cursor
   *  ya es un elemento aparte, siempre presente en el HTML). */
  showIdlePrompt() {
    const output = document.getElementById("dos-output");
    if (!output) return;
    output.innerHTML = "";
    const line = document.createElement("div");
    line.className = "win95-dos-line--prompt";
    line.textContent = "C:\\MEMES>";
    output.appendChild(line);
  },

  addLine(output, kind) {
    const lineEl = document.createElement("div");
    if (kind === "prompt") lineEl.className = "win95-dos-line--prompt";
    else if (kind === "highlight") lineEl.className = "win95-dos-line--highlight";
    output.appendChild(lineEl);

    while (output.children.length > Win95Dos.MAX_LINES) {
      output.removeChild(output.firstChild);
    }
    return lineEl;
  },

  async typeText(lineEl, text, charDelay, myRunId) {
    for (let i = 0; i <= text.length; i++) {
      if (myRunId !== Win95Dos.runId) return false;
      lineEl.textContent = text.slice(0, i);
      if (charDelay > 0) await Win95Dos.sleep(charDelay);
    }
    return true;
  },

  paintOkSuffix(lineEl, text) {
    if (!text.endsWith(" OK")) return;
    lineEl.textContent = text.slice(0, -2);
    const ok = document.createElement("span");
    ok.className = "win95-dos-ok";
    ok.textContent = "OK";
    lineEl.appendChild(ok);
  },

  /** Escribe el guion completo, una vez, en #dos-output. Devuelve
   *  false si se canceló a la mitad (nueva corrida, cambio de tema). */
  async runScriptOnce(myRunId) {
    const output = document.getElementById("dos-output");
    if (!output) return false;

    for (const step of Win95Dos.buildScript()) {
      if (myRunId !== Win95Dos.runId) return false;

      if (step.kind === "blank") {
        Win95Dos.addLine(output, "blank").textContent = "\u00A0";
        await Win95Dos.sleep(step.pause);
        continue;
      }

      const lineEl = Win95Dos.addLine(output, step.kind);
      const finished = await Win95Dos.typeText(lineEl, step.text, step.charDelay, myRunId);
      if (!finished) return false;

      if (step.kind === "output") Win95Dos.paintOkSuffix(lineEl, step.text);

      await Win95Dos.sleep(step.pause);
    }
    return true;
  },

  /** Modo bucle: se repite mientras el overlay de "procesando" siga
   *  visible. Al cerrarse, vuelve a reposo. */
  async startLoop() {
    Win95Dos.runId++;
    const myRunId = Win95Dos.runId;
    Win95Dos.mode = "looping";

    const output = document.getElementById("dos-output");
    if (output) output.innerHTML = "";
    Win95Dos.flashWindowOpen();

    while (myRunId === Win95Dos.runId && Win95Dos.isBusyOverlayVisible() && Win95Dos.isWin95()) {
      const finished = await Win95Dos.runScriptOnce(myRunId);
      if (!finished) return;
    }

    if (myRunId === Win95Dos.runId) {
      Win95Dos.mode = "idle";
      Win95Dos.showIdlePrompt();
    }
  },

  /** Modo "una pasada": se usa cada vez que se descarga un meme. Si ya
   *  hay un bucle de procesamiento real en marcha, no lo interrumpe
   *  (ese manda; ya se está viendo el mismo guion). */
  async playOnce() {
    if (!Win95Dos.isWin95() || Win95Dos.mode === "looping") return;

    Win95Dos.runId++;
    const myRunId = Win95Dos.runId;
    Win95Dos.mode = "playing";

    const output = document.getElementById("dos-output");
    if (output) output.innerHTML = "";
    Win95Dos.flashWindowOpen();

    const finished = await Win95Dos.runScriptOnce(myRunId);
    if (finished && myRunId === Win95Dos.runId) {
      Win95Dos.mode = "idle"; // el guion ya termina justo en "C:\MEMES>"
    }
  },

  onBusyOverlayChanged() {
    if (!Win95Dos.isWin95()) return;
    if (Win95Dos.isBusyOverlayVisible()) {
      if (Win95Dos.mode !== "looping") Win95Dos.startLoop();
    } else if (Win95Dos.mode === "looping") {
      Win95Dos.runId++; // corta el bucle
      Win95Dos.mode = "idle";
      Win95Dos.showIdlePrompt();
    }
  },

  onThemeChanged() {
    if (Win95Dos.isWin95()) {
      // Si venimos de otro tema (o de cargar la página), arrancamos en
      // reposo -salvo que el overlay de "procesando" ya estuviera
      // abierto, en cuyo caso entramos directo al modo bucle-.
      if (Win95Dos.mode === "idle") {
        Win95Dos.showIdlePrompt();
        Win95Dos.flashWindowOpen();
      }
      Win95Dos.onBusyOverlayChanged();
    } else {
      Win95Dos.runId++; // cancela cualquier corrida en curso
      Win95Dos.mode = "idle";
    }
  },

  setup() {
    const overlay = document.getElementById("busy-overlay");
    if (overlay) {
      const overlayObserver = new MutationObserver(() => Win95Dos.onBusyOverlayChanged());
      overlayObserver.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
    }

    const themeObserver = new MutationObserver(() => Win95Dos.onThemeChanged());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    Win95Dos.onThemeChanged(); // estado inicial
  },
};

window.Win95Dos = Win95Dos;

/* ---------------------------------------------------------
   Se dispara la animación justo al INICIAR cada descarga (no al
   terminar MemeCounter.increment, que hace una llamada de red al
   contador global y puede tardar -o fallar- de forma impredecible;
   ver counter.js), así la consola reacciona al instante al hacer
   clic, sin depender de la red.

   Importante: esto se hace acá afuera, a nivel de archivo -NO dentro
   de Win95Dos.setup()-, porque export.js (que se carga ANTES que este
   archivo, ver index.html) ya conecta los botones de descarga con
   "Exporter.exportImage" pasando la función por referencia
   (addEventListener("click", Exporter.exportImage)). Si el parche se
   aplicara más tarde (recién en el DOMContentLoaded de app.js, cuando
   corre Win95Dos.setup()), esos botones ya habrían quedado ligados
   para siempre a la función ORIGINAL, sin pasar nunca por acá. Como
   export.js ya se ejecutó (window.Exporter ya existe) pero
   Exporter.setup() -que es quien conecta los botones- recién corre en
   el DOMContentLoaded, este parche alcanza a "ganarle" y los botones
   terminan usando la versión ya envuelta.
   --------------------------------------------------------- */
if (window.Exporter && typeof Exporter.exportImage === "function") {
  const originalExportImage = Exporter.exportImage;
  Exporter.exportImage = function (...args) {
    Win95Dos.playOnce();
    return originalExportImage.apply(Exporter, args);
  };
}
if (window.Exporter && typeof Exporter.exportAnimatedGif === "function") {
  const originalExportGif = Exporter.exportAnimatedGif;
  Exporter.exportAnimatedGif = function (...args) {
    // Si esto abre el overlay de "procesando" (ver panels.js), el
    // modo bucle toma el control solo -ver Win95Dos.onBusyOverlayChanged-.
    Win95Dos.playOnce();
    return originalExportGif.apply(Exporter, args);
  };
}
