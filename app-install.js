function showUpdateNotice(registration) {
  if (!registration?.waiting) return;

  let notice = document.querySelector("#appUpdateNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "appUpdateNotice";
    notice.className = "app-update-notice";
    notice.innerHTML = `
      <div><strong>Nueva versión disponible</strong><span>Actualiza para recibir las últimas mejoras.</span></div>
      <button type="button" id="appUpdateButton">Actualizar</button>
    `;
    document.body.appendChild(notice);
  }

  notice.classList.add("is-visible");
  notice.querySelector("#appUpdateButton")?.addEventListener("click", () => {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }, { once: true });
}

if ("serviceWorker" in navigator) {
  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");

      if (registration.waiting) {
        showUpdateNotice(registration);
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateNotice(registration);
          }
        });
      });

      registration.update().catch(() => {});
    } catch (error) {
      console.warn("No se pudo registrar el service worker", error);
    }
  });
}
