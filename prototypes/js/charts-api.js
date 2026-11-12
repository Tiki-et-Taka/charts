/* Accès au serveur (Supabase). Requiert, dans cet ordre :
   supabase-js (CDN), js/charts-config.js, puis ce fichier.
   catalog() renvoie un document de même forme que data/census/catalog_s1.json,
   pour que les pages gardent leur cardsFromCatalog(doc). Pas de repli local :
   le serveur fait foi. */
(function () {
  const PAGE = 1000;
  let client = null;
  let catalogPromise = null;

  function db() {
    if (client) return client;
    const cfg = window.ChartsConfig || {};
    if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseKey) {
      throw new Error("Supabase non configuré");
    }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    return client;
  }

  async function selectAll(table, columns, orderBy) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db()
        .from(table)
        .select(columns)
        .order(orderBy)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE) return rows;
    }
  }

  async function catalogFromServer() {
    const rows = await selectAll("card", "*, artist(*), plate(*), music_group(*)", "rank_in_series");
    if (!rows.length) throw new Error("catalogue vide");
    const artists = new Map();
    const plates = new Map();
    const groups = new Map();
    const cards = rows.map(({ artist, plate, music_group: group, ...card }) => {
      if (artist) artists.set(artist.qid, artist);
      if (plate) plates.set(plate.id, plate);
      if (group) groups.set(group.mbid, group);
      return card;
    });
    return {
      source: "supabase",
      cards,
      artists: [...artists.values()],
      plates: [...plates.values()],
      groups: [...groups.values()]
    };
  }

  function catalog() {
    if (!catalogPromise) {
      catalogPromise = catalogFromServer().catch(err => {
        catalogPromise = null;
        console.warn("[Charts] catalogue :", err && err.message || err);
        throw new Error("Serveur injoignable pour le moment, recharge la page.");
      });
    }
    return catalogPromise;
  }

  window.ChartsApi = { db, catalog };
})();
