/* Lien « retour » des pages /legal : dernier écran de l’appli, conservé
   d’un onglet légal à l’autre. */
(function () {
  var KEY = "charts.legal.return";
  var onLegal = /\/legal\//.test(location.pathname);

  function safeAppUrl(href) {
    try {
      var u = new URL(href, location.href);
      if (u.origin !== location.origin) return null;
      if (!/\/prototypes\/[^/]+\.html$/.test(u.pathname)) return null;
      if (/\/legal\//.test(u.pathname)) return null;
      return u.href;
    } catch (e) {
      return null;
    }
  }

  if (!onLegal) {
    document.addEventListener("click", function (ev) {
      var node = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
      if (!node) return;
      var href = node.getAttribute("href") || "";
      if (href.indexOf("legal/") === -1) return;
      try { sessionStorage.setItem(KEY, location.href); } catch (e) {}
    }, true);
    return;
  }

  function sameDoc(a, b) {
    var ua = new URL(a);
    var ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname === ub.pathname && ua.search === ub.search;
  }

  function label(href) {
    var u = new URL(href);
    var file = u.pathname.split("/").pop();
    if (file === "booster.html" && u.hash === "#marche") return "← Marché";
    if (file === "fantasy-lineup.html") return "← Retour au line-up";
    var names = {
      "lobby.html": "Lobby",
      "booster.html": "Booster",
      "classeur.html": "Classeur",
      "fantasy.html": "Arena"
    };
    return "← " + (names[file] || "Retour");
  }

  function apply() {
    var link = document.getElementById("backLink");
    if (!link) return;
    var saved = null;
    try { saved = safeAppUrl(sessionStorage.getItem(KEY)); } catch (e) {}
    var ref = safeAppUrl(document.referrer);
    var target = null;
    if (ref && saved && sameDoc(saved, ref)) target = saved;
    else if (ref) target = ref;
    else if (saved) target = saved;
    else target = new URL("../lobby.html", location.href).href;
    if (ref) {
      try { sessionStorage.setItem(KEY, target); } catch (e) {}
    }
    link.href = target;
    link.textContent = label(target);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
