/* État du joueur tenu par le serveur (portefeuille, pity, classeur, favoris).
   Requiert charts-api.js et accounts.js. Le serveur fait foi : chaque RPC renvoie
   l'état complet, recopié dans les clés localStorage que les pages lisent déjà
   (charts.s1.<uid>.owned / .wallet / .pity). Une modification locale n'est
   qu'un affichage anticipé, remplacé par la réponse du serveur.
   Émet « charts:state » (et « charts:credits-changed ») à chaque mise à jour. */
(function () {
  const ERRORS = {
    non_connecte: "Ta session a expiré : reconnecte-toi.",
    profil_manquant: "Choisis d’abord ton pseudo.",
    plus_de_booster: "Plus de booster pour l’instant.",
    tirage_impossible: "Tirage impossible pour le moment, réessaie.",
    quantite_invalide: "Quantité invalide.",
    credits_insuffisants: "Crédits insuffisants.",
    carte_favorite: "Carte en favori — retire-la des favoris pour la défausser.",
    carte_liee: "Cette carte n’est plus disponible.",
    aucun_exemplaire: "Aucun exemplaire de cette carte.",
    compte_neuf: "Le marché est ouvert.",
    plafond_vente: "Tu ne peux pas vendre cette carte pour le moment.",
    plafond_achat: "Tu ne peux pas acheter pour le moment.",
    plafond_echange: "Tu ne peux pas échanger pour le moment.",
    prix_invalide: "Prix trop bas : au moins la valeur de défausse.",
    prix_trop_haut: "La contre-offre doit être inférieure au prix affiché.",
    propre_annonce: "Tu ne peux pas agir sur ta propre annonce.",
    annonce_introuvable: "Annonce introuvable.",
    offre_introuvable: "Offre introuvable.",
    echange_introuvable: "Échange introuvable.",
    pas_ton_annonce: "Ce n’est pas ton annonce.",
    pas_ton_offre: "Ce n’est pas ton offre.",
    pas_ton_echange: "Ce n’est pas ta proposition.",
    plus_active: "Cette proposition n’est plus active.",
    acheteur_sans_credits: "L’acheteur n’a plus assez de crédits.",
    acheteur_trop_recent: "Achat impossible pour le moment.",
    exemplaire_reserve: "Exemplaire réservé par une annonce ou un échange.",
    carte_engagee: "Carte engagée en Arena — retire-la du groupe, ou attends la fin de la semaine en cours.",
    poste_invalide: "Cet artiste ne peut pas occuper ce poste.",
    carte_deja_placee: "Cette carte est déjà sur un autre poste.",
    taille_invalide: "Choisis entre 1 et 8 membres.",
    trop_de_diamants: "Un seul diamant dans le groupe.",
    lineup_incomplet: "Complète les 5 postes avant de valider.",
    competition_fermee: "Cette compétition n’est pas ouverte.",
    ligne_verrouillee: "Ce line-up est verrouillé pour la semaine en cours.",
    rarete_differente: "L’échange doit porter sur la même rareté.",
    meme_carte: "Choisis une autre carte.",
    introuvable: "Introuvable."
  };
  let queue = Promise.resolve();
  let seq = 0;
  let readyPromise = null;

  function uid() {
    return window.ChartsAccounts ? window.ChartsAccounts.session() : "";
  }

  function key(userId, kind) {
    return `charts.s1.${userId}.${kind}`;
  }

  function readJson(k) {
    try {
      const parsed = JSON.parse(localStorage.getItem(k) || "");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function ownedFrom(copies, favorites) {
    const got = {};
    const fresh = {};
    for (const c of copies || []) {
      const n = Number(c.n) || 0;
      const freeN = Math.min(n, Number(c.free_n) || 0);
      const buyN = Math.min(Math.max(0, n - freeN), Number(c.buy_n) || 0);
      const tradeN = Math.min(Math.max(0, n - freeN - buyN), Number(c.trade_n) || 0);
      const rewardN = Math.min(Math.max(0, n - freeN - buyN - tradeN), Number(c.reward_n) || 0);
      const boosterN = n - freeN - buyN - tradeN - rewardN;
      const origins = [];
      for (let i = 0; i < freeN; i++) origins.push({ k: "booster", free: true });
      for (let i = 0; i < boosterN; i++) origins.push({ k: "booster" });
      for (let i = 0; i < buyN; i++) origins.push({ k: "buy" });
      for (let i = 0; i < tradeN; i++) origins.push({ k: "trade" });
      for (let i = 0; i < rewardN; i++) origins.push({ k: "reward" });
      got[c.card_id] = {
        n,
        t: c.last_at ? Date.parse(c.last_at) : 0,
        origins
      };
      if (c.fresh) fresh[c.card_id] = true;
    }
    const fav = {};
    for (const id of favorites || []) if (got[id]) fav[id] = true;
    return { v: 2, got, fresh, fav };
  }

  function apply(state) {
    const me = uid();
    if (!me || !state || !state.wallet) return;
    const w = state.wallet;
    const previous = readJson(key(me, "wallet")) || {};
    localStorage.setItem(key(me, "wallet"), JSON.stringify({
      v: 1,
      credits: w.credits,
      packs: w.packs,
      freePacks: w.free_packs,
      paidPacks: w.paid_packs,
      nextFreeAt: Date.parse(w.next_free_at),
      starter: true,
      createdAt: Date.parse(w.created_at),
      acts: Array.isArray(state.acts) ? state.acts : (Array.isArray(previous.acts) ? previous.acts : [])
    }));
    const p = state.pity || {};
    localStorage.setItem(key(me, "pity"), JSON.stringify({
      n: p.n || 0, sinceMyth: p.since_myth || 0, sinceEpic: p.since_epic || 0, starterMyth: !!p.starter_myth
    }));
    localStorage.setItem(key(me, "owned"), JSON.stringify(ownedFrom(state.copies, state.favorites)));
    if (Object.prototype.hasOwnProperty.call(state, "hall")) {
      const h = state.hall;
      localStorage.setItem(key(me, "hall"), JSON.stringify(
        h && h.size ? { size: h.size, slots: h.slots || [] } : { size: 0, slots: [] }
      ));
    }
    document.dispatchEvent(new CustomEvent("charts:state", { detail: state }));
    document.dispatchEvent(new CustomEvent("charts:credits-changed"));
  }

  function explain(error) {
    const code = error && (ERRORS[error.message] ? error.message : "");
    if (code) return ERRORS[code];
    console.warn("[Charts] serveur :", error);
    return "Serveur injoignable pour le moment, réessaie.";
  }

  /* Les appels passent l'un après l'autre ; seul le dernier de la file
     recopie l'état, pour ne pas écraser un affichage anticipé plus récent. */
  function call(fn, args, pickState) {
    const mine = ++seq;
    const run = queue.then(async () => {
      const { data, error } = await window.ChartsApi.db().rpc(fn, args || {});
      if (error) {
        const err = new Error(explain(error));
        err.code = error.message;
        throw err;
      }
      const state = pickState ? pickState(data) : data;
      if (mine === seq) {
        if (data && data.market) applyMarket(data.market);
        if (data && data.fantasy) applyFantasy(data.fantasy);
        if (state && state.wallet) apply(state);
      }
      return data;
    });
    queue = run.catch(() => {});
    return run;
  }

  /* Échec d'une action anticipée : on recharge l'état du serveur et on prévient. */
  function settle(promise) {
    return promise.catch(err => {
      sync().catch(() => {});
      alert(err.message);
      throw err;
    });
  }

  function sync() {
    return call("sync_state");
  }

  const MARKET_KEY = "charts.s1.market";

  function applyMarket(market) {
    if (!market || !Array.isArray(market.listings)) return;
    localStorage.setItem(MARKET_KEY, JSON.stringify({
      v: 1,
      listings: market.listings,
      offers: market.offers || [],
      trades: market.trades || [],
      sales: market.sales || [],
      notifications: market.notifications || [],
      seeded: true
    }));
    const ids = [];
    for (const row of [...market.listings, ...(market.sales || []), ...(market.offers || []), ...(market.trades || [])]) {
      for (const id of [row.seller, row.buyer, row.fromUser, row.toUser]) {
        if (id && !ids.includes(id)) ids.push(id);
      }
    }
    if (window.ChartsAccounts && ids.some(id => !ChartsAccounts.has(id))) {
      ChartsAccounts.refreshProfiles().then(() => {
        document.dispatchEvent(new CustomEvent("charts:market"));
      }).catch(() => {});
    }
    document.dispatchEvent(new CustomEvent("charts:market"));
  }

  function syncMarket() {
    return call("market_state", {}, data => data.state);
  }

  const BOARDS_KEY = "charts.s1.fantasyBoards";

  function applyFantasy(fantasy) {
    const me = uid();
    if (!me || !fantasy || !fantasy.lineup) return;
    const slots = fantasy.lineup.slots || {};
    const lineup = {
      week: "",
      locked: !!fantasy.lineup.locked,
      weekStart: fantasy.lineup.weekStart,
      slots: {
        voix: slots.voix || null,
        ryt1: slots.ryt1 || null,
        ryt2: slots.ryt2 || null,
        melo1: slots.melo1 || null,
        melo2: slots.melo2 || null
      }
    };
    localStorage.setItem(key(me, "lineup"), JSON.stringify(lineup));
    localStorage.setItem(key(me, "fantasyHistory"), JSON.stringify(fantasy.history || []));
    localStorage.setItem(BOARDS_KEY, JSON.stringify(fantasy.boards || {}));
    const ids = [];
    for (const board of Object.values(fantasy.boards || {})) {
      for (const row of board || []) {
        if (row.userId && !ids.includes(row.userId)) ids.push(row.userId);
      }
    }
    if (window.ChartsAccounts && ids.some(id => !ChartsAccounts.has(id))) {
      ChartsAccounts.refreshProfiles().then(() => {
        document.dispatchEvent(new CustomEvent("charts:fantasy"));
      }).catch(() => {});
    }
    document.dispatchEvent(new CustomEvent("charts:fantasy"));
  }

  function syncFantasy() {
    return call("fantasy_state", {}, data => data.state);
  }

  function fantasyAct(fn, args) {
    return call(fn, args, data => data.state).catch(err => {
      syncFantasy().catch(() => {});
      throw err;
    });
  }

  function standings(comp, week) {
    return window.ChartsApi.db().rpc("standings", { p_comp: comp, p_week: week }).then(({ data, error }) => {
      if (error) throw new Error(explain(error));
      return data || [];
    });
  }

  /* Échec : on recharge l'état réel et on laisse l'appelant afficher le message. */
  function marketAct(fn, args) {
    return call(fn, args, data => data.state).catch(err => {
      sync().catch(() => {});
      syncMarket().catch(() => {});
      throw err;
    });
  }

  function markNotificationsRead(ids) {
    const nums = ids && ids.length ? ids.map(id => Number(id)).filter(n => Number.isFinite(n)) : null;
    return marketAct("mark_notifications_read", { p_ids: nums });
  }

  function ready() {
    if (!readyPromise) {
      readyPromise = uid() ? Promise.all([sync(), syncMarket(), syncFantasy()]).catch(err => {
        readyPromise = null;
        throw err;
      }) : Promise.resolve(null);
    }
    return readyPromise;
  }

  function openBooster() {
    return call("open_booster", {}, data => data.state);
  }

  function buyPacks(qty) {
    return settle(call("buy_packs", { p_qty: qty }));
  }

  function destroyCopy(cardId) {
    return settle(call("destroy_copy", { p_card_id: cardId }, data => data.state));
  }

  function setFavorite(cardId, on) {
    return settle(call("set_favorite", { p_card_id: cardId, p_on: !!on }, data => data.state));
  }

  function saveHall(size, slots) {
    return settle(call("save_hall_of_fame", { p_size: size || 0, p_slots: slots || [] }));
  }

  function markSeen(cardIds) {
    return call("mark_seen", { p_card_ids: cardIds && cardIds.length ? cardIds : null }).catch(err => {
      console.warn("[Charts] nouveautés :", err.message);
      sync().catch(() => {});
    });
  }

  /* Classeur d'un autre joueur, recopié sous sa clé .owned pour la page profil. */
  async function loadPlayer(userId) {
    const { data, error } = await window.ChartsApi.db().rpc("player_collection", { p_user: userId });
    if (error) throw new Error(explain(error));
    const owned = ownedFrom((data || []).map(r => ({ card_id: r.card_id, n: r.n, free_n: 0 })), []);
    owned.fresh = {};
    localStorage.setItem(key(userId, "owned"), JSON.stringify(owned));
    return owned;
  }

  window.ChartsState = {
    ready, sync, syncMarket, marketAct, markNotificationsRead,
    syncFantasy, fantasyAct, standings,
    openBooster, buyPacks, destroyCopy, setFavorite, saveHall, markSeen, loadPlayer,
    marketOpen: true
  };

  if (uid() && !window.ChartsAuthBlocked) {
    ready().catch(err => console.warn("[Charts] état :", err.message));
    setInterval(() => {
      if (document.visibilityState !== "visible" || !uid()) return;
      syncMarket().catch(() => {});
    }, 15000);
  }
})();
