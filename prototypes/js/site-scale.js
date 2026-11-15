/* Force l’échelle UI globale sur <html> uniquement (évite le double zoom). */
(function () {
  var mobile = false;
  try {
    mobile = window.matchMedia("(max-width: 820px)").matches;
  } catch (e) {}
  if (mobile) {
    try { document.documentElement.style.zoom = "1"; } catch (e2) {}
    return;
  }
  var s = "0.82";
  try {
    document.documentElement.style.zoom = s;
  } catch (e) {}
})();
