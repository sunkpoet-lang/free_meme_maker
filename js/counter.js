/* =========================================================
   MEME MAKER — counter.js
   ---------------------------------------------------------
   Cuenta cuántos memes se han descargado en total y lo muestra en
   el encabezado. Intenta llevar un contador GLOBAL (compartido por
   todos los que usan el sitio, en cualquier navegador o
   computadora) usando countapi.xyz, un servicio externo gratuito
   que no requiere cuenta ni llave.

   Como es un servicio de terceros fuera de nuestro control, puede
   fallar (sin internet, bloqueado, caído, o al abrir el archivo
   localmente con file:// -que no puede pedir datos a otro sitio-).
   Por eso SIEMPRE se lleva también una cuenta local (localStorage,
   como antes) de respaldo: si el servicio global no responde, el
   contador simplemente sigue funcionando con el número local, sin
   romper nada ni mostrar errores al usuario.
   ========================================================= */

const MemeCounter = {
  STORAGE_KEY: "memeStudioCreatedCount",
  API_BASE: "https://api.countapi.xyz",
  NAMESPACE: "sunkpoet-meme-studio",
  KEY: "memes-creados",

  /* ---------- Respaldo local (localStorage) ---------- */

  localGet() {
    try {
      const raw = localStorage.getItem(MemeCounter.STORAGE_KEY);
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch (err) {
      // localStorage puede no estar disponible (modo privado, etc.).
      return 0;
    }
  },

  localSet(n) {
    try {
      localStorage.setItem(MemeCounter.STORAGE_KEY, String(n));
    } catch (err) {
      // Sin localStorage el respaldo no persiste, pero no rompe nada.
    }
  },

  render(value) {
    const el = document.getElementById("meme-counter-value");
    if (el) el.textContent = value;
  },

  /**
   * Al cargar la página: mostramos de una vez el número local (no
   * hay que esperar a la red para eso), y en paralelo consultamos
   * el contador global -SOLO para leerlo, sin sumarle nada- y lo
   * mostramos en cuanto responda.
   */
  async setup() {
    MemeCounter.render(MemeCounter.localGet());
    try {
      const res = await fetch(`${MemeCounter.API_BASE}/get/${MemeCounter.NAMESPACE}/${MemeCounter.KEY}`);
      if (!res.ok) throw new Error("Respuesta no válida del contador global");
      const data = await res.json();
      if (typeof data.value === "number") MemeCounter.render(data.value);
    } catch (err) {
      console.warn("No se pudo leer el contador global, se muestra el contador local:", err);
    }
  },

  /**
   * Se llama cada vez que se exporta un meme con éxito. Intenta
   * sumar 1 al contador global; si falla, cae de vuelta al local.
   */
  async increment() {
    const nextLocal = MemeCounter.localGet() + 1;
    MemeCounter.localSet(nextLocal);

    try {
      const res = await fetch(`${MemeCounter.API_BASE}/hit/${MemeCounter.NAMESPACE}/${MemeCounter.KEY}`);
      if (!res.ok) throw new Error("Respuesta no válida del contador global");
      const data = await res.json();
      if (typeof data.value === "number") {
        MemeCounter.render(data.value);
        return data.value;
      }
    } catch (err) {
      console.warn("No se pudo actualizar el contador global, se muestra el contador local:", err);
    }
    MemeCounter.render(nextLocal);
    return nextLocal;
  },
};

window.MemeCounter = MemeCounter;
