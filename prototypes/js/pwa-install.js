/* Raccourci écran d’accueil — mobile uniquement. */
(function () {
  var KEY = "charts.pwa.icon";
  var deferred = null;
  var asked = false;
  var dlg = null;

  function mobile() {
    try {
      if (window.ChartsMobile && typeof ChartsMobile.on === "function") return ChartsMobile.on();
    } catch (e) {}
    try { return window.matchMedia("(max-width: 820px)").matches; } catch (e) { return false; }
  }
  function standalone() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    } catch (e) {}
    return navigator.standalone === true;
  }
  function stored() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }
  function store(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
  function ios() {
    var ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  }
  function inAppBrowser() {
    return /FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp|Snapchat/i.test(navigator.userAgent || "");
  }
  function alreadyDone() {
    var v = stored();
    return v === "installed" || v === "dismissed";
  }

  function ensureHead() {
    if (!document.querySelector('link[rel="manifest"]')) {
      var man = document.createElement("link");
      man.rel = "manifest";
      man.href = "manifest.json";
      document.head.appendChild(man);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      var apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      apple.href = "img/apple-touch-icon.png";
      document.head.appendChild(apple);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      var cap = document.createElement("meta");
      cap.name = "apple-mobile-web-app-capable";
      cap.content = "yes";
      document.head.appendChild(cap);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
      var title = document.createElement("meta");
      title.name = "apple-mobile-web-app-title";
      title.content = "Charts";
      document.head.appendChild(title);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      var theme = document.createElement("meta");
      theme.name = "theme-color";
      theme.content = "#0d0d0d";
      document.head.appendChild(theme);
    }
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  function otherDialogOpen() {
    return !!document.querySelector("dialog[open]");
  }

  function hide() {
    if (dlg && dlg.open) dlg.close();
  }

  function iosHelp() {
    if (!dlg) return;
    dlg.innerHTML =
      '<p id="pwaInstallTitle">Presque !</p>' +
      '<p class="pwa-install-sub">Touche <b>Partager</b>, puis <b>Sur l’écran d’accueil</b>. L’icône Charts s’installe dans tes applications.</p>' +
      '<div class="pwa-install-actions">' +
        '<button type="button" data-pwa="ok">Compris</button>' +
      "</div>";
  }

  function onYes() {
    if (deferred && typeof deferred.prompt === "function") {
      var ev = deferred;
      deferred = null;
      ev.prompt();
      Promise.resolve(ev.userChoice).then(function (choice) {
        store(choice && choice.outcome === "accepted" ? "installed" : "dismissed");
        hide();
      }).catch(function () {
        store("dismissed");
        hide();
      });
      return;
    }
    if (ios()) {
      store("installed");
      iosHelp();
      return;
    }
    store("dismissed");
    hide();
  }

  function onNo() {
    store("dismissed");
    hide();
  }

  function build() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "pwaInstall";
    dlg.className = "pwa-install";
    dlg.setAttribute("aria-labelledby", "pwaInstallTitle");
    dlg.innerHTML =
      '<img class="pwa-install-icon" src="img/pwa-192.png" alt="">' +
      '<p id="pwaInstallTitle">Ajouter Charts sur ton téléphone ?</p>' +
      '<p class="pwa-install-sub">Une icône Charts s’installe dans tes applications. Un tap ouvre l’app.</p>' +
      '<div class="pwa-install-actions">' +
        '<button type="button" data-pwa="yes">Oui</button>' +
        '<button type="button" data-pwa="no">Non</button>' +
      "</div>";
    dlg.addEventListener("cancel", function (ev) { ev.preventDefault(); });
    dlg.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-pwa]");
      if (!btn) return;
      var act = btn.getAttribute("data-pwa");
      if (act === "yes") onYes();
      else if (act === "ok") hide();
      else if (act === "no") onNo();
    });
    document.body.appendChild(dlg);
    return dlg;
  }

  function show() {
    if (asked || !mobile() || alreadyDone() || standalone() || inAppBrowser()) return;
    if (!(deferred || ios())) return;
    if (otherDialogOpen()) return;
    asked = true;
    build();
    if (!dlg.open) dlg.showModal();
  }

  function schedule() {
    if (asked || !mobile() || alreadyDone() || standalone() || inAppBrowser()) return;
    if (!(deferred || ios())) return;
    var tries = 0;
    function tick() {
      if (asked || alreadyDone()) return;
      if (!otherDialogOpen()) {
        show();
        return;
      }
      tries += 1;
      if (tries < 80) setTimeout(tick, 400);
    }
    setTimeout(tick, 600);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    schedule();
  });
  window.addEventListener("appinstalled", function () {
    store("installed");
    asked = true;
    hide();
  });

  ensureHead();
  registerSW();

  if (standalone()) {
    store("installed");
    return;
  }
  if (!mobile() || alreadyDone() || inAppBrowser()) return;

  if (ios()) schedule();
  else setTimeout(function () { if (deferred) schedule(); }, 1800);
})();
