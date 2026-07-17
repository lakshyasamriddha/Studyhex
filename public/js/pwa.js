// StudyReck PWA registration.
// Include this file with: <script src="/js/pwa.js" defer></script>

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}

// Capture the browser's install prompt so we can trigger it from our own
// button instead of waiting for the browser's default UI.
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;

  const installBtn = document.getElementById("install-app-btn");
  if (installBtn) {
    installBtn.hidden = false;
    installBtn.addEventListener("click", async () => {
      installBtn.hidden = true;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
    });
  }
});
