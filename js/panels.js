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

const Panels = {
  setup() {
    Panels.setupToolbar();
    Panels.setupImageTool();
    Panels.setupTextTool();
    Panels.setupStickers();
    Panels.setupShapes();
    Panels.setupTemplates();
    Panels.setupBackground();
    Panels.setupCanvasSize();
    Panels.setupPropertiesDelegation();

    Panels.refreshLayers();
    Panels.refreshProperties();
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
  },

  /* ---------- Herramienta: texto ---------- */

  setupTextTool() {
    document.getElementById("btn-add-text").addEventListener("click", () => {
      Elements.addText({});
      Render.draw();
      Panels.refreshLayers();
      Panels.refreshProperties();
      History.commit();
    });
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

  /* ---------- Herramienta: plantillas ---------- */

  setupTemplates() {
    const grid = document.getElementById("template-grid");
    grid.innerHTML = TEMPLATES.map(
      (t, i) => `
      <button type="button" class="template-btn" data-index="${i}">
        <img src="${generateTemplateDataURL(t, 120, 80)}" alt="${t.name}" />
        <span>${t.category}</span>
      </button>`
    ).join("");

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".template-btn");
      if (!btn) return;
      const template = TEMPLATES[Number(btn.dataset.index)];
      Panels.applyTemplate(template);
    });
  },

  applyTemplate(template) {
    const dataUrl = generateTemplateDataURL(template, App.canvas.width, App.canvas.height);
    const img = new Image();
    img.onload = () => {
      App.imageCache[dataUrl] = img;
      const el = Elements.addImage({ src: dataUrl, width: App.canvas.width, height: App.canvas.height });
      Elements.sendToBack(el.id);
      App.selectedId = null;
      Render.draw();
      Panels.refreshLayers();
      Panels.refreshProperties();
      History.commit();
    };
    img.src = dataUrl;
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

  applyCanvasSize(w, h) {
    App.canvas.width = w;
    App.canvas.height = h;
    document.getElementById("canvas-size-label").textContent = `${w} × ${h} px`;
    Render.draw();
    History.commit();
  },

  /* ---------- Capas ---------- */

  refreshLayers() {
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
