/* =========================================================
   MEME MAKER — win95-sounds.js
   ---------------------------------------------------------
   Sonidos retro SOLO para el tema Windows 95 (ver css/themes.css
   y js/theme.js). No usa ningún archivo de audio real de Windows
   -esos son propiedad de Microsoft-: son tonos sintetizados con la
   Web Audio API, pensados para sonar "a esa época" sin copiar nada.

   Todo pasa por acá:
   - clic: cualquier botón, mientras el tema sea "win95".
   - bienvenida: al CAMBIAR al tema Windows 95 (no al recargar la
     página ya con ese tema puesto, para no sorprender con un sonido
     apenas abre -además los navegadores bloquean audio sin que haya
     un clic antes-).
   - error: cada vez que la app muestra una alerta (window.alert).
   - confirmación: cada vez que se descarga un meme (ahí es donde
     counter.js ya cuenta el meme como creado).
   - abrir/cerrar "ventana": al abrir o cerrar el overlay de
     plantillas y el editor de stickers.

   Se puede silenciar con el botón 🔊/🔇 que aparece junto al
   selector de temas (solo cuando el tema activo es Windows 95); la
   preferencia se guarda en localStorage.
   ========================================================= */

const Win95Sounds = {
  MUTE_KEY: "memeStudioWin95Muted",
  ctx: null,
  muted: false,

  isWin95() {
    return document.documentElement.getAttribute("data-theme") === "win95";
  },

  loadMuted() {
    try {
      return localStorage.getItem(Win95Sounds.MUTE_KEY) === "1";
    } catch (err) {
      return false;
    }
  },

  saveMuted(value) {
    try {
      localStorage.setItem(Win95Sounds.MUTE_KEY, value ? "1" : "0");
    } catch (err) {
      /* nada que hacer si no hay localStorage disponible */
    }
  },

  /** El AudioContext se crea recién al primer sonido (así respeta la
   *  política de los navegadores de no reproducir audio sin que haya
   *  antes una interacción del usuario, como un clic). */
  ensureContext() {
    if (!Win95Sounds.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      Win95Sounds.ctx = new AudioContextClass();
    }
    if (Win95Sounds.ctx.state === "suspended") {
      Win95Sounds.ctx.resume();
    }
    return Win95Sounds.ctx;
  },

  /** Toca un tono simple: frecuencia (o lista de frecuencias en
   *  secuencia), tipo de onda, volumen y duración por nota. */
  playTone(freqs, { type = "square", gain = 0.05, noteDuration = 0.08, gap = 0.02 } = {}) {
    if (Win95Sounds.muted || !Win95Sounds.isWin95()) return;
    const ctx = Win95Sounds.ensureContext();
    if (!ctx) return;

    const list = Array.isArray(freqs) ? freqs : [freqs];
    let startTime = ctx.currentTime;

    list.forEach((freq) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Subida y bajada rápidas de volumen para que no truene al
      // empezar/terminar cada nota (un "clic" seco sin la envolvente
      // se escucha como un chasquido feo).
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(gain, startTime + 0.008);
      g.gain.linearRampToValueAtTime(0, startTime + noteDuration);

      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + noteDuration + 0.01);

      startTime += noteDuration + gap;
    });
  },

  click() {
    Win95Sounds.playTone(1200, { type: "square", gain: 0.035, noteDuration: 0.035, gap: 0 });
  },

  error() {
    Win95Sounds.playTone([180, 140], { type: "square", gain: 0.07, noteDuration: 0.11, gap: 0.03 });
  },

  notify() {
    Win95Sounds.playTone([784, 1047], { type: "triangle", gain: 0.06, noteDuration: 0.09, gap: 0.015 });
  },

  startup() {
    Win95Sounds.playTone([523, 659, 784], { type: "triangle", gain: 0.06, noteDuration: 0.14, gap: 0.02 });
  },

  windowOpen() {
    Win95Sounds.playTone([500, 900], { type: "sine", gain: 0.045, noteDuration: 0.05, gap: 0.005 });
  },

  windowClose() {
    Win95Sounds.playTone([900, 500], { type: "sine", gain: 0.045, noteDuration: 0.05, gap: 0.005 });
  },

  /** Muestra/oculta el botón de silenciar según el tema activo, y
   *  toca la "bienvenida" si el usuario ACABA de cambiar a Windows 95
   *  (nunca al cargar la página ya con ese tema puesto). */
  onThemeChanged(playStartupIfWin95) {
    const wrapper = document.getElementById("win95-sound-switcher");
    const isWin95 = Win95Sounds.isWin95();
    if (wrapper) wrapper.hidden = !isWin95;
    if (isWin95 && playStartupIfWin95) Win95Sounds.startup();
  },

  setupMuteButton() {
    const btn = document.getElementById("btn-win95-sound-toggle");
    if (!btn) return;
    const render = () => {
      btn.textContent = Win95Sounds.muted ? "🔇" : "🔊";
      btn.title = Win95Sounds.muted ? "Sonidos silenciados (clic para activar)" : "Sonidos activados (clic para silenciar)";
    };
    render();
    btn.addEventListener("click", () => {
      // El listener global de "clic" (setupGlobalClickSound) ya
      // ignora este botón en particular, así que acá solo nos
      // encargamos de cambiar el estado y, si vuelve a estar
      // activado, tocar la confirmación.
      Win95Sounds.muted = !Win95Sounds.muted;
      Win95Sounds.saveMuted(Win95Sounds.muted);
      render();
      if (!Win95Sounds.muted) Win95Sounds.click();
    });
  },

  setupGlobalClickSound() {
    // Fase de "captura" (antes de que el propio botón cambie de tema,
    // cierre un overlay, etc.): así el sonido de clic refleja el tema
    // que estaba activo EN EL MOMENTO del clic, no el que queda
    // después -por ejemplo, cambiar a otro tema desde Windows 95 sí sí
    // debe sonar el clic (todavía se estaba viendo Windows 95), pero
    // cambiar HACIA Windows 95 no duplica el clic porque en ese
    // instante todavía no era el tema activo (ahí solo suena la
    // bienvenida, ver onThemeChanged)-.
    document.addEventListener(
      "click",
      (evt) => {
        if (evt.target.closest("#btn-win95-sound-toggle")) return; // ya tiene su propio sonido
        if (evt.target.closest("button")) Win95Sounds.click();
      },
      true
    );
  },

  /** Intercepta window.alert para que las alertas de la app (imagen
   *  vacía, error al leer un video, etc.) tengan su propio sonido de
   *  error en el tema Windows 95 -sin tener que tocar cada lugar del
   *  código que usa alert(). */
  setupAlertSound() {
    const originalAlert = window.alert;
    window.alert = function (...args) {
      Win95Sounds.error();
      return originalAlert.apply(window, args);
    };
  },

  /** Cada descarga exitosa de un meme pasa por MemeCounter.increment
   *  (ver counter.js), así que es el mejor lugar para la campanita de
   *  "listo". */
  setupExportSound() {
    if (!window.MemeCounter || typeof MemeCounter.increment !== "function") return;
    const originalIncrement = MemeCounter.increment;
    MemeCounter.increment = async function (...args) {
      const result = await originalIncrement.apply(MemeCounter, args);
      Win95Sounds.notify();
      return result;
    };
  },

  /** Sonido de "abrir/cerrar ventana" para los overlays de pantalla
   *  completa (plantillas y editor de stickers), mirando cuándo
   *  cambia su atributo "hidden". */
  setupOverlaySounds() {
    ["templates-overlay", "sticker-editor-overlay"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      let wasHidden = el.hidden;
      const observer = new MutationObserver(() => {
        if (el.hidden === wasHidden) return;
        wasHidden = el.hidden;
        if (el.hidden) Win95Sounds.windowClose();
        else Win95Sounds.windowOpen();
      });
      observer.observe(el, { attributes: true, attributeFilter: ["hidden"] });
    });
  },

  setup() {
    Win95Sounds.muted = Win95Sounds.loadMuted();
    Win95Sounds.setupMuteButton();
    Win95Sounds.setupGlobalClickSound();
    Win95Sounds.setupAlertSound();
    Win95Sounds.setupExportSound();
    Win95Sounds.setupOverlaySounds();

    // Estado inicial: mostramos/ocultamos el botón de silenciar según
    // el tema con el que cargó la página, pero SIN tocar la
    // "bienvenida" (esa solo suena cuando el usuario elige el tema
    // Windows 95 con un clic, ver theme.js).
    Win95Sounds.onThemeChanged(false);

    // Cada vez que cambia el tema (data-theme en <html>), sincronizamos
    // el botón de silenciar y -si el cambio fue HACIA win95- tocamos la
    // bienvenida.
    const observer = new MutationObserver(() => Win95Sounds.onThemeChanged(true));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  },
};

window.Win95Sounds = Win95Sounds;
