/**
 * winvars.js — Captura window._sharedData do Instagram
 * Versão melhorada com IIFE e error handling
 * Compatível com Organic
 */
(function () {
  var iters = 0;
  function waitForSharedData() {
    iters++;
    if (window._sharedData) {
      try {
        localStorage.setItem("winvars", JSON.stringify(window._sharedData));
      } catch (e) {
        // Possível erro de quota ou dados circulares
      }
    } else if (iters < 200) {
      setTimeout(waitForSharedData, 50);
    }
  }
  waitForSharedData();
})();
