/* Navigation et filtres mobiles. Inerte au-delà de 820px. */
(function () {
  var MQ = "(max-width: 820px)";
  function on() {
    try { return window.matchMedia(MQ).matches; } catch (e) { return false; }
  }
  window.ChartsMobile = { mq: MQ, on: on };

  var ICO = {
    classeur: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
    marche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16l-1.2 9.5a2 2 0 0 1-2 1.5H7.2a2 2 0 0 1-2-1.5L4 9z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/></svg>',
    arena: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9l8-5 8 5v10"/><path d="M9 19v-6h6v6"/></svg>'
  };

  function pageKey() {
    var p = (location.pathname.split("/").pop() || "").toLowerCase();
    if (p.indexOf("classeur") >= 0) return "classeur";
    if (p.indexOf("fantasy") >= 0) return "arena";
    if (p.indexOf("booster") >= 0 && location.hash === "#marche") return "marche";
    return "";
  }

  function tabHref(id) {
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
    nav.innerHTML = ["classeur", "marche", "arena"].map(function (id) {
      var onCls = cur === id ? " on" : "";
      var label = id === "classeur" ? "Classeur" : id === "marche" ? "Marché" : "Arena";
      return '<a class="mobile-tab' + onCls + '" data-tab="' + id + '" href="' + tabHref(id) + '">' +
        ICO[id] + "<span>" + label + "</span></a>";
    }).join("");
    document.body.appendChild(nav);
  }

  function setupFilters() {
    var filters = document.querySelector("main .filters, .wrap > .filters, section.filters");
    if (!filters || !document.getElementById("rareChips")) return;
    var searchRow = filters.querySelector(".filt-row:last-of-type") || filters.querySelector(".filt-row");
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
    filters.id = filters.id || "filtersPanel";
    if (!document.getElementById("mobileFiltDone")) {
      var done = document.createElement("button");
      done.type = "button";
      done.id = "mobileFiltDone";
      done.className = "mobile-only mobile-filt-done mobile-filt-toggle";
      done.textContent = "Voir les cartes";
      filters.appendChild(done);
    }
    var toggle = document.getElementById("mobileFiltToggle");
    var veilEl = document.getElementById("mobileFiltVeil");
    var doneBtn = document.getElementById("mobileFiltDone");
    function setOpen(open) {
      document.body.classList.toggle("filt-sheet-open", open);
      filters.classList.toggle("is-open", open);
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
  }
  window.addEventListener("hashchange", function () {
    var cur = pageKey();
    document.querySelectorAll(".mobile-tab").forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("data-tab") === cur);
    });
  });
  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
