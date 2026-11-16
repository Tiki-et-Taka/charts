/* Historique Fantasy : un line-up validé vaut pour la semaine de compétition
   qui commence au verrouillage suivant (lundi 00:00). Dès que cette semaine a
   commencé, il passe dans l'historique du joueur et le line-up de la semaine
   suivante repart vide (Créer ton lineup). */
(function () {
  const COMP_ID = "all-stars-5";

  function lineupKey(userId) { return `charts.s1.${userId}.lineup`; }
  function historyKey(userId) { return `charts.s1.${userId}.fantasyHistory`; }

  function isoDate(d) {
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function startOf(weekStart) {
    const [y, m, d] = weekStart.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function list(userId) {
    const items = read(historyKey(userId), []);
    return Array.isArray(items) ? items : [];
  }

  function nextWeekStart() {
    return isoDate(window.ChartsLock.next());
  }

  function rollover(userId, now = new Date()) {
    if (window.ChartsState) return false;
    if (!userId) return false;
    const lineup = read(lineupKey(userId), null);
    if (!lineup || !lineup.locked || !lineup.slots) return false;
    if (!lineup.weekStart) {
      lineup.weekStart = nextWeekStart();
      localStorage.setItem(lineupKey(userId), JSON.stringify(lineup));
      return false;
    }
    if (now < startOf(lineup.weekStart)) return false;
    const history = list(userId);
    if (!history.some(item => item.weekStart === lineup.weekStart && item.compId === COMP_ID)) {
      history.push({ compId: COMP_ID, weekStart: lineup.weekStart, slots: { ...lineup.slots } });
      history.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
      localStorage.setItem(historyKey(userId), JSON.stringify(history));
    }
    lineup.locked = false;
    lineup.slots = { voix: null, ryt1: null, ryt2: null, melo1: null, melo2: null };
    delete lineup.weekStart;
    localStorage.setItem(lineupKey(userId), JSON.stringify(lineup));
    return true;
  }

  function weekEnd(weekStart) {
    const end = startOf(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }

  function resultDate(weekStart) {
    const day = startOf(weekStart);
    day.setDate(day.getDate() + 8);
    return day;
  }

  function weekLabel(weekStart) {
    const [y, m, d] = weekStart.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(start.getTime() + 6 * 86400000);
    return window.ChartsLock.spanLabel(start, end);
  }

  function isOngoing(entry, now = new Date()) {
    const start = startOf(entry.weekStart);
    const stop = new Date(start);
    stop.setDate(stop.getDate() + 7);
    return now >= start && now < stop;
  }

  function ongoing(userId, now = new Date()) {
    return list(userId).filter(entry => isOngoing(entry, now));
  }

  function finished(userId, now = new Date()) {
    return list(userId).filter(entry => now >= startOf(entry.weekStart) && !isOngoing(entry, now));
  }

  function participants(compId, weekStart) {
    const ids = window.ChartsAccounts ? window.ChartsAccounts.ids() : [];
    const out = [];
    for (const userId of ids) {
      const entry = list(userId).find(item => item.compId === compId && item.weekStart === weekStart);
      if (entry) out.push({ userId, slots: entry.slots || {} });
    }
    return out;
  }

  /* Classement d'une compétition terminée : tous les joueurs engagés, notés sur
     l'archive de la semaine. Ex æquo = même rang (1, 1, 3). */
  function standings(week, compId, weekStart, byId) {
    const boards = read("charts.s1.fantasyBoards", {});
    const board = boards && boards[`${compId}|${weekStart}`];
    if (Array.isArray(board) && board.length) {
      return board.map(row => ({
        userId: row.userId,
        pseudo: row.pseudo,
        total: Number(row.total) || 0,
        rank: Number(row.rank) || 0,
        reward: Number(row.reward) || 0
      }));
    }
    const L = window.ChartsListens;
    const rows = participants(compId, weekStart).map(row => ({
      ...row,
      total: L.scoreWith(week, row.slots, byId, L.alchemy(row.slots, byId)).total
    }));
    rows.sort((a, b) => b.total - a.total);
    rows.forEach((row, i) => {
      const prev = rows[i - 1];
      row.rank = prev && Math.abs(prev.total - row.total) < 1e-9 ? prev.rank : i + 1;
    });
    return rows;
  }

  function rankingUrl(compId, weekStart) {
    return `fantasy-classement.html?comp=${encodeURIComponent(compId)}&semaine=${encodeURIComponent(weekStart)}`;
  }

  /* Exemplaires engagés dans une compétition en cours : ni vente ni échange. */
  function activeUses(userId, cardId, now = new Date()) {
    return ongoing(userId, now).reduce((max, entry) => {
      const n = Object.values(entry.slots || {}).filter(id => id === cardId).length;
      return Math.max(max, n);
    }, 0);
  }

  /* Mock proto : Joueur A a joué la semaine du 2 nov. (terminée) et a engagé
     une équipe pour celle du 9 nov. (en cours). */
  const U1_TEAM = {
    voix: "s1:Q2831",
    ryt1: "s1:Q2165976",
    ryt2: "s1:Q2026621",
    melo1: "s1:Q19848",
    melo2: "s1:Q34424"
  };
  const MOCKS = [
    { userId: "u1", weekStart: "2026-11-02", slots: U1_TEAM },
    { userId: "u1", weekStart: "2026-11-09", slots: U1_TEAM }
  ];

  function seedMocks() {
    for (const { userId, ...mock } of MOCKS) {
      const flag = `charts.s1.${userId}.fantasyMock.${mock.weekStart}`;
      if (localStorage.getItem(flag)) continue;
      const ownedKey = `charts.s1.${userId}.owned`;
      const owned = read(ownedKey, null) || { v: 2, got: {}, fresh: {}, fav: {} };
      owned.got = owned.got || {};
      for (const cardId of Object.values(mock.slots)) {
        if (owned.got[cardId] && owned.got[cardId].n > 0) continue;
        owned.got[cardId] = { n: 1, t: startOf(mock.weekStart).getTime() - 86400000, origins: [{ k: "booster" }] };
      }
      localStorage.setItem(ownedKey, JSON.stringify(owned));
      const history = list(userId).filter(item => !(item.weekStart === mock.weekStart && item.compId === COMP_ID));
      history.push({ compId: COMP_ID, weekStart: mock.weekStart, slots: { ...mock.slots } });
      history.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
      localStorage.setItem(historyKey(userId), JSON.stringify(history));
      localStorage.setItem(flag, "1");
    }
  }

  if (!window.ChartsState) seedMocks();

  window.ChartsHistory = {
    COMP_ID, list, ongoing, finished, isOngoing, activeUses, rollover,
    participants, standings, rankingUrl,
    nextWeekStart, weekEnd, resultDate, weekLabel
  };
})();
