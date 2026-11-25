/* Volet profil — même ouverture / fermeture sur tous les écrans. */
(function () {
  var STYLE_ID = "charts-drawer-css";
  var bound = false;
  var onOpen = null;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".drawer-veil{",
      "position:fixed !important;inset:0 !important;z-index:100 !important;",
      "background:rgba(0,0,0,.6) !important;",
      "opacity:0;pointer-events:none;",
      "transition:opacity .25s ease;",
      "}",
      ".drawer-veil.open{opacity:1 !important;pointer-events:auto !important;}",
      ".drawer{",
      "position:fixed !important;top:0 !important;right:0 !important;bottom:0 !important;",
      "z-index:101 !important;",
      "width:min(320px,88vw) !important;",
      "background:#101010 !important;",
      "border-left:1px solid #2a2a2a !important;",
      "padding:22px 20px !important;",
      "display:flex !important;flex-direction:column !important;gap:22px !important;",
      "overflow:auto !important;",
      "transform:translateX(100%) !important;",
      "transition:transform .28s cubic-bezier(.2,.8,.2,1) !important;",
      "}",
      ".drawer.open{transform:translateX(0) !important;}",
      ".drawer[hidden],.drawer-veil[hidden]{display:none !important;}",
      ".drawer .head{display:flex;align-items:center;justify-content:space-between;}",
      ".drawer .head h2,.drawer h2{",
      "margin:0;font-family:Oswald,sans-serif;font-weight:600;",
      "font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#f2f0eb;",
      "}",
      ".drawer .close{",
      "appearance:none;border:0;background:none;color:#8a8680;",
      "font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;",
      "}",
      ".drawer .close:hover{color:#f2f0eb;}",
      ".drawer .avatar-block{margin:0;}",
      ".drawer .avatar-pick{display:inline-flex;}",
      "@media (max-width:820px){.drawer{width:min(100vw,360px) !important;}}"
    ].join("");
    document.head.appendChild(style);
  }

  function els() {
    return {
      btn: document.getElementById("menuBtn"),
      drawer: document.getElementById("drawer"),
      veil: document.getElementById("drawerVeil"),
      close: document.getElementById("drawerClose")
    };
  }

  function isOpen() {
    var d = document.getElementById("drawer");
    return !!(d && d.classList.contains("open") && !d.hidden);
  }

  function setOpen(open) {
    ensureStyles();
    var e = els();
    if (!e.drawer || !e.veil) return;
    open = !!open;
    if (e.btn) e.btn.setAttribute("aria-expanded", open ? "true" : "false");

    if (open) {
      e.drawer.hidden = false;
      e.veil.hidden = false;
      // Force reflow so the slide transition runs after display:none → block.
      void e.drawer.offsetWidth;
      e.drawer.classList.add("open");
      e.veil.classList.add("open");
      if (typeof onOpen === "function") {
        try { onOpen(); } catch (err) {}
      }
      return;
    }

    e.drawer.classList.remove("open");
    e.veil.classList.remove("open");
    var done = false;
    function hide() {
      if (done) return;
      done = true;
      e.drawer.hidden = true;
      e.veil.hidden = true;
    }
    e.drawer.addEventListener("transitionend", hide, { once: true });
    setTimeout(hide, 320);
  }

  function toggle() {
    setOpen(!isOpen());
  }

  function bind(opts) {
    ensureStyles();
    if (opts && typeof opts.onOpen === "function") onOpen = opts.onOpen;
    var e = els();
    if (!e.btn || !e.drawer || !e.veil) return;
    // Start closed, regardless of leftover markup/classes.
    e.drawer.classList.remove("open");
    e.veil.classList.remove("open");
    e.drawer.hidden = true;
    e.veil.hidden = true;
    e.btn.setAttribute("aria-expanded", "false");
    if (bound) return;
    bound = true;
    e.btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      toggle();
    });
    if (e.close) e.close.addEventListener("click", function () { setOpen(false); });
    e.veil.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && isOpen()) setOpen(false);
    });
  }

  window.ChartsDrawer = { bind: bind, setOpen: setOpen, isOpen: isOpen, toggle: toggle };
})();
