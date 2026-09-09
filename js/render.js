/* =========================================================
   MEME MAKER — render.js
   ---------------------------------------------------------
   Todo lo relacionado con DIBUJAR en el canvas: el fondo, cada
   elemento, y la interfaz de selección (recuadro + manijas de
   redimensionar/rotar). También el "hit-testing" (saber si un
   punto del mouse cae dentro de un elemento).
   ========================================================= */

const HANDLE_SIZE = 14;
const ROTATE_HANDLE_OFFSET = 34;

const Render = {
  /**
   * Vuelve a dibujar todo el canvas desde cero.
   * @param {boolean} showSelection - si se debe dibujar el recuadro
   *   de selección y las manijas. Se pone en "false" al exportar,
   *   para que el archivo descargado no incluya esa interfaz.
   */
  draw(showSelection = true) {
    const { ctx, canvas } = App;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = App.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (App.elements.length === 0) {
      Render.drawEmptyHint(ctx, canvas.width, canvas.height);
    }

    for (const el of App.elements) {
      Render.drawElement(el);
    }

    if (showSelection && App.selectedId) {
      const el = Elements.find(App.selectedId);
      if (el) Render.drawSelectionUI(el);
    }
  },

  drawEmptyHint(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = "#4b4d57";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.strokeRect(20, 20, width - 40, height - 40);
    ctx.setLineDash([]);

    ctx.fillStyle = "#c7c9d1";
    ctx.font = "600 26px -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Arrastra una imagen aquí", width / 2, height / 2 - 20);

    ctx.fillStyle = "#9a9ca6";
    ctx.font = "400 17px -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    ctx.fillText("o pégala con Ctrl+V, o usa las herramientas de la izquierda", width / 2, height / 2 + 16);
    ctx.restore();
  },

  drawElement(el) {
    const { ctx } = App;
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;
    ctx.translate(el.x, el.y);
    ctx.rotate(((el.rotation || 0) * Math.PI) / 180);

    if (el.type === "image") {
      Render.drawImageElement(el);
    } else if (el.type === "text") {
      Render.drawTextElement(el);
    } else if (el.type === "shape") {
      Render.drawShapeElement(el);
    }

    ctx.restore();
  },

  drawImageElement(el) {
    const { ctx } = App;
    const img = App.imageCache[el.src];
    if (!img) return;
    ctx.drawImage(img, -el.width / 2, -el.height / 2, el.width, el.height);
  },

  drawTextElement(el) {
    const { ctx } = App;
    const lines = String(el.content || "").split("\n");
    const weight = el.bold ? "700" : "400";
    const style = el.italic ? "italic" : "normal";
    ctx.font = `${style} ${weight} ${el.fontSize}px "${el.fontFamily}"`;
    ctx.textAlign = el.align || "center";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) {
      ctx.letterSpacing = `${el.letterSpacing || 0}px`;
    }

    const lineHeight = el.fontSize * 1.15;
    const totalHeight = lineHeight * lines.length;
    const startY = -totalHeight / 2 + lineHeight / 2;

    let anchorX = 0;
    if (el.align === "left") anchorX = -Render.measureTextElement(el).width / 2;
    if (el.align === "right") anchorX = Render.measureTextElement(el).width / 2;

    lines.forEach((line, i) => {
      const ly = startY + i * lineHeight;

      ctx.shadowBlur = 0;

      if (el.strokeWidth > 0) {
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeStyle = el.strokeColor || "#000000";
        ctx.lineWidth = el.strokeWidth;
        ctx.strokeText(line, anchorX, ly);
      }

      // La sombra solo se aplica al relleno, para que no se vea
      // duplicada/borrosa sobre el contorno.
      if (el.shadowBlur > 0) {
        ctx.shadowColor = el.shadowColor || "#000000";
        ctx.shadowBlur = el.shadowBlur;
      }
      ctx.fillStyle = el.color || "#ffffff";
      ctx.fillText(line, anchorX, ly);
      ctx.shadowBlur = 0;
    });

    if ("letterSpacing" in ctx) {
      ctx.letterSpacing = "0px";
    }
  },

  drawShapeElement(el) {
    const { ctx } = App;
    const w = el.width;
    const h = el.height;

    ctx.fillStyle = el.fillColor || "#6c5ce7";
    ctx.strokeStyle = el.strokeColor || "#ffffff";
    ctx.lineWidth = el.strokeWidth || 0;

    if (el.shapeType === "rect") {
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      if (ctx.lineWidth > 0) ctx.stroke();
    } else if (el.shapeType === "circle") {
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (ctx.lineWidth > 0) ctx.stroke();
    } else if (el.shapeType === "line") {
      ctx.strokeStyle = el.fillColor || "#6c5ce7";
      ctx.lineWidth = Math.max(4, el.strokeWidth || 6);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.stroke();
    } else if (el.shapeType === "arrow") {
      ctx.strokeStyle = el.fillColor || "#6c5ce7";
      ctx.fillStyle = el.fillColor || "#6c5ce7";
      ctx.lineWidth = Math.max(4, el.strokeWidth || 6);
      ctx.lineCap = "round";
      const x1 = -w / 2, y1 = -h / 2, x2 = w / 2, y2 = h / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = Math.max(14, Math.min(w, h) * 0.25);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  },

  /**
   * Calcula el ancho/alto aproximado de un elemento de texto
   * midiendo la línea más larga. Se usa tanto para dibujar como
   * para el recuadro de selección y el hit-testing.
   */
  measureTextElement(el) {
    const { ctx } = App;
    ctx.save();
    const weight = el.bold ? "700" : "400";
    const style = el.italic ? "italic" : "normal";
    ctx.font = `${style} ${weight} ${el.fontSize}px "${el.fontFamily}"`;
    const lines = String(el.content || "").split("\n");
    let maxWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    }
    ctx.restore();
    const lineHeight = el.fontSize * 1.15;
    return {
      width: Math.max(20, maxWidth),
      height: Math.max(20, lineHeight * lines.length),
    };
  },

  getBoundingBox(el) {
    if (el.type === "text") {
      return Render.measureTextElement(el);
    }
    return { width: el.width, height: el.height };
  },

  /** Convierte un punto del mundo a coordenadas locales (sin rotación) del elemento. */
  toLocal(px, py, el) {
    const rad = (-(el.rotation || 0) * Math.PI) / 180;
    const dx = px - el.x;
    const dy = py - el.y;
    return {
      x: dx * Math.cos(rad) - dy * Math.sin(rad),
      y: dx * Math.sin(rad) + dy * Math.cos(rad),
    };
  },

  /** Convierte un punto local (relativo al centro del elemento) a coordenadas del mundo. */
  toWorld(lx, ly, el) {
    const rad = ((el.rotation || 0) * Math.PI) / 180;
    return {
      x: el.x + lx * Math.cos(rad) - ly * Math.sin(rad),
      y: el.y + lx * Math.sin(rad) + ly * Math.cos(rad),
    };
  },

  pointInBox(px, py, el, box) {
    const local = Render.toLocal(px, py, el);
    return Math.abs(local.x) <= box.width / 2 && Math.abs(local.y) <= box.height / 2;
  },

  /** Devuelve "resize", "rotate" o null si (px,py) cae sobre una manija del elemento. */
  hitTestHandles(px, py, el) {
    const box = Render.getBoundingBox(el);
    const local = Render.toLocal(px, py, el);

    const resizeLocal = { x: box.width / 2, y: box.height / 2 };
    if (Math.hypot(local.x - resizeLocal.x, local.y - resizeLocal.y) <= HANDLE_SIZE) {
      return "resize";
    }

    const rotateLocal = { x: 0, y: -box.height / 2 - ROTATE_HANDLE_OFFSET };
    if (Math.hypot(local.x - rotateLocal.x, local.y - rotateLocal.y) <= HANDLE_SIZE) {
      return "rotate";
    }

    return null;
  },

  drawSelectionUI(el) {
    const { ctx } = App;
    const box = Render.getBoundingBox(el);

    ctx.save();
    ctx.translate(el.x, el.y);
    ctx.rotate(((el.rotation || 0) * Math.PI) / 180);

    // Recuadro punteado
    ctx.strokeStyle = "#6c5ce7";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);
    ctx.setLineDash([]);

    // Línea hacia la manija de rotación
    ctx.beginPath();
    ctx.moveTo(0, -box.height / 2);
    ctx.lineTo(0, -box.height / 2 - ROTATE_HANDLE_OFFSET);
    ctx.stroke();

    // Manija de rotación (círculo arriba)
    Render.drawHandle(0, -box.height / 2 - ROTATE_HANDLE_OFFSET, "circle");

    // Manija de redimensionar (cuadrado en la esquina inferior derecha)
    Render.drawHandle(box.width / 2, box.height / 2, "square");

    ctx.restore();
  },

  drawHandle(x, y, shape) {
    const { ctx } = App;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#6c5ce7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape === "circle") {
      ctx.arc(x, y, HANDLE_SIZE / 2, 0, Math.PI * 2);
    } else {
      ctx.rect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }
    ctx.fill();
    ctx.stroke();
  },
};

window.Render = Render;
