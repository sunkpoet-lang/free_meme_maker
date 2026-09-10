/* =========================================================
   MEME MAKER — panels.js
   ---------------------------------------------------------
   Conecta toda la interfaz (paneles izquierdo y derecho) con
   el estado (App) y los elementos. Se encarga de:
     - los botones de creación (imagen, texto, stickers, formas,
       plantillas, fondo)
     - la lista de capas
     - el panel de propiedades del elemento seleccionado
     - el tamaño del lienzo
   ========================================================= */

const TEMPLATES_PAGE_SIZE = 50;

const Panels = {
  setup() {
    Panels.setupQuickNav();
    Panels.setupToolbar();
    Panels.setupImageTool();
    Panels.setupTextTool();
    Panels.setupStickers();
    Panels.setupShapes();
    Panels.setupTemplates();
    Panels.setupTemplatesOverlay();
    Panels.setupBackground();
    Panels.setupCanvasSize();
    Panels.setupPropertiesDelegation();

    Panels.refreshLayers();
    Panels.refreshProperties();
  },

  /* ---------- Navegación rápida del panel izquierdo ---------- */

  /**
   * El panel izquierdo tiene muchas secciones (Imagen, Texto, Stickers,
   * Formas, Plantillas, Mis plantillas, Fondo) y hay que hacer scroll
   * para llegar a las últimas. Esta barra fija (arriba del panel)
   * permite saltar directo a cualquier sección con un clic, y resalta
   * brevemente la sección de destino para que sea fácil ubicarla.
   */
  setupQuickNav() {
    const nav = document.getElementById("panel-quicknav");
    if (!nav) return;

    nav.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-target]");
      if (!btn) return;

      // "Plantillas" ya no es una sección larga con una grilla dentro:
      // ahora abre directo la ventana grande de plantillas.
      if (btn.dataset.target === "section-plantillas") {
        Panels.openTemplatesOverlay();
        return;
      }

      const target = document.getElementById(btn.dataset.target);
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "start" });

      // Reinicia la animación de resaltado aunque se haga clic varias
      // veces seguidas en el mismo botón.
      target.classList.remove("tool-section--highlight");
      void target.offsetWidth; // fuerza un reflow
      target.classList.add("tool-section--highlight");
      setTimeout(() => target.classList.remove("tool-section--highlight"), 1100);
    });
  },

  /* ---------- Barra superior: deshacer / rehacer / duplicar / eliminar ---------- */

  setupToolbar() {
    document.getElementById("btn-undo").addEventListener("click", () => History.undo());
    document.getElementById("btn-redo").addEventListener("click", () => History.redo());
    document.getElementById("btn-duplicate").addEventListener("click", () => {
      if (!App.selectedId) return;
      Elements.duplicate(App.selectedId);
      Render.draw();
      Panels.refreshLayers();
      Panels.refreshProperties();
      History.commit();
    });
    document.getElementById("btn-delete").addEventListener("click", () => Elements.deleteSelected());
  },

  /* ---------- Herramienta: imagen ---------- */

  setupImageTool() {
    const btn = document.getElementById("btn-upload-image");
    const input = document.getElementById("file-input");
    btn.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      if (input.files && input.files[0]) {
        Interactions.loadImageFile(input.files[0]);
      }
      input.value = ""; // permite volver a elegir el mismo archivo
    });

    const gifUrlInput = document.getElementById("gif-url-input");
    const gifUrlBtn = document.getElementById("btn-load-gif-url");
    const submitGifUrl = async () => {
      const url = gifUrlInput.value.trim();
      if (!url) {
        gifUrlInput.focus();
        return;
      }
      const ok = await Interactions.loadGifFromUrl(url);
      if (ok) gifUrlInput.value = "";
    };
    gifUrlBtn.addEventListener("click", submitGifUrl);
    gifUrlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitGifUrl();
      }
    });
  },

  /* ---------- Herramienta: texto ---------- */

  setupTextTool() {
    const addText = () => {
      Elements.addText({});
      Render.draw();
      Panels.refreshLayers();
      Panels.refreshProperties();
      History.commit();
    };
    document.getElementById("btn-add-text").addEventListener("click", addText);
    // Botón grande arriba del lienzo, más accesible que ir hasta el panel izquierdo.
    document.getElementById("btn-quick-add-text").addEventListener("click", addText);
  },

  /* ---------- Herramienta: stickers ---------- */

  setupStickers() {
    const grid = document.getElementById("sticker-grid");
    grid.innerHTML = STICKER_EMOJIS.map((e) => `<button type="button" class="sticker-btn">${e}</button>`).join("");
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".sticker-btn");
      if (!btn) return;
      Elements.addText({ content: btn.textContent, fontSize: 100, isSticker: true });
      Render.draw();
      Panels.refreshLayers();
      Panels.refreshProperties();
      History.commit();
    });
  },

  /* ---------- Herramienta: formas ---------- */

  setupShapes() {
    document.getElementById("shape-grid").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-shape]");
      if (!btn) return;
      const shapeType = btn.dataset.shape;
      const isLine = shapeType === "line" || shapeType === "arrow";
      Elements.addShape({ shapeType, width: isLine ? 200 : 160, height: isLine ? 120 : 160 });
      Render.draw();
      Panels.refreshLayers();
      Panels.refreshProperties();
      History.commit();
    });
  },

  /* ---------- Herramienta: plantillas (en línea, vía la API pública de Imgflip) ---------- */

  /**
   * Intenta traer plantillas reales y reconocibles desde la API pública
   * y gratuita de Imgflip (api.imgflip.com/get_memes) — no requiere
   * cuenta ni llave de API, está pensada justo para esto. Si falla
   * (sin internet, el servicio no responde, etc.) usamos nuestras
   * plantillas de ejemplo generadas localmente como respaldo, para que
   * el panel nunca quede vacío ni rompa la aplicación.
   */
  /**
   * Combina tres fuentes públicas y gratuitas de plantillas:
   *  - Imgflip (api.imgflip.com/get_memes): ~100 plantillas estáticas.
   *  - Imgflip GIF (get_memes?type=gif): plantillas animadas -las
   *    únicas de las tres que se pueden editar y exportar como GIF
   *    animado real (ver gifs.js). Imgflip solo cobra por generar el
   *    GIF final en SU servidor -listar cuáles existen es gratis, así
   *    que hacemos la composición nosotros mismos en el navegador.
   *  - memegen (api.memegen.link/templates): varios cientos de
   *    plantillas estáticas más (proyecto de código abierto, activo).
   * Si alguna falla, seguimos con las que sí respondieron. Si las tres
   * fallan (por ejemplo sin internet), usamos las plantillas de
   * ejemplo generadas localmente para que el panel nunca quede vacío.
   */
  async setupTemplates() {
    let imgflipTemplates = [];
    let imgflipGifTemplates = [];
    let memegenTemplates = [];
    let imgflipFailed = false;
    let imgflipGifFailed = false;
    let memegenFailed = false;

    try {
      const res = await fetch("https://api.imgflip.com/get_memes");
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data.memes)) {
        imgflipTemplates = data.data.memes.map((m) => ({
          name: m.name,
          url: m.url,
          source: "imgflip",
        }));
      } else {
        imgflipFailed = true;
      }
    } catch (err) {
      console.warn("No se pudieron cargar plantillas de Imgflip:", err);
      imgflipFailed = true;
    }

    try {
      const resGif = await fetch("https://api.imgflip.com/get_memes?type=gif");
      const dataGif = await resGif.json();
      if (dataGif && dataGif.success && Array.isArray(dataGif.data.memes)) {
        imgflipGifTemplates = dataGif.data.memes.map((m) => ({
          name: m.name,
          url: m.url,
          source: "imgflip-gif",
          isGif: true,
        }));
      } else {
        imgflipGifFailed = true;
      }
    } catch (err) {
      console.warn("No se pudieron cargar plantillas GIF de Imgflip:", err);
      imgflipGifFailed = true;
    }

    try {
      const res2 = await fetch("https://api.memegen.link/templates");
      const data2 = await res2.json();
      if (Array.isArray(data2)) {
        memegenTemplates = data2
          .filter((t) => t.id && t.blank)
          .map((t) => ({
            name: t.name || t.id,
            url: t.blank,
            source: "memegen",
          }));
      } else {
        memegenFailed = true;
      }
    } catch (err) {
      console.warn("No se pudieron cargar plantillas de memegen:", err);
      memegenFailed = true;
    }

    let templates = [...imgflipTemplates, ...imgflipGifTemplates, ...memegenTemplates];
    let usingFallback = false;

    if (templates.length === 0) {
      usingFallback = true;
      templates = TEMPLATES.map((t) => ({
        name: t.name,
        url: generateTemplateDataURL(t, 300, 300),
        source: "local",
      }));
    }

    Panels.onlineTemplates = templates;
    Panels.onlineTemplatesFallback = usingFallback;
    // Se cargó al menos una fuente, pero no las tres: no es un fallo
    // total, solo avisamos que hay menos variedad de la esperada.
    Panels.onlineTemplatesPartial = !usingFallback && (imgflipFailed || imgflipGifFailed || memegenFailed);

    // Si el usuario ya tenía abierta la ventana de plantillas (mirando
    // "Populares") mientras esto terminaba de cargar, refrescamos la grilla.
    if (Panels.templatesOverlayOpen && Panels.overlayState.tab === "popular") {
      Panels.renderOverlayGrid();
    }
  },

  /**
   * Coloca una plantilla (de Imgflip, local, o "Mis plantillas") como
   * fondo del lienzo actual. Si la imagen viene de un sitio externo
   * (Imgflip), le pedimos permiso "crossOrigin" al cargarla — así el
   * lienzo no queda "contaminado" y sigue siendo posible exportar el
   * meme después sin errores.
   */
  applyTemplate(template) {
    if (template.source === "local-moremes") {
      Panels.applyMoreMemesTemplate(template);
      return;
    }
    if (template.isGif) {
      Panels.applyGifTemplate(template);
      return;
    }

    const finishInsert = (src, imgOrCanvas) => {
      App.imageCache[src] = imgOrCanvas;
      const el = Elements.addImage({ src, width: App.canvas.width, height: App.canvas.height });
      Elements.sendToBack(el.id);
      App.selectedId = null;
      Render.draw();
      Panels.refreshLayers();
      Panels.refreshProperties();
      History.commit();
      Panels.closeTemplatesOverlay();
    };

    const img = new Image();
    if (template.source === "imgflip" || template.source === "memegen") {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => finishInsert(template.url, img);
    img.onerror = async () => {
      // La carga directa con "crossOrigin" falló -normalmente porque el
      // sitio de origen no autoriza CORS-. Como respaldo, descargamos el
      // archivo a través de un proxy y lo insertamos como blob: URL, que
      // no necesita CORS y no deja el lienzo "contaminado" para exportar.
      if (template.source !== "imgflip" && template.source !== "memegen") {
        console.warn("No se pudo cargar la plantilla:", template.url);
        return;
      }
      try {
        Panels.setBusy(true, "La plantilla no cargó directo, probando una vía alterna…");
        const buffer = await GifEngine.fetchBytes(template.url);
        const blobUrl = URL.createObjectURL(new Blob([buffer]));
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          Panels.setBusy(false);
          finishInsert(blobUrl, fallbackImg);
        };
        fallbackImg.onerror = () => {
          Panels.setBusy(false);
          console.warn("No se pudo cargar la plantilla ni siquiera por la vía alterna:", template.url);
          alert("No se pudo cargar esta plantilla. Prueba con otra.");
        };
        fallbackImg.src = blobUrl;
      } catch (err) {
        Panels.setBusy(false);
        console.warn("No se pudo cargar la plantilla ni siquiera por la vía alterna:", template.url, err);
        alert("No se pudo cargar esta plantilla. Prueba con otra.");
      }
    };
    img.src = template.url;
  },

  /**
   * Aplica una plantilla GIF animada: la descarga y descompone en
   * fotogramas (GifEngine, en gifs.js). El primer fotograma se usa
   * como imagen de fondo normal -así el resto del editor (mover,
   * redimensionar, capas, etc.) funciona exactamente igual que con
   * cualquier otra imagen, sin cambios-, y los demás fotogramas
   * quedan guardados aparte para poder animar el resultado al
   * exportar como GIF.
   */
  async applyGifTemplate(template) {
    Panels.setBusy(true, "Descargando y preparando el GIF…");
    try {
      const { width, height, frames } = await GifEngine.loadFromUrl(template.url);
      const gifId = "gif_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      App.gifCache[gifId] = { width, height, frames };

      const previewSrc = frames[0].canvas.toDataURL("image/png");
      App.imageCache[previewSrc] = frames[0].canvas;

      const el = Elements.addImage({ src: previewSrc, width: App.canvas.width, height: App.canvas.height });
      el.animatedGifId = gifId;
      Elements.sendToBack(el.id);
      App.selectedId = null;
      Render.draw();
      Panels.refreshLayers();
      Panels.refreshProperties();
      History.commit();
      Panels.closeTemplatesOverlay();
    } catch (err) {
      console.warn("No se pudo cargar el GIF:", err);
      alert(
        "No se pudo cargar este GIF -puede que el sitio de origen no permita usarlo aquí. Prueba con otra plantilla."
      );
    } finally {
      Panels.setBusy(false);
    }
  },

  /**
   * Aplica una plantilla de la pestaña "MORE MEMES" (imágenes locales
   * del propio usuario, guardadas en assets/MORE-MEMES/). Bajo file://
   * cada archivo local tiene un origen "opaco" para el navegador: una
   * <img> con una ruta relativa se VE bien, pero dibujarla en el canvas
   * lo deja "contaminado" y ya no se puede exportar (error de
   * seguridad). Por eso estas imágenes se guardaron aparte, codificadas
   * en base64 (ver js/more-memes-data/*.js), y aquí las convertimos a
   * un blob: -que nunca contamina el canvas, sea cual sea su origen- en
   * vez de usar la ruta del archivo directamente.
   */
  async applyMoreMemesTemplate(template) {
    // Bajo http(s) -como en GitHub Pages- las imágenes son del mismo
    // origen que la página, así que no contaminan el canvas: se pueden
    // cargar directo desde su ruta en assets/MORE-MEMES/, sin pasar por
    // los archivos pesados de base64 (esos solo son necesarios para
    // file://, ver la nota arriba).
    if (location.protocol !== "file:") {
      Panels.applyMoreMemesTemplateDirect(template);
      return;
    }
    Panels.setBusy(true, "Preparando la imagen…");
    try {
      await Panels.loadMoreMemesData();
      const dataUri = window.MORE_MEMES_DATA_URIS && window.MORE_MEMES_DATA_URIS[template.url];
      if (!dataUri) {
        alert("No se pudo cargar esta imagen. Prueba con otra.");
        return;
      }
      const blob = Panels.dataUriToBlob(dataUri);
      const blobUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        App.imageCache[blobUrl] = img;
        const el = Elements.addImage({ src: blobUrl, width: App.canvas.width, height: App.canvas.height });
        Elements.sendToBack(el.id);
        App.selectedId = null;
        Render.draw();
        Panels.refreshLayers();
        Panels.refreshProperties();
        History.commit();
        Panels.closeTemplatesOverlay();
      };
      img.onerror = () => {
        console.warn("No se pudo cargar la plantilla de MORE MEMES:", template.url);
        alert("No se pudo cargar esta imagen. Prueba con otra.");
      };
      img.src = blobUrl;
    } catch (err) {
      console.warn("No se pudo aplicar la plantilla de MORE MEMES:", err);
      alert("No se pudo cargar esta imagen. Prueba con otra.");
    } finally {
      Panels.setBusy(false);
    }
  },

  /**
   * Versión "directa" de applyMoreMemesTemplate para cuando la página se
   * sirve por http(s) (GitHub Pages, etc.): carga la imagen desde su ruta
   * normal en assets/MORE-MEMES/, igual que cualquier otra plantilla.
   */
  applyMoreMemesTemplateDirect(template) {
    Panels.setBusy(true, "Preparando la imagen…");
    const img = new Image();
    img.onload = () => {
      Panels.setBusy(false);
      App.imageCache[template.url] = img;
      const el = Elements.addImage({ src: template.url, width: App.canvas.width, height: App.canvas.height });
      Elements.sendToBack(el.id);
      App.selectedId = null;
      Render.draw();
      Panels.refreshLayers();
      Panels.refreshProperties();
      History.commit();
      Panels.closeTemplatesOverlay();
    };
    img.onerror = () => {
      Panels.setBusy(false);
      console.warn("No se pudo cargar la plantilla de MORE MEMES:", template.url);
      alert("No se pudo cargar esta imagen. Prueba con otra.");
    };
    img.src = template.url;
  },

  /** Convierte una data: URI (base64) en un Blob, sin pasar por fetch(). */
  dataUriToBlob(dataUri) {
    const [header, base64] = dataUri.split(",");
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  },

  /**
   * Carga (una sola vez, en segundo plano) los 9 archivos con las
   * imágenes de MORE MEMES en base64. Son pesados, así que no van como
   * <script> fijo en index.html -eso frenaría la carga inicial de toda
   * la app- sino que se inyectan dinámicamente recién cuando el usuario
   * abre la pestaña "MORE MEMES" o aplica una de sus plantillas.
   */
  loadMoreMemesData() {
    if (Panels._moreMemesDataPromise) return Panels._moreMemesDataPromise;

    const files = typeof MORE_MEMES_DATA_FILES !== "undefined" ? MORE_MEMES_DATA_FILES : [];
    Panels._moreMemesDataPromise = Promise.all(
      files.map(
        (src) =>
          new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => {
              console.warn("No se pudo cargar el archivo de datos de MORE MEMES:", src);
              resolve(); // seguimos con los demás aunque uno falle
            };
            document.head.appendChild(script);
          })
      )
    );
    return Panels._moreMemesDataPromise;
  },

  /** Muestra u oculta el overlay de "procesando" (carga/exportación de GIFs). */
  setBusy(show, message = "") {
    const overlay = document.getElementById("busy-overlay");
    if (!overlay) return;
    overlay.hidden = !show;
    if (show) document.getElementById("busy-message").textContent = message;
  },

  /* ---------- Ventana grande de plantillas (vista horizontal, a pantalla completa) ---------- */

  /**
   * Antes las plantillas vivían apretadas dentro del panel izquierdo,
   * que es angosto — costaba recorrerlas. Ahora "Plantillas" abre una
   * ventana que aprovecha todo el ancho de la pantalla, con pestañas
   * para elegir entre plantillas populares (Imgflip) y las que el
   * propio usuario guardó ("Mis plantillas"), más un buscador.
   */
  setupTemplatesOverlay() {
    Panels.templatesOverlayOpen = false;
    Panels.overlayState = { tab: "popular", query: "", page: 1, subcategory: "" };
    Panels.setupMoreMemesSubcats();

    const grid = document.getElementById("templates-overlay-grid");
    const pagination = document.getElementById("templates-pagination");
    const search = document.getElementById("templates-search");

    document.getElementById("btn-open-templates").addEventListener("click", () => Panels.openTemplatesOverlay());
    // Botón grande arriba del lienzo, más accesible que ir hasta el panel izquierdo.
    document.getElementById("btn-quick-templates").addEventListener("click", () => Panels.openTemplatesOverlay());
    document.getElementById("btn-close-templates").addEventListener("click", () => Panels.closeTemplatesOverlay());

    document.querySelectorAll(".templates-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".templates-tab-btn").forEach((b) => b.classList.remove("templates-tab-btn--active"));
        btn.classList.add("templates-tab-btn--active");
        Panels.overlayState.tab = btn.dataset.tab;
        Panels.overlayState.page = 1;
        Panels.overlayState.subcategory = "";
        Panels.updateMoreMemesSubcatsVisibility();
        Panels.renderOverlayGrid();
        // Si es la primera vez que se abre "MORE MEMES", precargamos en
        // segundo plano los datos (pesados) de las imágenes en base64.
        if (btn.dataset.tab === "moremes") Panels.loadMoreMemesData();
      });
    });

    search.addEventListener("input", () => {
      Panels.overlayState.query = search.value.trim().toLowerCase();
      Panels.overlayState.page = 1;
      Panels.renderOverlayGrid();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && Panels.templatesOverlayOpen) Panels.closeTemplatesOverlay();
    });

    grid.addEventListener("click", (e) => {
      // El botón "eliminar" de "Mis plantillas" va anidado dentro de la
      // tarjeta: hay que resolverlo primero para que no también se
      // interprete el clic como "aplicar esta plantilla".
      const delBtn = e.target.closest(".custom-template-delete");
      if (delBtn) {
        CustomTemplates.remove(delBtn.dataset.id);
        Panels.renderOverlayGrid();
        return;
      }
      const item = e.target.closest("[data-template-index]");
      if (!item) return;
      const list = Panels.currentOverlayList();
      const tpl = list[Number(item.dataset.templateIndex)];
      if (tpl) Panels.applyTemplate(tpl);
    });

    // Botones "Anterior" / números de página / "Siguiente".
    pagination.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-page]");
      if (!btn || btn.disabled) return;
      const current = Panels.overlayState.page;
      if (btn.dataset.page === "prev") Panels.overlayState.page = current - 1;
      else if (btn.dataset.page === "next") Panels.overlayState.page = current + 1;
      else Panels.overlayState.page = Number(btn.dataset.page);
      Panels.renderOverlayGrid();
      document.getElementById("templates-overlay-body").scrollTop = 0;
    });
  },

  openTemplatesOverlay() {
    Panels.templatesOverlayOpen = true;
    document.getElementById("templates-overlay").hidden = false;
    Panels.overlayState.page = 1;
    Panels.renderOverlayGrid();
    // Pequeña espera antes de enfocar el buscador, para que en móvil el
    // teclado no salte en medio de la apertura de la ventana.
    setTimeout(() => document.getElementById("templates-search").focus(), 50);
  },

  closeTemplatesOverlay() {
    Panels.templatesOverlayOpen = false;
    document.getElementById("templates-overlay").hidden = true;
  },

  /**
   * Arma la barra de "chips" para filtrar MORE MEMES por subcategoría
   * ("Todas" + cada una de las 9 carpetas originales del usuario).
   * Solo se ve mientras la pestaña activa es "MORE MEMES".
   */
  setupMoreMemesSubcats() {
    const bar = document.getElementById("moremes-subcats");
    if (!bar) return;
    const categories = typeof MORE_MEMES_CATEGORIES !== "undefined" ? MORE_MEMES_CATEGORIES : [];

    bar.innerHTML =
      `<button type="button" class="moremes-subcat-btn moremes-subcat-btn--active" data-subcat="">Todas</button>` +
      categories
        .map((c) => `<button type="button" class="moremes-subcat-btn" data-subcat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
        .join("");

    bar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-subcat]");
      if (!btn) return;
      bar.querySelectorAll(".moremes-subcat-btn").forEach((b) => b.classList.remove("moremes-subcat-btn--active"));
      btn.classList.add("moremes-subcat-btn--active");
      Panels.overlayState.subcategory = btn.dataset.subcat;
      Panels.overlayState.page = 1;
      Panels.renderOverlayGrid();
    });
  },

  /** Muestra la barra de subcategorías solo en la pestaña "MORE MEMES". */
  updateMoreMemesSubcatsVisibility() {
    const bar = document.getElementById("moremes-subcats");
    if (!bar) return;
    bar.hidden = Panels.overlayState.tab !== "moremes";
  },

  /** Lista de plantillas de la pestaña activa, ya filtrada por el buscador. */
  currentOverlayList() {
    const { tab, query, subcategory } = Panels.overlayState;
    let list;
    if (tab === "mine") {
      list = CustomTemplates.load().map((t) => ({
        name: t.name,
        url: t.dataUrl,
        source: "local",
        id: t.id,
        description: t.description,
      }));
    } else if (tab === "moremes") {
      list = (typeof MORE_MEMES_TEMPLATES !== "undefined" ? MORE_MEMES_TEMPLATES : []).map((t) => ({
        name: t.name,
        url: t.url,
        source: "local-moremes",
        category: t.category,
      }));
      if (subcategory) list = list.filter((t) => t.category === subcategory);
    } else {
      list = Panels.onlineTemplates || [];
    }
    if (query) {
      list = list.filter((t) => t.name.toLowerCase().includes(query));
    }
    return list;
  },

  renderOverlayGrid() {
    const grid = document.getElementById("templates-overlay-grid");
    const pagination = document.getElementById("templates-pagination");
    const { tab } = Panels.overlayState;
    const list = Panels.currentOverlayList();

    if (!Panels.onlineTemplates && tab === "popular") {
      grid.innerHTML = `<p class="placeholder-note">Cargando plantillas…</p>`;
      pagination.innerHTML = "";
      return;
    }

    if (list.length === 0) {
      grid.innerHTML =
        tab === "mine"
          ? `<p class="placeholder-note">Todavía no guardaste ninguna plantilla propia. Selecciona una imagen en el lienzo y usa "Guardar como plantilla" en Propiedades.</p>`
          : `<p class="placeholder-note">No se encontraron plantillas con ese nombre.</p>`;
      pagination.innerHTML = "";
      return;
    }

    // Con cientos de plantillas, mostrarlas todas de una vez hacía muy
    // largo y pesado el scroll. Las dividimos en páginas de tamaño fijo
    // y agregamos controles para navegar entre ellas.
    const totalPages = Math.max(1, Math.ceil(list.length / TEMPLATES_PAGE_SIZE));
    Panels.overlayState.page = Math.min(Math.max(1, Panels.overlayState.page), totalPages);
    const page = Panels.overlayState.page;
    const startIdx = (page - 1) * TEMPLATES_PAGE_SIZE;
    const pageItems = list.slice(startIdx, startIdx + TEMPLATES_PAGE_SIZE);

    let fallbackHint = "";
    if (tab === "popular" && Panels.onlineTemplatesFallback) {
      fallbackHint = `<p class="hint templates-fallback-hint">No se pudieron cargar plantillas en línea (¿sin internet?). Mostrando ejemplos locales.</p>`;
    } else if (tab === "popular" && Panels.onlineTemplatesPartial) {
      fallbackHint = `<p class="hint templates-fallback-hint">Alguna de las fuentes de plantillas en línea no respondió: se muestran las que sí se pudieron cargar (${list.length}).</p>`;
    }

    const showingHint =
      totalPages > 1
        ? `<p class="hint templates-showing-hint">Mostrando ${startIdx + 1}–${startIdx + pageItems.length} de ${list.length} plantillas</p>`
        : "";

    // En "Populares" cada tarjeta es un <button> normal. En "Mis
    // plantillas" es un <div> porque lleva adentro un botón de eliminar
    // -un <button> no puede contener otro <button> válidamente en HTML.
    const tag = tab === "mine" ? "div" : "button";
    const openTag = tag === "button" ? `<button type="button"` : `<div`;

    grid.innerHTML =
      fallbackHint +
      showingHint +
      pageItems
        .map((t, i) => {
          const absoluteIndex = startIdx + i;
          return `
        ${openTag} class="template-btn" data-template-index="${absoluteIndex}" title="${escapeHtml(t.description || t.name)}">
          ${t.isGif ? `<span class="template-gif-badge">GIF</span>` : ""}
          <img src="${t.url}" alt="${escapeHtml(t.name)}" loading="lazy" />
          <span>${escapeHtml(t.name)}</span>
          ${tab === "mine" ? `<button type="button" class="custom-template-delete" data-id="${t.id}" title="Eliminar plantilla">🗑️</button>` : ""}
        </${tag}>`;
        })
        .join("");

    pagination.innerHTML = Panels.buildPaginationHTML(page, totalPages);
  },

  /**
   * Genera los controles "‹ Anterior · 1 2 3 … N · Siguiente ›". Con
   * pocas páginas se muestran todos los números; con muchas, solo un
   * rango alrededor de la página actual (más la primera y la última),
   * para no llenar la barra de botones.
   */
  buildPaginationHTML(page, totalPages) {
    if (totalPages <= 1) return "";

    const MAX_NUMBERED = 9;
    let pageNumbers;
    if (totalPages <= MAX_NUMBERED) {
      pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      const set = new Set([1, totalPages, page - 1, page, page + 1]);
      pageNumbers = Array.from(set)
        .filter((p) => p >= 1 && p <= totalPages)
        .sort((a, b) => a - b);
    }

    let html = `<button type="button" class="templates-page-btn" data-page="prev" ${page <= 1 ? "disabled" : ""}>‹ Anterior</button>`;

    let previous = 0;
    for (const p of pageNumbers) {
      if (previous && p - previous > 1) html += `<span class="templates-page-ellipsis">…</span>`;
      html += `<button type="button" class="templates-page-btn ${
        p === page ? "templates-page-btn--active" : ""
      }" data-page="${p}">${p}</button>`;
      previous = p;
    }

    html += `<button type="button" class="templates-page-btn" data-page="next" ${page >= totalPages ? "disabled" : ""}>Siguiente ›</button>`;
    return html;
  },

  /* ---------- Herramienta: fondo ---------- */

  setupBackground() {
    const input = document.getElementById("background-color-input");
    input.addEventListener("input", () => {
      App.backgroundColor = input.value;
      Render.draw();
    });
    input.addEventListener("change", () => History.commit());
  },

  /* ---------- Lienzo: tamaño ---------- */

  setupCanvasSize() {
    const select = document.getElementById("canvas-size-select");
    const customRow = document.getElementById("custom-size-row");

    select.addEventListener("change", () => {
      if (select.value === "custom") {
        customRow.hidden = false;
        return;
      }
      customRow.hidden = true;
      const [w, h] = select.value.split("x").map(Number);
      Panels.applyCanvasSize(w, h);
    });

    document.getElementById("btn-apply-size").addEventListener("click", () => {
      const w = Math.max(100, Math.min(4000, Number(document.getElementById("custom-width").value) || 800));
      const h = Math.max(100, Math.min(4000, Number(document.getElementById("custom-height").value) || 800));
      Panels.applyCanvasSize(w, h);
    });
  },

  applyCanvasSize(w, h, { commit = true } = {}) {
    App.canvas.width = w;
    App.canvas.height = h;
    document.getElementById("canvas-size-label").textContent = `${w} × ${h} px`;
    Panels.syncCanvasSizeSelect(w, h);
    Render.draw();
    if (commit) History.commit();
  },

  /** Refleja w×h en el selector de tamaño (marca el preset que coincida, o "Personalizado"). */
  syncCanvasSizeSelect(w, h) {
    const select = document.getElementById("canvas-size-select");
    const customRow = document.getElementById("custom-size-row");
    const value = `${w}x${h}`;
    const matches = Array.from(select.options).some((o) => o.value === value);

    if (matches) {
      select.value = value;
      customRow.hidden = true;
    } else {
      select.value = "custom";
      document.getElementById("custom-width").value = w;
      document.getElementById("custom-height").value = h;
      customRow.hidden = false;
    }
  },

  /**
   * Calcula un tamaño de lienzo razonable a partir de las dimensiones
   * reales de una imagen: respeta su proporción, pero la limita entre
   * un mínimo y un máximo para que el lienzo no quede ni diminuto ni
   * gigante (más lento de manejar) en fotos muy chicas o muy grandes.
   */
  computeAutoCanvasSize(imgWidth, imgHeight) {
    const MIN_DIM = 300;
    const MAX_DIM = 2000;
    let w = imgWidth;
    let h = imgHeight;

    if (Math.max(w, h) > MAX_DIM) {
      const scale = MAX_DIM / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    if (Math.min(w, h) < MIN_DIM) {
      const scale = MIN_DIM / Math.min(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    return { width: Math.max(50, w), height: Math.max(50, h) };
  },

  /* ---------- Capas ---------- */

  refreshLayers() {
    // Aprovechamos este mismo punto -se llama después de cualquier
    // cambio en los elementos del lienzo (agregar, borrar, deshacer,
    // rehacer...)- para mostrar/ocultar la opción "GIF animado" del
    // exportador, según si hay o no una plantilla GIF en el lienzo.
    if (window.Exporter) Exporter.updateGifOptionVisibility();

    const list = document.getElementById("layers-list");

    if (App.elements.length === 0) {
      list.innerHTML = `<p class="placeholder-note">Todavía no hay elementos en el lienzo.</p>`;
      return;
    }

    const iconFor = (el) => {
      if (el.type === "image") return "🖼️";
      if (el.type === "text") return "🔤";
      if (el.shapeType === "rect") return "▭";
      if (el.shapeType === "circle") return "⬤";
      if (el.shapeType === "line") return "╱";
      return "➤";
    };
    const labelFor = (el) => {
      if (el.type === "text") return el.content.slice(0, 18) || "(texto vacío)";
      if (el.type === "image") return "Imagen";
      return "Forma: " + el.shapeType;
    };

    // Mostramos primero el elemento más al frente (el último del array).
    const rows = [...App.elements].reverse();
    list.innerHTML = rows
      .map(
        (el) => `
      <div class="layer-row ${el.id === App.selectedId ? "layer-row--selected" : ""}" data-id="${el.id}">
        <span class="layer-label">${iconFor(el)} ${labelFor(el)}</span>
        <span class="layer-actions">
          <button type="button" data-action="front" title="Traer al frente">🔝</button>
          <button type="button" data-action="back" title="Enviar atrás">🔻</button>
          <button type="button" data-action="duplicate" title="Duplicar">⧉</button>
          <button type="button" data-action="delete" title="Eliminar">🗑️</button>
        </span>
      </div>`
      )
      .join("");

    if (!list.dataset.wired) {
      list.dataset.wired = "1";
      list.addEventListener("click", (e) => {
        const row = e.target.closest(".layer-row");
        if (!row) return;
        const id = row.dataset.id;
        const actionBtn = e.target.closest("[data-action]");

        if (actionBtn) {
          const action = actionBtn.dataset.action;
          if (action === "front") Elements.bringToFront(id);
          else if (action === "back") Elements.sendToBack(id);
          else if (action === "duplicate") Elements.duplicate(id);
          else if (action === "delete") Elements.delete(id);
          Render.draw();
          Panels.refreshLayers();
          Panels.refreshProperties();
          History.commit();
          return;
        }

        App.selectedId = id;
        Render.draw();
        Panels.refreshLayers();
        Panels.refreshProperties();
      });
    }
  },

  /* ---------- Propiedades ---------- */

  refreshProperties() {
    const container = document.getElementById("properties-container");
    const el = Elements.find(App.selectedId);

    if (!el) {
      container.innerHTML = `<p class="placeholder-note">Selecciona un elemento en el canvas o en "Capas" para ver y editar sus propiedades aquí.</p>`;
      return;
    }

    container.innerHTML = Panels.buildPropertiesHTML(el);
  },

  buildPropertiesHTML(el) {
    const row = (label, inputHtml) => `<label class="field-row"><span>${label}</span>${inputHtml}</label>`;
    const opt = (value, label, selected) =>
      `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;

    let html = "";

    if (el.type === "text") {
      html += row(
        "Contenido",
        `<textarea data-field="content" rows="2">${escapeHtml(el.content)}</textarea>`
      );
      html += row(
        "Fuente",
        `<select data-field="fontFamily">${FONT_OPTIONS.map((f) => opt(f, f, f === el.fontFamily)).join("")}</select>`
      );
      html += row("Tamaño", `<input type="range" min="8" max="200" data-field="fontSize" value="${el.fontSize}" />`);
      html += `<div class="field-row field-row--inline">
        <label><input type="checkbox" data-field="bold" ${el.bold ? "checked" : ""}/> Negrita</label>
        <label><input type="checkbox" data-field="italic" ${el.italic ? "checked" : ""}/> Cursiva</label>
      </div>`;
      html += row("Color", `<input type="color" data-field="color" value="${el.color}" />`);
      html += row(
        "Alineación",
        `<select data-field="align">
          ${opt("left", "Izquierda", el.align === "left")}
          ${opt("center", "Centro", el.align === "center")}
          ${opt("right", "Derecha", el.align === "right")}
        </select>`
      );
      html += row("Contorno (color)", `<input type="color" data-field="strokeColor" value="${el.strokeColor}" />`);
      html += row(
        "Grosor de contorno",
        `<input type="range" min="0" max="20" data-field="strokeWidth" value="${el.strokeWidth}" />`
      );
      html += row("Color de sombra", `<input type="color" data-field="shadowColor" value="${el.shadowColor}" />`);
      html += row(
        "Intensidad de sombra",
        `<input type="range" min="0" max="30" data-field="shadowBlur" value="${el.shadowBlur}" />`
      );
      html += row(
        "Espaciado entre letras",
        `<input type="range" min="-5" max="30" data-field="letterSpacing" value="${el.letterSpacing}" />`
      );

      html += `<div class="preset-row">
        ${Object.keys(TEXT_STYLE_PRESETS)
          .map((name) => `<button type="button" class="preset-btn" data-preset="${name}">${name}</button>`)
          .join("")}
      </div>`;
    }

    if (el.type === "shape") {
      html += row("Color de relleno", `<input type="color" data-field="fillColor" value="${el.fillColor}" />`);
      html += row("Color de contorno", `<input type="color" data-field="strokeColor" value="${el.strokeColor}" />`);
      html += row(
        "Grosor de contorno",
        `<input type="range" min="0" max="20" data-field="strokeWidth" value="${el.strokeWidth}" />`
      );
    }

    if (el.type === "image") {
      html += `<p class="placeholder-note">Arrastra la manija circular para rotar, y la manija cuadrada para escalar.</p>`;
      if (el.animatedGifId && App.gifCache[el.animatedGifId]) {
        const frameCount = App.gifCache[el.animatedGifId].frames.length;
        html += `<p class="hint">🎬 Esta imagen es un GIF animado (${frameCount} fotogramas). Se ve fija mientras editas, pero puedes exportar el resultado ya animado eligiendo "GIF animado" en Exportar.</p>`;
      }
      html += `<div class="save-template-box">
        <p class="panel-title save-template-title">Guardar como plantilla propia</p>
        ${row("Nombre", `<input type="text" id="template-name-input" placeholder="Ej. Mi foto de perfil" />`)}
        ${row("Descripción (opcional)", `<input type="text" id="template-desc-input" placeholder="Ej. Para reacciones" />`)}
        <button type="button" class="preset-btn" id="btn-save-as-template">💾 Guardar como plantilla</button>
        <p class="hint" id="save-template-status"></p>
      </div>`;
    }

    // Comunes a todos los tipos
    html += row(
      "Opacidad",
      `<input type="range" min="0" max="1" step="0.05" data-field="opacity" value="${el.opacity}" />`
    );
    html += row(
      "Rotación",
      `<input type="range" min="0" max="360" step="1" data-field="rotation" value="${Math.round(
        ((el.rotation % 360) + 360) % 360
      )}" />`
    );

    html += `<div class="preset-row">
      <button type="button" class="preset-btn" data-action="duplicate">⧉ Duplicar</button>
      <button type="button" class="preset-btn" data-action="delete">🗑️ Eliminar</button>
    </div>`;

    return html;
  },

  /**
   * Guarda la imagen actualmente seleccionada como una "plantilla
   * propia" en este navegador (localStorage), con nombre y
   * descripción. La volvemos a codificar como una imagen propia
   * (no una referencia externa) para que quede disponible sin
   * internet y nunca tenga problemas al exportar.
   */
  handleSaveAsTemplate() {
    const el = Elements.find(App.selectedId);
    const statusEl = document.getElementById("save-template-status");
    if (!el || el.type !== "image" || !statusEl) return;

    const nameInput = document.getElementById("template-name-input");
    const descInput = document.getElementById("template-desc-input");
    const name = nameInput.value.trim();

    if (!name) {
      statusEl.textContent = "Ponle un nombre a la plantilla antes de guardar.";
      return;
    }

    const img = App.imageCache[el.src];
    if (!img) {
      statusEl.textContent = "No se pudo leer esta imagen todavía, intenta de nuevo en un momento.";
      return;
    }

    try {
      const dataUrl = CustomTemplates.resizeToDataUrl(img, 500);
      const saved = CustomTemplates.add({ name, description: descInput.value.trim(), dataUrl });
      if (saved) {
        statusEl.textContent = "¡Guardada! Ya aparece en \"Mis plantillas\" dentro de la ventana de Plantillas.";
        nameInput.value = "";
        descInput.value = "";
        if (Panels.templatesOverlayOpen) Panels.renderOverlayGrid();
      } else {
        statusEl.textContent = "No se pudo guardar (puede que no quede espacio en el navegador).";
      }
    } catch (err) {
      console.warn("No se pudo guardar como plantilla:", err);
      statusEl.textContent = "Esta imagen viene de un sitio externo que no permite guardarla localmente.";
    }
  },

  setupPropertiesDelegation() {
    const container = document.getElementById("properties-container");

    const applyField = (target) => {
      const field = target.dataset.field;
      if (!field) return null;
      const el = Elements.find(App.selectedId);
      if (!el) return null;

      if (target.type === "checkbox") {
        el[field] = target.checked;
      } else if (target.type === "range" || target.type === "number") {
        el[field] = parseFloat(target.value);
      } else {
        el[field] = target.value;
      }
      return el;
    };

    container.addEventListener("input", (e) => {
      if (applyField(e.target)) Render.draw();
    });

    // "change" confirma el valor final (para guardarlo en el
    // historial de deshacer/rehacer). Volvemos a aplicar el campo
    // aquí también -no solo en "input"- porque algunos elementos
    // (como <select>) no disparan "input" en todos los navegadores.
    container.addEventListener("change", (e) => {
      if (!e.target.dataset.field) return;
      applyField(e.target);
      Render.draw();
      History.commit();
    });

    container.addEventListener("click", (e) => {
      if (e.target.id === "btn-save-as-template") {
        Panels.handleSaveAsTemplate();
        return;
      }

      const presetBtn = e.target.closest("[data-preset]");
      if (presetBtn) {
        const el = Elements.find(App.selectedId);
        if (!el) return;
        Object.assign(el, TEXT_STYLE_PRESETS[presetBtn.dataset.preset]);
        Render.draw();
        Panels.refreshProperties();
        History.commit();
        return;
      }

      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === "duplicate" && App.selectedId) {
          Elements.duplicate(App.selectedId);
        } else if (action === "delete") {
          Elements.deleteSelected();
          return; // deleteSelected ya redibuja/confirma
        }
        Render.draw();
        Panels.refreshLayers();
        Panels.refreshProperties();
        History.commit();
      }
    });
  },
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

window.Panels = Panels;
