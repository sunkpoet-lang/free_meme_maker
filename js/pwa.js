/* =========================================================
   MEME MAKER — pwa.js
   ---------------------------------------------------------
   Registra el service worker (ver sw.js) para que la app
   funcione como PWA instalable (ícono propio, abre sin la
   barra del navegador, sigue abriendo sin internet una vez
   que ya se visitó), y maneja el botón "Instalar app" que
   aparece cuando el navegador ofrece esa opción.
   ========================================================= */

(function () {
  // El registro falla solo (con .catch) si el sitio se abre desde
  // file:// o el navegador no soporta service workers -no hace falta
  // avisarle nada al usuario: la app sigue funcionando exactamente
  // igual, nomás sin modo sin conexión-.
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.protocol === "http:")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  let deferredInstallPrompt = null;
  const installBtn = document.getElementById("btn-install-pwa");

  // Chrome/Edge/Android disparan este evento cuando la app cumple los
  // requisitos para instalarse (manifest + service worker + https).
  // Lo interceptamos para mostrar nuestro propio botón, más visible
  // que el ícono chiquito de la barra de direcciones.
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installBtn) installBtn.hidden = false;
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      installBtn.hidden = true;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
    });
  }

  // iOS/Safari no dispara "beforeinstallprompt" (no tiene ese
  // mecanismo): ahí instalar es "Compartir → Agregar a inicio". Si
  // detectamos Safari en iPhone/iPad y todavía no está instalada,
  // mostramos el mismo botón pero con un mensaje explicando el paso
  // manual en vez de un prompt automático.
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  if (isIos && !isStandalone && installBtn) {
    installBtn.hidden = false;
    installBtn.addEventListener("click", () => {
      if (deferredInstallPrompt) return; // ya lo maneja el listener de arriba
      alert('Para instalar Meme Studio: tocá el botón "Compartir" de Safari y elegí "Agregar a pantalla de inicio".');
    });
  }

  window.addEventListener("appinstalled", () => {
    if (installBtn) installBtn.hidden = true;
    deferredInstallPrompt = null;
  });
})();
