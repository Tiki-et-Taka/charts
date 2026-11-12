/* Verrouillage du line-up Fantasy : lundi 00:00, début de la semaine de mesure. */
(function () {
  const DAYS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

  function next(from = new Date()) {
    const lock = new Date(from);
    const add = (8 - lock.getDay()) % 7 || 7;
    lock.setDate(lock.getDate() + add);
    lock.setHours(0, 0, 0, 0);
    return lock;
  }

  function label(lock = next()) {
    const hh = String(lock.getHours()).padStart(2, "0");
    const mm = String(lock.getMinutes()).padStart(2, "0");
    return `${DAYS[lock.getDay()]} ${hh}:${mm}`;
  }

  function remaining(lock = next()) {
    const ms = Math.max(0, lock - Date.now());
    return {
      d: Math.floor(ms / 86400000),
      h: Math.floor((ms % 86400000) / 3600000),
      m: Math.floor((ms % 3600000) / 60000)
    };
  }

  function remainingLabel(lock = next()) {
    const { d, h, m } = remaining(lock);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d)}j ${pad(h)}h ${pad(m)}m`;
  }

  function spanLabel(start, end) {
    const day = { day: "numeric", timeZone: "UTC" };
    const full = { day: "numeric", month: "short", timeZone: "UTC" };
    const sameMonth = start.getUTCMonth() === end.getUTCMonth();
    const from = start.toLocaleDateString("fr-FR", sameMonth ? day : full);
    return `du ${from} au ${end.toLocaleDateString("fr-FR", full)}`;
  }

  function competitionWeekLabel(lock = next()) {
    const start = new Date(Date.UTC(lock.getFullYear(), lock.getMonth(), lock.getDate()));
    const end = new Date(start.getTime() + 6 * 86400000);
    return spanLabel(start, end);
  }

  window.ChartsLock = { next, label, remaining, remainingLabel, spanLabel, competitionWeekLabel };
})();
