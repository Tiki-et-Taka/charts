/* Score Fantasy : signal de l'artiste / médiane du poste.
   Méthode « wikipedia » (beta, par défaut) ou « musicbrainz » (?method=musicbrainz).
   load() charge la dernière semaine (score indicatif) ; loadWeek(lundi) charge
   une semaine archivée (score final). */
(function () {
  const SLOT_MEDIAN = {
    voix: "voix",
    ryt1: "rythme",
    ryt2: "rythme",
    melo1: "melodie",
    melo2: "melodie"
  };

  const METHODS = {
    wikipedia: { file: "../data/census/pageviews_week.json", archive: "../data/census/pageviews_weeks/" },
    musicbrainz: { file: "../data/census/listens_week.json", archive: null }
  };

  function pickMethod() {
    const asked = new URLSearchParams(location.search).get("method");
    return METHODS[asked] ? asked : "wikipedia";
  }

  const methodName = pickMethod();
  let doc = null;
  const weeks = new Map();

  function valueOf(week, qid) {
    if (!week || !qid) return 0;
    return Number(week.by_qid && week.by_qid[qid]) || 0;
  }

  function hotIn(week, qid) {
    return !!(week && week.detail && week.detail[qid] && week.detail[qid].hot);
  }

  function scoreWith(week, slots, byId, options) {
    const rhythmPenalty = !!(options && options.rhythmPenalty);
    const genreBonus = Number(options && options.genreBonus) || 0;
    const bonus = Number(week && week.rules && week.rules.hot_bonus) || 0;
    const parts = {};
    let sum = 0;
    for (const key of Object.keys(SLOT_MEDIAN)) {
      const card = slots && slots[key] ? byId.get(slots[key]) : null;
      const listens = card ? valueOf(week, card.qid) : 0;
      const hot = card ? hotIn(week, card.qid) : false;
      const median = Number(week && week.medians && week.medians[SLOT_MEDIAN[key]]) || 0;
      let form = median > 0 ? listens / median : 0;
      if (hot) form *= 1 + bonus;
      if (key === "ryt2" && rhythmPenalty) form *= 0.5;
      parts[key] = { listens, form, hot };
      sum += form;
    }
    return {
      sum,
      total: sum * (1 + genreBonus / 100),
      parts,
      rangeLabel: rangeOf(week)
    };
  }

  /* Alchimie de groupe : bonus de genre et malus de doublon rythmique. */
  function alchemy(slots, byId) {
    const cards = Object.keys(SLOT_MEDIAN).map(key => slots && slots[key] && byId.get(slots[key])).filter(Boolean);
    let genreBonus = 0;
    if (cards.length) {
      const counts = {};
      for (const card of cards) counts[card.famille] = (counts[card.famille] || 0) + 1;
      const max = Math.max(...Object.values(counts));
      if (max >= 5) genreBonus = 15;
      else if (max >= 4) genreBonus = 10;
      else if (max >= 3) genreBonus = 5;
    }
    const rhythmKey = card => {
      const ins = card.instruments || [card.instrument];
      if (ins.includes("basse")) return "basse";
      if (ins.includes("batterie")) return "batterie";
      if (ins.includes("machines")) return "machines";
      return ins[0] || "";
    };
    const r1 = slots && slots.ryt1 && byId.get(slots.ryt1);
    const r2 = slots && slots.ryt2 && byId.get(slots.ryt2);
    return {
      genreBonus,
      rhythmPenalty: !!(r1 && r2 && rhythmKey(r1) === rhythmKey(r2))
    };
  }

  function scoreLineup(slots, byId, options) {
    return scoreWith(doc, slots, byId, options);
  }

  function rangeOf(week) {
    if (!week || !week.from_ts || !week.to_ts) return "semaine dernière";
    const from = new Date(week.from_ts * 1000);
    const to = new Date(week.to_ts * 1000);
    const sameMonth = from.getUTCMonth() === to.getUTCMonth();
    const opt = { day: "numeric", month: "short", timeZone: "UTC" };
    const fromText = from.toLocaleDateString("fr-FR", sameMonth ? { day: "numeric", timeZone: "UTC" } : opt);
    return `du ${fromText} au ${to.toLocaleDateString("fr-FR", opt)}`;
  }

  function formatForm(n) {
    return `${(Number(n) || 0).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })} pts`;
  }

  function formatScore(n) {
    return (Number(n) || 0).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  async function load() {
    const res = await fetch(METHODS[methodName].file, { cache: "no-store" });
    if (!res.ok) throw new Error(methodName);
    doc = await res.json();
    return doc;
  }

  async function loadWeek(monday) {
    const dir = METHODS[methodName].archive;
    if (!dir || !monday) return null;
    if (!weeks.has(monday)) {
      weeks.set(monday, fetch(`${dir}${monday}.json`, { cache: "no-store" })
        .then(res => (res.ok ? res.json() : null))
        .catch(() => null));
    }
    return weeks.get(monday);
  }

  window.ChartsListens = {
    load,
    loadWeek,
    listensOf: qid => valueOf(doc, qid),
    isHot: qid => hotIn(doc, qid),
    scoreLineup,
    scoreWith,
    alchemy,
    rangeOf,
    formatForm,
    formatScore,
    method: () => (doc && doc.method) || methodName,
    ready: () => !!doc
  };
})();
