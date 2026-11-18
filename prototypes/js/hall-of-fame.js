/* Hall of Fame local (cache de l’état serveur). */
(function () {
  var MAX = 8;

  function key(uid) {
    return "charts.s1." + uid + ".hall";
  }

  function empty() {
    return { size: 0, slots: [] };
  }

  function ownedMap(uid) {
    try {
      var data = JSON.parse(localStorage.getItem("charts.s1." + uid + ".owned") || "");
      var got = (data && data.got) || {};
      var out = {};
      Object.keys(got).forEach(function (id) {
        if (got[id] && (Number(got[id].n) || 0) > 0) out[id] = true;
      });
      return out;
    } catch (e) {
      return {};
    }
  }

  function read(uid) {
    try {
      var raw = JSON.parse(localStorage.getItem(key(uid)) || "");
      if (raw && typeof raw === "object") {
        var size = Math.max(0, Math.min(MAX, Number(raw.size) || 0));
        var slots = Array.isArray(raw.slots) ? raw.slots.map(function (id) { return id ? String(id) : ""; }) : [];
        while (slots.length < size) slots.push("");
        if (slots.length > size) slots = slots.slice(0, size);
        return { size: size, slots: slots };
      }
    } catch (e) {}
    return empty();
  }

  function write(uid, hall) {
    if (!uid) return;
    localStorage.setItem(key(uid), JSON.stringify(hall && hall.size ? hall : empty()));
  }

  function sanitize(uid, hall) {
    hall = hall || empty();
    if (!hall.size) return empty();
    var have = ownedMap(uid);
    var filled = (hall.slots || []).filter(Boolean);
    if (filled.some(function (id) { return !have[id]; })) return empty();
    return hall;
  }

  function load(uid) {
    var clean = sanitize(uid, read(uid));
    write(uid, clean);
    return clean;
  }

  function reconcile(uid) {
    return load(uid);
  }

  window.ChartsHall = { MAX: MAX, empty: empty, load: load, write: write, reconcile: reconcile };
})();
