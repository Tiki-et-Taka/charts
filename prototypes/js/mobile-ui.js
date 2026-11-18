/* Navigation et filtres mobiles. Inerte au-delà de 820px. */
(function () {
  var MQ = "(max-width: 820px)";
  function on() {
    try { return window.matchMedia(MQ).matches; } catch (e) { return false; }
  }
  function syncTabbar() {
    if (!on()) {
      document.documentElement.style.removeProperty("--mobile-tabbar-h");
      return 0;
    }
    var bar = document.getElementById("mobileTabBar");
    if (!bar) return 0;
    var rect = bar.getBoundingClientRect();
    var h = Math.max(rect.height, window.innerHeight - rect.top);
    h = Math.ceil(h);
    document.documentElement.style.setProperty("--mobile-tabbar-h", h + "px");
    return h;
  }
  window.ChartsMobile = { mq: MQ, on: on, syncTabbar: syncTabbar };

  var ICO = {
    boosters: '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-16 9 13)"><rect x="4.5" y="5" width="10" height="14.5" rx="1.5"/></g><rect x="9.5" y="5" width="10" height="14.5" rx="1.5"/></svg>',
    classeur: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
    marche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16l-1.2 9.5a2 2 0 0 1-2 1.5H7.2a2 2 0 0 1-2-1.5L4 9z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/></svg>',
    arena: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="17.2" rx="8.5" ry="3.4"/><path d="M3.5 17.2V12c0-2.4 3.8-5.4 8.5-5.4s8.5 3 8.5 5.4v5.2"/><path d="M6 13.4c1.6-1.8 3.7-2.8 6-2.8s4.4 1 6 2.8"/><path d="M12 6.6V3.2M7.2 7.6 5.6 4.4M16.8 7.6l1.6-3.2"/></svg>'
  };
  var LABELS = { boosters: "Boosters", classeur: "Classeur", marche: "Marché", arena: "Arena" };
  var TABS = ["boosters", "classeur", "marche", "arena"];

  function pageKey() {
    var p = (location.pathname.split("/").pop() || "").toLowerCase();
    if (p.indexOf("classeur") >= 0) return "classeur";
    if (p.indexOf("fantasy") >= 0) return "arena";
    if (p.indexOf("lobby") >= 0) return "";
    if (p.indexOf("booster") >= 0 && location.hash === "#marche") return "marche";
    if (p.indexOf("booster") >= 0) return "boosters";
    return "";
  }

  function tabHref(id) {
    if (id === "boosters") return "booster.html?v=2";
    if (id === "classeur") return "classeur.html?v=2";
    if (id === "marche") return "booster.html?v=2#marche";
    return "fantasy.html?v=20";
  }

  function injectBar() {
    if (document.getElementById("mobileTabBar")) return;
    if (/connexion|legal/.test(location.pathname)) return;
    var cur = pageKey();
    var nav = document.createElement("nav");
    nav.id = "mobileTabBar";
    nav.className = "mobile-tabbar";
    nav.setAttribute("aria-label", "Navigation mobile");
    var tabs = TABS.map(function (id) {
      var onCls = cur === id ? " on" : "";
      return '<a class="mobile-tab' + onCls + '" data-tab="' + id + '" href="' + tabHref(id) + '">' +
        ICO[id] + "<span>" + LABELS[id] + "</span></a>";
    }).join("");
    nav.innerHTML =
      '<div class="mobile-tabs">' + tabs + "</div>" +
      '<nav class="mobile-legal" aria-label="Informations légales">' +
        '<a href="legal/regles.html">Règles</a>' +
        '<a href="legal/index.html?v=2">Mentions légales</a>' +
      "</nav>";
    document.body.appendChild(nav);
    var src = document.getElementById("packsBadge") || document.getElementById("packTileBadge");
    var boost = nav.querySelector('.mobile-tab[data-tab="boosters"]');
    if (src && boost && !src.hidden) {
      var badge = document.createElement("span");
      badge.className = "nav-badge";
      badge.textContent = src.textContent;
      boost.appendChild(badge);
    }
  }

  function setupFilters() {
    var filters = document.querySelector("main .filters, .wrap > .filters, section.filters");
    if (!filters || !document.getElementById("rareChips")) return;
    var sheet = document.getElementById("filtersPanel") || filters;
    var searchRow = filters.querySelector(".filt-row-search") || filters.querySelector(".filt-row");
    var search = document.getElementById("q");
    if (search && search.closest(".filt-row")) {
      search.closest(".filt-row").classList.add("filt-row-search");
      searchRow = search.closest(".filt-row");
    }
    if (!document.getElementById("mobileFiltToggle") && searchRow) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "mobileFiltToggle";
      btn.className = "mobile-only mobile-filt-toggle";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", "filtersPanel");
      btn.textContent = "Filtres";
      searchRow.appendChild(btn);
    }
    if (!document.getElementById("mobileFiltVeil")) {
      var veil = document.createElement("div");
      veil.id = "mobileFiltVeil";
      veil.className = "mobile-filt-veil";
      document.body.appendChild(veil);
    }
    if (!sheet.id) sheet.id = "filtersPanel";
    if (!document.getElementById("mobileFiltDone")) {
      var done = document.createElement("button");
      done.type = "button";
      done.id = "mobileFiltDone";
      done.className = "mobile-only mobile-filt-done mobile-filt-toggle";
      done.textContent = "Voir les cartes";
      sheet.appendChild(done);
    }
    var toggle = document.getElementById("mobileFiltToggle");
    var veilEl = document.getElementById("mobileFiltVeil");
    var doneBtn = document.getElementById("mobileFiltDone");
    function setOpen(open) {
      document.body.classList.toggle("filt-sheet-open", open);
      sheet.classList.toggle("is-open", open);
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (toggle && !toggle.dataset.bound) {
      toggle.dataset.bound = "1";
      toggle.addEventListener("click", function () {
        setOpen(document.body.classList.contains("filt-sheet-open") ? false : true);
      });
    }
    if (veilEl && !veilEl.dataset.bound) {
      veilEl.dataset.bound = "1";
      veilEl.addEventListener("click", function () { setOpen(false); });
    }
    if (doneBtn && !doneBtn.dataset.bound) {
      doneBtn.dataset.bound = "1";
      doneBtn.addEventListener("click", function () { setOpen(false); });
    }
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") setOpen(false);
    });
  }

  function init() {
    injectBar();
    setupFilters();
    syncTabbar();
  }
  window.addEventListener("hashchange", function () {
    var cur = pageKey();
    document.querySelectorAll(".mobile-tab").forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("data-tab") === cur);
    });
  });
  window.addEventListener("resize", syncTabbar);
  if (window.visualViewport) visualViewport.addEventListener("resize", syncTabbar);
  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
