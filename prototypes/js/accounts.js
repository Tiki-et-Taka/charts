/**
 * Comptes Charts (Supabase Auth). Requiert supabase-js, charts-config.js et charts-api.js.
 * Session : jeton supabase-js (sb-<ref>-auth-token), lu de façon synchrone pour la garde.
 * Pseudos : cache local charts.s1.profiles, rafraîchi depuis la table profile.
 * Sans session, les pages de l’appli renvoient vers connexion.html ;
 * sans profil, vers connexion.html?etape=profil.
 */
(function () {
  const AUTH_PAGE = "connexion.html";
  const PROFILES = "charts.s1.profiles";
  const ACTIVE = "charts.s1.activeUser";
  const APP_PAGES = new Set([
    "lobby.html",
    "booster.html",
    "classeur.html",
    "fantasy.html",
    "fantasy-lineup.html",
    "fantasy-classement.html"
  ]);
  const ERRORS = {
    non_connecte: "Ta session a expiré : reconnecte-toi.",
    conditions_non_acceptees: "Accepte les règles et la politique de données personnelles.",
    age_non_confirme: "Confirme que tu as 15 ans ou plus.",
    pseudo_vide: "Indique un pseudo.",
    pseudo_court: "2 caractères minimum pour le pseudo.",
    pseudo_long: "16 caractères maximum pour le pseudo.",
    pseudo_caracteres: "Lettres, chiffres, espaces, tiret ou apostrophe.",
    pseudo_reserve: "Ce pseudo est réservé.",
    pseudo_pris: "Ce pseudo est déjà pris.",
    invalid_credentials: "E-mail ou mot de passe incorrect.",
    email_not_confirmed: "Confirme d’abord ton adresse avec le lien reçu par e-mail.",
    same_password: "Choisis un mot de passe différent de l’actuel.",
    weak_password: "Mot de passe trop faible : allonge-le ou varie les caractères.",
    over_request_rate_limit: "Trop de tentatives : réessaie dans quelques minutes.",
    over_email_send_rate_limit: "Trop d’e-mails envoyés : réessaie dans quelques minutes."
  };

  function pageFile() {
    return (location.pathname.split("/").pop() || "").toLowerCase();
  }

  function normalize(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim();
  }

  function readJson(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function tokenKey() {
    const url = (window.ChartsConfig || {}).supabaseUrl || "";
    try {
      return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    } catch {
      return "";
    }
  }

  function tokenUserId() {
    const stored = readJson(tokenKey());
    return stored && stored.refresh_token && stored.user && stored.user.id ? stored.user.id : "";
  }

  let profiles = readJson(PROFILES) || {};

  function saveProfiles(next) {
    profiles = next;
    localStorage.setItem(PROFILES, JSON.stringify(profiles));
  }

  function rememberProfile(id, pseudo) {
    saveProfiles({ ...profiles, [id]: pseudo });
  }

  function has(id) {
    return !!(id && typeof profiles[id] === "string");
  }

  function name(id) {
    if (id === "npc") return "PNJ";
    return has(id) ? profiles[id] : "Joueur inconnu";
  }

  function ids() {
    return Object.keys(profiles).filter(has);
  }

  function session() {
    const id = tokenUserId();
    return has(id) ? id : "";
  }

  function db() {
    return window.ChartsApi.db();
  }

  function explain(error, fallback) {
    if (!error) return fallback;
    const key = error.code && ERRORS[error.code] ? error.code : error.message;
    if (ERRORS[key]) return ERRORS[key];
    if (error.status === 429) return ERRORS.over_request_rate_limit;
    console.warn("[Charts] erreur de compte :", error);
    return fallback;
  }

  async function refreshProfiles() {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db().from("profile").select("id, pseudo").order("created_at").range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    saveProfiles(Object.fromEntries(rows.map(row => [row.id, row.pseudo])));
    return rows.length;
  }

  async function myProfile() {
    const { data, error } = await db().rpc("my_profile");
    if (error) throw error;
    const row = data && data[0];
    if (row) rememberProfile(row.id, row.pseudo);
    return row || null;
  }

  /** État serveur de la session : { user, profile } ; user nul si non connecté ou révoqué. */
  async function state() {
    const { data, error } = await db().auth.getUser();
    if (error || !data || !data.user) return { user: null, profile: null, error };
    return { user: data.user, profile: await myProfile() };
  }

  function safeNext(raw) {
    const value = String(raw || "");
    if (/^(lobby|booster|classeur|fantasy|fantasy-lineup|fantasy-classement)\.html([?#].*)?$/.test(value)) return value;
    return "lobby.html";
  }

  function goApp() {
    const next = safeNext(new URLSearchParams(location.search).get("next"));
    location.replace(next);
  }

  function authUrl(params) {
    const query = new URLSearchParams(params);
    const here = pageFile();
    if (APP_PAGES.has(here)) query.set("next", here + location.search + location.hash);
    const qs = query.toString();
    return AUTH_PAGE + (qs ? "?" + qs : "");
  }

  async function logout() {
    try {
      await db().auth.signOut();
    } catch (err) {
      console.warn("[Charts] déconnexion :", err);
    }
    localStorage.removeItem(ACTIVE);
    location.replace(AUTH_PAGE);
  }

  function checkPseudo(raw) {
    const pseudo = normalize(raw);
    if (!pseudo) return { ok: false, why: ERRORS.pseudo_vide };
    if (pseudo.length < 2) return { ok: false, why: ERRORS.pseudo_court };
    if (pseudo.length > 16) return { ok: false, why: ERRORS.pseudo_long };
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .'_-]{1,15}$/u.test(pseudo)) return { ok: false, why: ERRORS.pseudo_caracteres };
    return { ok: true, pseudo };
  }

  function checkPassword(password, password2) {
    const value = String(password || "");
    if (value.length < 8) return { ok: false, why: "8 caractères minimum pour le mot de passe." };
    if (value !== String(password2 || "")) return { ok: false, why: "Les deux mots de passe ne correspondent pas." };
    return { ok: true, password: value };
  }

  async function login(email, password) {
    const address = normalize(email).toLowerCase();
    const secret = String(password || "");
    if (!address || !secret) return { ok: false, why: "Indique l’e-mail et le mot de passe." };
    const { data, error } = await db().auth.signInWithPassword({ email: address, password: secret });
    if (error) return { ok: false, why: explain(error, "Connexion impossible pour le moment.") };
    try {
      const profile = await myProfile();
      return { ok: true, id: data.user.id, needsProfile: !profile };
    } catch (err) {
      return { ok: false, why: explain(err, "Profil illisible pour le moment.") };
    }
  }

  async function completeProfile(fields) {
    const pseudo = checkPseudo(fields.pseudo);
    if (!pseudo.ok) return pseudo;
    let password = null;
    if (fields.needPassword) {
      password = checkPassword(fields.password, fields.password2);
      if (!password.ok) return password;
    }
    if (!fields.terms) return { ok: false, why: ERRORS.conditions_non_acceptees };
    if (!fields.age) return { ok: false, why: ERRORS.age_non_confirme };
    if (password) {
      const { error } = await db().auth.updateUser({ password: password.password });
      if (error) return { ok: false, why: explain(error, "Mot de passe refusé.") };
    }
    const { data, error } = await db().rpc("complete_profile", {
      p_pseudo: pseudo.pseudo,
      p_terms: true,
      p_age: true,
      p_news: !!fields.news
    });
    if (error) return { ok: false, why: explain(error, "Profil non enregistré, réessaie.") };
    const row = data && data[0];
    rememberProfile(row.id, row.pseudo);
    localStorage.setItem(ACTIVE, row.id);
    return { ok: true, id: row.id, pseudo: row.pseudo };
  }

  async function requestReset(email) {
    const address = normalize(email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { ok: false, why: "Indique ton adresse e-mail." };
    const redirectTo = new URL(AUTH_PAGE, location.href).href;
    const { error } = await db().auth.resetPasswordForEmail(address, { redirectTo });
    if (error && (error.status === 429 || ERRORS[error.code])) return { ok: false, why: explain(error, "") };
    if (error) console.warn("[Charts] réinitialisation :", error);
    return { ok: true, why: "Si un compte existe pour cette adresse, un lien de réinitialisation vient de partir par e-mail." };
  }

  async function setPassword(password, password2) {
    const checked = checkPassword(password, password2);
    if (!checked.ok) return checked;
    const { error } = await db().auth.updateUser({ password: checked.password });
    if (error) return { ok: false, why: explain(error, "Mot de passe refusé.") };
    return { ok: true };
  }

  function bindLogout() {
    const btn = document.getElementById("logoutBtn");
    if (!btn) return;
    btn.addEventListener("click", logout);
  }

  function injectStyle() {
    if (document.getElementById("accounts-style")) return;
    const style = document.createElement("style");
    style.id = "accounts-style";
    style.textContent = `
      .logout {
        appearance: none; display: block; width: 100%; margin-top: 8px;
        border: 1px solid #2a2c32; background: transparent; color: #e8e8ea;
        font: inherit; font-size: 12px; font-weight: 700;
        letter-spacing: .08em; text-transform: uppercase;
        padding: 10px 12px; cursor: pointer;
      }
      .logout:hover { border-color: #e68a1e; color: #e68a1e; }
    `;
    document.head.appendChild(style);
  }

  function block() {
    document.documentElement.style.visibility = "hidden";
    window.ChartsAuthBlocked = true;
  }

  /* Session supposée valide d’après le jeton local : on confirme côté serveur,
     puis on rafraîchit les pseudos (une révocation renvoie vers la connexion). */
  async function confirmSession() {
    const { user, profile, error } = await state();
    if (!user) {
      if (error && error.status && error.status < 500) {
        localStorage.removeItem(ACTIVE);
        location.replace(authUrl({}));
      }
      return;
    }
    if (!profile) {
      location.replace(authUrl({ etape: "profil" }));
      return;
    }
    await refreshProfiles();
  }

  async function resolveBlocked() {
    try {
      const { user, profile } = await state();
      if (!user) location.replace(authUrl({}));
      else if (!profile) location.replace(authUrl({ etape: "profil" }));
      else location.reload();
    } catch (err) {
      console.warn("[Charts] session :", err);
      location.replace(authUrl({}));
    }
  }

  window.ChartsAccounts = {
    has, name, ids, session, state, login, completeProfile, requestReset, setPassword,
    checkPseudo, refreshProfiles, logout, goApp
  };

  const here = pageFile();
  if (APP_PAGES.has(here)) {
    const uid = tokenUserId();
    if (!uid) {
      block();
      location.replace(authUrl({}));
    } else if (!has(uid)) {
      block();
      resolveBlocked();
    } else {
      localStorage.setItem(ACTIVE, uid);
      confirmSession().catch(err => console.warn("[Charts] vérification de session :", err));
    }
  }

  injectStyle();
  bindLogout();
})();
