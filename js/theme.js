/* =========================================================
   MEME MAKER — theme.js
   ---------------------------------------------------------
   Cambia entre los 3 temas visuales (Naranja, Oscuro, Windows 95)
   y recuerda cuál eligió el usuario (localStorage), para que la
   próxima vez que abra la página se vea igual. El tema en sí se
   aplica con puro CSS (ver css/themes.css): aquí solo se pone/quita
   el atributo data-theme en <html> y se guarda la elección.

   El tema guardado también se aplica ANTES de esto, con un script
   chiquito al inicio de <head> en index.html -así se evita el
   parpadeo del tema naranja antes de cambiar al que ya tenía
   elegido el usuario-. Este archivo solo se encarga de que el
   selector del encabezado funcione y de guardar cambios nuevos.
   ========================================================= */

const ThemeManager = {
  STORAGE_KEY: "memeStudioTheme",
  THEMES: ["naranja", "dark", "win95"],
  DEFAULT: "naranja",

  get() {
    try {
      const saved = localStorage.getItem(ThemeManager.STORAGE_KEY);
      return ThemeManager.THEMES.includes(saved) ? saved : ThemeManager.DEFAULT;
    } catch (err) {
      return ThemeManager.DEFAULT;
    }
  },

  apply(theme) {
    // El tema "naranja" es el que ya define style.css por defecto, así
    // que para ese simplemente quitamos el atributo (nada que redefinir).
    if (theme === ThemeManager.DEFAULT) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  },

  set(theme) {
    if (!ThemeManager.THEMES.includes(theme)) return;
    ThemeManager.apply(theme);
    try {
      localStorage.setItem(ThemeManager.STORAGE_KEY, theme);
    } catch (err) {
      console.warn("No se pudo guardar el tema elegido:", err);
    }
    ThemeManager.syncButtons(theme);
  },

  syncButtons(theme) {
    document.querySelectorAll(".theme-switcher .theme-btn").forEach((btn) => {
      const isActive = btn.dataset.theme === theme;
      btn.classList.toggle("theme-btn--active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  },

  setup() {
    const switcher = document.getElementById("theme-switcher");
    if (!switcher) return;

    switcher.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => ThemeManager.set(btn.dataset.theme));
    });

    // El atributo ya se puso (o no) en el script chiquito de <head>; acá
    // solo sincronizamos qué botón se ve "activo".
    ThemeManager.syncButtons(ThemeManager.get());
  },
};

window.ThemeManager = ThemeManager;
