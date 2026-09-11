/* =========================================================
   MEME MAKER — mobile-nav.js
   ---------------------------------------------------------
   En celular, la app deja de ser "una página larga para
   desplazarse" y pasa a mostrar UNA sola columna a la vez
   (Lienzo / Herramientas / Ajustes), como una app de verdad,
   con una barra fija abajo para saltar entre ellas.

   En escritorio este módulo no hace nada: las tres columnas
   siguen mostrándose una al lado de la otra, como siempre.
   ========================================================= */

const MobileNav = {
  MOBILE_BREAKPOINT: "(max-width: 960px)",
  mql: null,
  currentTab: "lienzo",

  setup() {
    MobileNav.mql = window.matchMedia(MobileNav.MOBILE_BREAKPOINT);

    const nav = document.getElementById("mobile-tabbar");
    if (nav) {
      nav.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tab]");
        if (!btn) return;
        MobileNav.setTab(btn.dataset.tab);
      });
    }

    MobileNav.applyState();

    // addEventListener("change", …) es lo moderno; addListener es el
    // método viejo que todavía hace falta en algunos navegadores.
    if (typeof MobileNav.mql.addEventListener === "function") {
      MobileNav.mql.addEventListener("change", MobileNav.applyState);
    } else if (typeof MobileNav.mql.addListener === "function") {
      MobileNav.mql.addListener(MobileNav.applyState);
    }
  },

  isActive() {
    return !!(MobileNav.mql && MobileNav.mql.matches);
  },

  /** Refleja currentTab en el DOM si la barra de pestañas está activa
   *  (celular); si se pasó a escritorio, quita el atributo y las tres
   *  columnas vuelven a mostrarse todas juntas como siempre. */
  applyState() {
    const layout = document.querySelector(".app-layout");
    if (!layout) return;
    if (MobileNav.isActive()) {
      layout.setAttribute("data-mobile-tab", MobileNav.currentTab);
    } else {
      layout.removeAttribute("data-mobile-tab");
    }
  },

  setTab(tab) {
    if (tab === MobileNav.currentTab) return;
    MobileNav.currentTab = tab;
    MobileNav.applyState();

    document.querySelectorAll(".mobile-tab-btn").forEach((btn) => {
      btn.classList.toggle("mobile-tab-btn--active", btn.dataset.tab === tab);
    });

    // Al cambiar de pestaña, arrancamos desde arriba de esa sección
    // (si no, podría quedar a mitad de scroll de la pestaña anterior).
    window.scrollTo(0, 0);
  },

  /**
   * Usado por Panels.scrollToPropertiesIfNeeded (ver panels.js): en
   * celular, "Propiedades" vive dentro de la pestaña "Ajustes", así
   * que hace falta cambiar de pestaña ANTES de poder desplazarse hasta
   * ahí. En escritorio no hace nada (ahí las tres columnas ya están
   * todas a la vista). Devuelve true si tuvo que cambiar de pestaña
   * -así quien llama sabe que conviene resaltar la sección aunque ya
   * haya quedado a la vista sin necesidad de scroll extra-.
   */
  goToPropertiesTab() {
    if (!MobileNav.isActive()) return false;
    if (MobileNav.currentTab === "ajustes") return false;
    MobileNav.setTab("ajustes");
    return true;
  },
};

window.MobileNav = MobileNav;
