let deferredInstallPrompt = null;

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const getInstallButtons = () => Array.from(document.querySelectorAll("[data-install-app]"));

const updateInstallButtons = () => {
  getInstallButtons().forEach((button) => {
    button.hidden = isStandalone();
  });
};

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButtons();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallButtons();
});

const showManualInstallHelp = async () => {
  const isAppleDevice = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const text = isAppleDevice
    ? "En Safari toca Compartir y luego Agregar a pantalla de inicio."
    : "Abre el menu del navegador y elige Instalar app o Agregar a pantalla de inicio.";

  if (window.Swal) {
    await Swal.fire({ icon: "info", title: "Instalar en el dispositivo", text });
    return;
  }

  alert(text);
};

const handleInstallClick = async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallButtons();
    return;
  }

  await showManualInstallHelp();
};

document.addEventListener("DOMContentLoaded", () => {
  getInstallButtons().forEach((button) => {
    button.addEventListener("click", handleInstallClick);
  });

  updateInstallButtons();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
