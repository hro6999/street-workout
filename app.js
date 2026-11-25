// =====================================================================
//  app.js — LES ÉCRANS DE L'APPLI
// ---------------------------------------------------------------------
//   1. Les données (lecture / sauvegarde dans le téléphone)
//   2. Petits outils (sons, vibrations, écran allumé, fenêtres)
//   3. Navigation
//   4. Écran Séance (accueil) + boutons Fait / Pas fait / Reporter
//   5. Séance guidée (séries, chrono de repos, fin de séance)
//   6. Test de niveau
//   7. Écrans Poids, Stats, Badges, Bilan, Réglages (sauvegarde)
//  Les règles (XP, badges, cibles…) sont dans coach.js.
// =====================================================================

// ============ 1. LES DONNÉES ============

const CLE = "coach-street-donnees";
const CLE_EN_COURS = "coach-street-seance-en-cours";
const CLE_ANCIENNE_APPLI = "street-workout-donnees"; // l'appli d'avant (questionnaire)

function lireStockage(cle) {
  try { const t = localStorage.getItem(cle); return t ? JSON.parse(t) : null; } catch (e) { return null; }
}
function ecrireStockage(cle, valeur) {
  try {
    if (valeur == null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch (e) { return false; }
}

// Récupère les pesées et séances de l'ancienne version de l'appli (une seule fois)
function migrerAncienneAppli() {
  const a = lireStockage(CLE_ANCIENNE_APPLI);
  if (!a) return null;
  const jourDe = t => { const x = new Date(t); return isNaN(x) ? null : isoDate(x); };
  const brut = { historique: {}, poids: [] };
  (a.seances || []).forEach(s => { const j = jourDe(s && s.date); if (j) brut.historique[j] = "fait"; });
  (a.poids || []).forEach(p => { const j = jourDe(p && p.date); if (j && p.kg) brut.poids.push([j, p.kg]); });
  const dates = Object.keys(brut.historique).concat(brut.poids.map(p => p[0])).sort();
  if (!dates.length) return null;
  brut.debut = dates[0];
  if (a.profil && a.profil.prenom) brut.prenom = a.profil.prenom;
  if (a.profil && a.profil.poidsVise) brut.objectif = a.profil.poidsVise;
  const d = normaliser(brut);
  // On donne l'XP et les badges correspondant à ce qui a déjà été fait
  recompenser(d, 100 * Object.keys(d.historique).length + 20 * d.poids.length);
  return d;
}

let d = (function () {
  const brut = lireStockage(CLE);
  if (brut) return normaliser(brut);
  const migre = migrerAncienneAppli();
  return migre || donneesVides();
})();

function sauver() {
  if (!ecrireStockage(CLE, d)) toast("⚠️ Impossible d'enregistrer dans le téléphone (mode privé ?)");
}
sauver();


// ============ 2. PETITS OUTILS ============

const $ = s => document.querySelector(s);
const appEl = $("#app");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = sec => { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };
const maj = s => s.charAt(0).toUpperCase() + s.slice(1);
const unite = u => (u === "sec" ? "sec" : "reps");
const dateCourte = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7);
function attempt(f) { try { f(); } catch (e) { /* pas grave */ } }

function vibre(ms) { attempt(() => navigator.vibrate && navigator.vibrate(ms)); }

let audio = null;
function debloquerSon() {
  attempt(() => {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  });
}
function bip(freq, duree, vol) {
  attempt(() => {
    if (!audio) return;
    const o = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime;
    o.type = "sine"; o.frequency.value = freq || 880;
    gain.gain.setValueAtTime(vol || 0.25, t); gain.gain.exponentialRampToValueAtTime(0.001, t + (duree || 0.15));
    o.connect(gain); gain.connect(audio.destination); o.start(t); o.stop(t + (duree || 0.15));
  });
}
function fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => bip(f, 0.22, 0.22), i * 130)); }
document.addEventListener("touchstart", debloquerSon, { once: true, passive: true });
document.addEventListener("click", debloquerSon, { once: true });

// Garder l'écran allumé pendant la séance
let verrouEcran = null;
async function ecranAllume(oui) {
  try {
    if (oui && "wakeLock" in navigator) verrouEcran = await navigator.wakeLock.request("screen");
    else if (!oui && verrouEcran) { verrouEcran.release(); verrouEcran = null; }
  } catch (e) { /* pas grave */ }
}

let minuterieToast = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => t.classList.remove("on"), 2800);
}

// Fenêtre qui monte du bas. boutons = [[texte, fonction, "sec" pour un bouton gris]]
function fenetre(titre, contenuHTML, boutons) {
  fermerFenetre();
  const m = document.createElement("div");
  m.className = "modal"; m.id = "modal";
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><h3>${titre}</h3><div class="sheet-body">${contenuHTML}</div><div class="sheet-btns"></div></div>`;
  const zone = m.querySelector(".sheet-btns");
  (boutons || [["OK", null]]).forEach(([texte, action, style]) => {
    const b = document.createElement("button");
    b.className = "cta " + (style || "");
    b.innerHTML = texte;
    b.onclick = () => { if (!action || action() !== false) fermerFenetre(); };
    zone.appendChild(b);
  });
  m.addEventListener("click", e => { if (e.target === m) fermerFenetre(); });
  document.body.appendChild(m);
  brancherFigures();
}
function fermerFenetre() { const m = $("#modal"); if (m) m.remove(); }

// Un message "comme le bot" (texte sur plusieurs lignes)
function message(titre, texte, boutons) {
  fenetre(titre, `<div class="msg">${esc(texte)}</div>`, boutons);
}

// Célébration selon la récompense (badge, niveau)
function feter(recompense, toujours) {
  if (recompense && recompense.monte) { fanfare(); confettis(true); vibre([80, 60, 80, 60, 160]); }
  else if (toujours || (recompense && recompense.nouveaux.length)) { fanfare(); confettis(false); vibre([80, 60, 80]); }
}


// ============ 3. NAVIGATION ============

const ONGLETS = ["seance", "poids", "stats", "badges", "bilan"];
let vue = ONGLETS.includes(location.hash.slice(1)) || location.hash === "#reglages" ? location.hash.slice(1) : "seance";
let jourChoisi = prochainJourSeance();
let motivation = auHasard(MOTIVATION_MATIN);
let indexHero = 0;
let jourAffiche = aujourdhui();

function afficher() {
  const html = { seance: vueSeance, poids: vuePoids, stats: vueStats, badges: vueBadges, bilan: vueBilan, reglages: vueReglages,
    exo: vueExo, repos: vueRepos, fin: vueFin, test: vueTest }[vue]();
  const plein = ["exo", "repos", "fin", "test"].includes(vue);
  appEl.innerHTML = plein ? html : enteteHTML() + html;
  $("#nav").classList.toggle("cache", plein);
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.vue === vue));
  appEl.classList.remove("fadein"); void appEl.offsetWidth; appEl.classList.add("fadein");
  brancherFigures();
}
function aller(v) {
  vue = v; vibre(10);
  if (ONGLETS.includes(v) || v === "reglages") attempt(() => history.replaceState(null, "", "#" + v));
  afficher(); window.scrollTo(0, 0);
}
document.querySelectorAll("#nav button").forEach(b => { b.onclick = () => aller(b.dataset.vue); });

function enteteHTML() {
  return `<header class="top">
    <div class="brand">COACH<span>STREET</span></div>
    <div class="top-r"><div class="streak" title="Série en cours">🔥 <b class="num">${serieEnCours(d)}</b></div>
    <button class="icon-btn" onclick="aller('reglages')" aria-label="Réglages et sauvegarde">⚙️</button></div>
  </header>`;
}

function carteNiveau() {
  const n = niveau(d.xp);
  const pct = n.suivant ? Math.round(100 * (d.xp - n.min) / (n.suivant - n.min)) : 100;
  return `<div class="card"><div class="lvl-row"><div class="lvl-name">${n.nom}</div><div class="xp num">${d.xp} XP</div></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="lvl-sub">${n.suivant ? `${d.xp}/${n.suivant} XP · encore ${n.suivant - d.xp} XP avant le niveau suivant` : "Niveau maximum atteint 👑"}</div></div>`;
}

// Quand on revient sur l'appli (iPhone : elle reste ouverte en arrière-plan)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (jourAffiche !== aujourdhui()) { jourAffiche = aujourdhui(); jourChoisi = prochainJourSeance(); motivation = auHasard(MOTIVATION_MATIN); }
  if (!["exo", "repos", "fin", "test"].includes(vue)) afficher();
});


// ============ 4. ÉCRAN SÉANCE (ACCUEIL) ============

function vueSeance() {
  const auj = aujourdhui(), duJour = jourDuJour();
  const seance = PROGRAMME[jourChoisi], exos = seanceExos(d, jourChoisi);
  const estAujourdhui = duJour === jourChoisi;
  const estProchaine = prochainJourSeance() === jourChoisi;
  const enCours = lireStockage(CLE_EN_COURS);

  let html = `<p class="motiv">${esc(motivation)}</p>`;

  if (enCours && enCours.date === auj) {
    html += `<div class="card card-blue"><div class="h2">⏸ Séance en cours</div>
      <p class="muted">${PROGRAMME[enCours.W.jour].titre} — tu t'es arrêté à l'exercice ${enCours.W.ei + 1}/4.</p>
      <div class="btn-row"><button class="cta" onclick="reprendreSeance()">▶ Reprendre</button>
      <button class="cta sec" onclick="ecrireStockage(CLE_EN_COURS,null);afficher()">Effacer</button></div></div>`;
  }

  const question = questionBilan(d);
  if (question) {
    html += `<div class="card card-ask"><div class="ask">${esc(question)}</div>
      <div class="ask-btns">
        <button class="big ok" onclick="clicFait()"><span>✅</span>Fait</button>
        <button class="big ko" onclick="clicRate()"><span>❌</span>Pas fait</button>
        <button class="big later" onclick="clicReporter()"><span>⏰</span>Reporter</button>
      </div></div>`;
  }
  if (d.historique[auj] === "fait") html += `<div class="banner">✅ Séance du jour validée. Tu peux quand même en refaire une 💪</div>`;
  if (d.historique[auj] === "rate") html += `<div class="banner ko">❌ Séance du jour notée comme ratée. ${duJour ? "Tu peux encore la faire avec la séance guidée 💪" : ""}</div>`;

  const puces = JOURS.map(j => `<button class="chip ${j === jourChoisi ? "on" : ""}" onclick="choisirJour('${j}')">${j}${
    duJour === j ? '<span class="dot">AUJ.</span>' : ""}</button>`).join("");
  const etiquette = estAujourdhui ? "SÉANCE DU JOUR" : estProchaine ? "PROCHAINE SÉANCE · " + jourChoisi.toUpperCase() : jourChoisi.toUpperCase();
  const i = indexHero % exos.length;
  const minutes = Math.round(exos.length * SERIES * 2.3);

  html += `<div class="days">${puces}</div>
    <div class="card hero">
      <div class="tags"><span class="tag">${etiquette}</span><span class="tag g">SEMAINE ${numeroSemaine(d)}</span></div>
      <h1>${seance.titre}</h1>
      <div class="hero-fig" id="hero-fig">${figure(exos[i].anim, "xl")}</div>
      <div class="hero-lbl" id="hero-lbl">${esc(exos[i].nom)}</div>
      <div class="hero-meta">${SERIES} séries de chaque, 1 min 30 à 2 min de repos · ~${minutes} min</div>
    </div>`;

  html += exos.map(e => {
    const rec = d.records[e.nom];
    return `<div class="card row"><div class="mini">${figure(e.anim, "sm")}</div>
      <div class="rinfo"><b>${esc(e.nom)}</b><small>${SERIES} × <strong>${e.cible}</strong> ${unite(e.unite)}</small></div>
      <div class="rec">${rec != null ? "🏆 " + rec : ""}</div></div>`;
  }).join("");

  html += `<div class="notes">${notesSeance(d, jourChoisi).map(n => `<p>${esc(n)}</p>`).join("")}</div>`;

  const t = d.test;
  html += t
    ? `<div class="card"><div class="h2">🧪 Ton test de niveau <small>programme calibré</small></div>
        <div class="muted">${t.pompes} pompes · ${t.tractions} tractions · ${t.gainage} s de gainage</div>
        <button class="btn-s" onclick="lancerTest()">Refaire le test</button></div>`
    : `<div class="card card-blue"><div class="h2">🧪 Test de niveau</div>
        <div class="muted">3 minutes pour mesurer ton max de pompes, tractions et gainage. Ton programme s'adapte à ton vrai niveau.</div>
        <button class="btn-s accent" onclick="lancerTest()">Faire le test →</button></div>`;

  html += `<div class="cta-wrap"><button class="cta" onclick="lancerSeance()">▶ COMMENCER ${estAujourdhui ? "LA SÉANCE" : maj(jourChoisi).toUpperCase()}</button></div>`;
  return html;
}

function choisirJour(j) { jourChoisi = j; indexHero = 0; vibre(10); afficher(); }

// Le grand bonhomme change d'exercice toutes les 3,5 secondes
setInterval(() => {
  if (vue !== "seance") return;
  const exos = PROGRAMME[jourChoisi].exercices;
  indexHero = (indexHero + 1) % exos.length;
  const boite = $("#hero-fig"), lbl = $("#hero-lbl");
  if (boite) { boite.innerHTML = figure(exos[indexHero].anim, "xl"); lbl.textContent = exos[indexHero].nom; brancherFigures(); }
}, 3500);

// ---- Boutons Fait / Pas fait / Reporter ----
function clicFait() {
  const r = marquerFait(d);
  if (!r) { toast("C'est déjà noté pour aujourd'hui 👍"); afficher(); return; }
  sauver(); afficher(); feter(r.recompense, true);
  const ressentis = [["facile", "😎", "Facile"], ["correct", "👍", "Correct"], ["dur", "🥵", "Dur"]];
  fenetre("✅ Séance validée", `<div class="msg">${esc(r.texte)}</div><div class="h2" style="margin-top:18px">Comment tu l'as trouvée ?</div>
    <div class="feel">${ressentis.map(([k, e, l]) => `<button onclick="clicRessenti('${k}')"><span>${e}</span>${l}</button>`).join("")}</div>`,
  [["Plus tard", null, "sec"]]);
}
function clicRessenti(valeur) {
  const reponse = appliquerRessenti(d, jourDuJour() || prochainJourSeance(), valeur);
  sauver(); fermerFenetre(); afficher(); toast(reponse);
}
function clicRate() {
  fenetre("Séance pas faite ?", `<p class="muted">Elle comptera comme ratée et ta série de ${serieEnCours(d)} repartira à zéro.</p>`, [
    ["❌ Oui, pas faite", () => {
      const r = marquerRate(d);
      if (!r) { toast("C'est déjà noté pour aujourd'hui 👍"); return; }
      sauver(); afficher(); setTimeout(() => message("On rebondit", r.texte), 50);
    }],
    ["Annuler", null, "sec"]]);
}
function clicReporter() { const texte = reporter(d); sauver(); afficher(); toast(texte); }


// ============ 5. SÉANCE GUIDÉE ============

let W = null;   // la séance en cours
let R = null;   // le repos en cours
let H = null;   // le chrono de gainage en cours

function lancerSeance() {
  debloquerSon(); ecranAllume(true); vibre(30);
  W = { jour: jourChoisi, x: seanceExos(d, jourChoisi), ei: 0, si: 0, res: {}, t0: Date.now(), count: 0 };
  H = R = null;
  memoriserSeance();
  aller("exo");
}
function memoriserSeance() { ecrireStockage(CLE_EN_COURS, { date: aujourdhui(), W }); }
function reprendreSeance() {
  const e = lireStockage(CLE_EN_COURS);
  if (!e || !e.W) return;
  W = e.W; W.count = 0; H = R = null;
  debloquerSon(); ecranAllume(true);
  aller("exo");
}
const exoActuel = () => W.x[W.ei];

function segmentsHTML() {
  let s = "";
  const total = W.x.length * SERIES, faits = W.ei * SERIES + W.si;
  for (let i = 0; i < total; i++) s += `<i class="${i < faits ? "d" : i === faits ? "c" : ""}"></i>`;
  return s;
}
function hautSeance() {
  return `<div class="wk-top"><button class="x" onclick="demanderQuitter()" aria-label="Quitter">✕</button>
    <div class="segs">${segmentsHTML()}</div><div class="clock num" id="ecoule">${fmt((Date.now() - W.t0) / 1000)}</div></div>`;
}

const CIRC = 2 * Math.PI * 88;
function anneau(id, frac, label, sous) {
  return `<div class="ring"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" class="ring-bg"/>
    <circle id="${id}" cx="100" cy="100" r="88" class="ring-fg" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC * (1 - frac)}" transform="rotate(-90 100 100)"/></svg>
    <div class="ring-in"><div class="ring-t num" id="${id}-t">${label}</div><div class="ring-s" id="${id}-s">${sous}</div></div></div>`;
}
function majAnneau(id, frac, label, sous) {
  const c = document.getElementById(id), t = document.getElementById(id + "-t"), s = document.getElementById(id + "-s");
  if (c) c.setAttribute("stroke-dashoffset", CIRC * (1 - Math.max(0, Math.min(1, frac))));
  if (t) t.textContent = label;
  if (s && sous) s.textContent = sous;
}

function vueExo() {
  const e = exoActuel(), enSec = e.unite === "sec";
  const bloc = enSec
    ? `${anneau("hold", 1, fmt(e.cible), "OBJECTIF " + e.cible + " S")}
       <div class="under"><button class="btn-s big-s" onclick="saisir()">✏️ Saisir</button>
       <button class="cta grow" id="holdBtn" onclick="basculerChrono()">${H ? "■ ARRÊTER" : "▶ DÉMARRER"}</button></div>`
    : `<button class="tapper" onclick="tapRep()" aria-label="Ajouter une répétition"><span class="tap-count num" id="cnt">${W.count}</span>
       <span class="tap-goal">/ ${e.cible} reps</span><span class="tap-hint">tape à chaque rep</span></button>
       <div class="under"><button class="btn-s big-s" onclick="moinsRep()" aria-label="Enlever une répétition">−1</button>
       <button class="btn-s big-s" onclick="saisir()">✏️</button>
       <button class="cta grow" onclick="finSerie()">✓ SÉRIE FINIE</button></div>
       <p class="hint">Pas compté ? « Série finie » enregistre l'objectif (${e.cible}).</p>`;
  return `<div class="wk">${hautSeance()}
    <div class="wk-name">${esc(e.nom)}</div><div class="wk-set">SÉRIE ${W.si + 1} / ${SERIES}${d.records[e.nom] != null ? " · 🏆 " + d.records[e.nom] : ""}</div>
    <div class="wk-fig">${figure(e.anim, "xl")}</div>${bloc}</div>`;
}

function tapRep() {
  W.count++; vibre(15); bip(660, 0.05, 0.12);
  const c = $("#cnt");
  if (c) { c.textContent = W.count; c.classList.remove("go"); void c.offsetWidth; c.classList.add("go"); }
  if (W.count === exoActuel().cible) { vibre([60, 40, 60]); toast("🎯 Objectif atteint ! Continue si tu peux 🔥"); }
}
function moinsRep() { if (W.count > 0) { W.count--; vibre(10); const c = $("#cnt"); if (c) c.textContent = W.count; } }

function basculerChrono() {
  debloquerSon();
  if (!H) {
    H = { start: Date.now(), goal: exoActuel().cible, last: null, atteint: false };
    vibre(40); bip(880, 0.2);
    const b = $("#holdBtn"); if (b) b.textContent = "■ ARRÊTER";
  } else {
    const v = Math.round((Date.now() - H.start) / 1000);
    H = null; finSerie(v);
  }
}

// Saisie à la main du nombre de reps ou de secondes
function saisir() {
  const e = exoActuel();
  H = null;
  fenetre(`${esc(e.nom)} — série ${W.si + 1}`, `<label class="lbl" for="saisie">${e.unite === "sec" ? "Secondes tenues" : "Répétitions faites"}</label>
    <input id="saisie" class="input big-input num" type="number" inputmode="numeric" min="0" max="999" value="${e.unite === "sec" ? e.cible : (W.count || e.cible)}">`,
  [["✓ Valider", () => {
    const v = parseInt($("#saisie").value, 10);
    if (!(v >= 0 && v <= 999)) { toast("Entre un nombre entre 0 et 999"); return false; }
    fermerFenetre(); finSerie(v); return false;
  }], ["Annuler", () => { afficher(); }, "sec"]]);
  setTimeout(() => { const i = $("#saisie"); if (i) { i.focus(); i.select(); } }, 80);
}

function finSerie(val) {
  const e = exoActuel();
  if (val == null) val = e.unite === "sec" ? e.cible : (W.count || e.cible);
  (W.res[e.nom] = W.res[e.nom] || []).push(val);
  H = null; W.count = 0; vibre(40);
  W.si++;
  if (W.si >= SERIES) { W.si = 0; W.ei++; }
  memoriserSeance();
  if (W.ei >= W.x.length) { finSeance(); return; }
  R = { total: d.repos, fin: Date.now() + d.repos * 1000, last: null };
  aller("repos");
}

function vueRepos() {
  const n = exoActuel();
  return `<div class="wk rest">${hautSeance()}
    <div class="rest-title">RÉCUPÉRATION</div>
    ${anneau("rest", 1, fmt((R.fin - Date.now()) / 1000), "RESPIRE 😮‍💨")}
    <div class="choice">
      <button class="${R.total === 90 ? "on" : ""}" onclick="choisirRepos(90)">1:30</button>
      <button class="${R.total === 120 ? "on" : ""}" onclick="choisirRepos(120)">2:00</button>
      <button onclick="plusRepos()">+15 s</button></div>
    <button class="cta sec" onclick="passerRepos()">Passer le repos ⏭</button>
    <div class="card next"><div class="mini">${figure(n.anim, "sm")}</div>
      <div class="rinfo"><small>À SUIVRE</small><b>${esc(n.nom)} — série ${W.si + 1}/${SERIES}</b><small>Objectif : ${n.cible} ${unite(n.unite)}</small></div></div></div>`;
}
function choisirRepos(s) {
  d.repos = s; sauver();
  const passe = R.total - (R.fin - Date.now()) / 1000;
  R.total = s; R.fin = Date.now() + (s - passe) * 1000; vibre(10); afficher();
}
function plusRepos() { R.fin += 15000; R.total += 15; vibre(10); }
function passerRepos() { R = null; vibre(30); aller("exo"); }

function demanderQuitter() {
  fenetre("Arrêter la séance ?", `<p class="muted">Tu pourras la reprendre plus tard depuis l'accueil (aujourd'hui seulement).</p>`, [
    ["💪 Je continue", null],
    ["Quitter", () => { W = R = H = null; ecranAllume(false); aller("seance"); }, "sec"]]);
}

// ---- L'horloge : chronos de gainage et de repos ----
setInterval(() => {
  if (W && (vue === "exo" || vue === "repos")) { const el = $("#ecoule"); if (el) el.textContent = fmt((Date.now() - W.t0) / 1000); }
  if (vue === "exo" && H) {
    const passe = (Date.now() - H.start) / 1000, reste = H.goal - passe;
    if (reste > 0) {
      majAnneau("hold", reste / H.goal, fmt(reste));
      const s = Math.ceil(reste);
      if (s <= 3 && s !== H.last) { H.last = s; bip(880, 0.12); vibre(15); }
    } else {
      if (!H.atteint) { H.atteint = true; bip(1320, 0.5, 0.3); vibre([80, 60, 80]); toast("🎯 Objectif tenu ! Tiens encore si tu peux 🔥"); }
      majAnneau("hold", 1, "+" + fmt(-reste), "TOTAL " + Math.floor(passe) + " S");
    }
  }
  if (vue === "repos" && R) {
    const reste = (R.fin - Date.now()) / 1000;
    majAnneau("rest", reste / R.total, fmt(reste));
    const s = Math.ceil(reste);
    if (s <= 3 && s > 0 && s !== R.last) { R.last = s; bip(880, 0.12); vibre(20); }
    if (reste <= 0) { bip(1320, 0.5, 0.3); vibre([80, 60, 80]); R = null; aller("exo"); toast("🔔 C'EST REPARTI ! Série suivante 💪"); }
  }
  if (vue === "test" && T && T.start) {
    const s = (Date.now() - T.start) / 1000;
    majAnneau("tst", (s % 60) / 60 || 0.001, fmt(s));
  }
}, 200);

// ---- Fin de séance ----
let F = null;
function finSeance() {
  ecranAllume(false); fanfare(); vibre([80, 60, 80]);
  const duree = Math.round((Date.now() - W.t0) / 1000);
  let reps = 0, parfaite = true;
  const records = [];
  W.x.forEach(e => {
    const v = W.res[e.nom] || [];
    if (e.unite === "reps") reps += v.reduce((a, b) => a + b, 0);
    if (v.length < SERIES || Math.min(...v) < e.cible) parfaite = false;
    const meilleur = Math.max(...v), avant = d.records[e.nom];
    if (avant != null && meilleur > avant) records.push(`${e.nom} : ${meilleur} (avant ${avant})`);
  });
  F = { duree, reps, parfaite, records, ressenti: "correct" };
  aller("fin"); confettis(false);
}
function vueFin() {
  const ressentis = [["facile", "😎", "Facile"], ["correct", "👍", "Correct"], ["dur", "🥵", "Dur"]];
  return `<div class="done-h">SÉANCE TERMINÉE 🔥</div><div class="done-s">${PROGRAMME[W.jour].titre}</div>
    <div class="tiles"><div class="tile"><div class="v num">${fmt(F.duree)}</div><div class="l">Durée</div></div>
    <div class="tile"><div class="v num">${F.reps}</div><div class="l">Répétitions</div></div></div>
    ${F.parfaite ? '<div class="banner">🎖️ Séance parfaite : tous les objectifs atteints !</div>' : ""}
    ${F.records.map(r => `<div class="newrec">📈 Nouveau record — ${esc(r)}</div>`).join("")}
    <div class="card" style="margin-top:12px"><div class="h2">Comment c'était ?</div><div class="feel">
      ${ressentis.map(([k, e, l]) => `<button class="${F.ressenti === k ? "on" : ""}" onclick="F.ressenti='${k}';vibre(10);afficher()"><span>${e}</span>${l}</button>`).join("")}
    </div><p class="muted" style="margin-top:10px">Ta prochaine séance s'adapte à ta réponse.</p></div>
    <div class="cta-wrap solo"><button class="cta" onclick="enregistrerSeance()">💾 ENREGISTRER MA SÉANCE</button></div>`;
}
function enregistrerSeance() {
  const r = validerSeance(d, { jour: W.jour, res: W.res, ressenti: F.ressenti, duree: F.duree });
  sauver(); ecrireStockage(CLE_EN_COURS, null);
  W = F = null;
  aller("seance");
  feter(r.recompense, false);
  message("💾 Séance enregistrée", r.texte);
}


// ============ 6. TEST DE NIVEAU ============

const ETAPES_TEST = [
  { k: "pompes", nom: "Pompes", type: "reps", anim: "pompes", txt: "Fais le maximum de pompes propres, sans t'arrêter." },
  { k: "tractions", nom: "Tractions", type: "reps", anim: "tractions", txt: "Le maximum de tractions, menton au-dessus de la barre." },
  { k: "gainage", nom: "Gainage", type: "chrono", anim: "gainage", txt: "Tiens la position le plus longtemps possible." },
];
let T = null;
function lancerTest() { debloquerSon(); ecranAllume(true); T = { etape: 0, vals: {}, count: 0, start: null }; aller("test"); }
function quitterTest() { T = null; ecranAllume(false); aller("seance"); }

function vueTest() {
  if (T.etape >= ETAPES_TEST.length) {
    return `<div class="done-h">TEST TERMINÉ 🧪</div><div class="done-s">Ton programme va être calibré sur ces résultats</div>
      <div class="tiles three"><div class="tile"><div class="v num">${T.vals.pompes}</div><div class="l">Pompes</div></div>
      <div class="tile"><div class="v num">${T.vals.tractions}</div><div class="l">Tractions</div></div>
      <div class="tile"><div class="v num">${T.vals.gainage} s</div><div class="l">Gainage</div></div></div>
      <button class="cta" onclick="enregistrerLeTest()">💾 ENREGISTRER</button>
      <button class="cta sec" style="margin-top:10px" onclick="quitterTest()">Annuler</button>`;
  }
  const s = ETAPES_TEST[T.etape];
  const bloc = s.type === "reps"
    ? `<button class="tapper" onclick="T.count++;vibre(15);bip(660,.05,.12);$('#cnt').textContent=T.count"><span class="tap-count num" id="cnt">${T.count}</span>
       <span class="tap-goal">reps</span><span class="tap-hint">tape à chaque rep</span></button>
       <div class="under"><button class="btn-s big-s" onclick="if(T.count>0){T.count--;$('#cnt').textContent=T.count}">−1</button>
       <button class="cta grow" onclick="etapeSuivante(T.count)">SUIVANT →</button></div>`
    : `${anneau("tst", T.start ? 0.001 : 0, "0:00", "CHRONO")}
       <div class="under"><button class="cta grow" onclick="chronoTest()">${T.start ? "■ STOP" : "▶ DÉMARRER"}</button></div>`;
  return `<div class="wk"><div class="wk-top"><button class="x" onclick="quitterTest()" aria-label="Quitter">✕</button>
    <div class="segs">${ETAPES_TEST.map((_, i) => `<i class="${i < T.etape ? "d" : i === T.etape ? "c" : ""}"></i>`).join("")}</div>
    <div class="clock">${T.etape + 1}/3</div></div>
    <div class="wk-name">${s.nom}</div><div class="wk-set">TEST DE NIVEAU</div><div class="wk-fig">${figure(s.anim, "xl")}</div>
    <p class="muted center">${s.txt}</p>${bloc}</div>`;
}
function etapeSuivante(v) {
  T.vals[ETAPES_TEST[T.etape].k] = v; T.etape++; T.count = 0; T.start = null; vibre([60, 40, 60]);
  if (T.etape >= ETAPES_TEST.length) { ecranAllume(false); fanfare(); confettis(false); }
  afficher();
}
function chronoTest() {
  if (!T.start) { T.start = Date.now(); vibre(40); bip(880, 0.2); afficher(); }
  else etapeSuivante(Math.round((Date.now() - T.start) / 1000));
}
function enregistrerLeTest() {
  const r = enregistrerTest(d, T.vals);
  sauver(); T = null;
  aller("seance"); feter(r.recompense, false);
  message("🧪 Test enregistré", r.texte);
}


// ============ 7. LES AUTRES ÉCRANS ============

// ---- Poids ----
function courbePoids() {
  const pts = d.poids.slice(-30);
  if (pts.length < 2) return '<div class="muted center pad">Ajoute au moins 2 pesées pour voir ta courbe 📈</div>';
  const W_ = 320, H_ = 160, pad = 16, vals = pts.map(p => p[1]);
  const lo = Math.min(d.objectif, ...vals) - 0.5, hi = Math.max(d.objectif, ...vals) + 0.5;
  const X = i => pad + i * (W_ - 2 * pad) / (pts.length - 1), Y = v => H_ - pad - (v - lo) * (H_ - 2 * pad) / (hi - lo);
  const ligne = pts.map((p, i) => `${X(i)},${Y(p[1])}`).join(" ");
  const aire = `${X(0)},${H_ - pad} ${ligne} ${X(pts.length - 1)},${H_ - pad}`;
  return `<svg viewBox="0 0 ${W_} ${H_}" class="chart" role="img" aria-label="Courbe de poids">
    <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#39ff88" stop-opacity=".35"/><stop offset="1" stop-color="#39ff88" stop-opacity="0"/></linearGradient></defs>
    <line x1="${pad}" x2="${W_ - pad}" y1="${Y(d.objectif)}" y2="${Y(d.objectif)}" stroke="#2f7bff" stroke-dasharray="6 6" stroke-width="2"/>
    <text x="${W_ - pad}" y="${Y(d.objectif) - 6}" fill="#6fa8ff" font-size="11" font-weight="800" text-anchor="end">Objectif ${g(d.objectif)} kg</text>
    <polygon points="${aire}" fill="url(#wg)"/>
    <polyline points="${ligne}" fill="none" stroke="#39ff88" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p[1])}" r="${i === pts.length - 1 ? 5 : 3}" fill="#39ff88"/>`).join("")}
    <text x="${pad}" y="${H_ - 2}" fill="#7d8aa8" font-size="10">${dateCourte(pts[0][0])}</text>
    <text x="${W_ - pad}" y="${H_ - 2}" fill="#7d8aa8" font-size="10" text-anchor="end">${dateCourte(pts[pts.length - 1][0])}</text>
  </svg>`;
}

function vuePoids() {
  const dernier = dernierPoids(d), gain = gainPoids(d), atteint = objectifAtteint(d);
  const reste = dernier != null ? arrondi1(Math.abs(d.objectif - dernier)) : null;
  const deja = d.poids.length && d.poids[d.poids.length - 1][0] === aujourdhui();
  let html = `<div class="card"><div class="h2">⚖️ Mon poids <small>objectif ${g(d.objectif)} kg</small></div>`;
  if (dernier != null) {
    html += `<div class="wbig"><b class="num">${g(dernier)} kg</b><span class="up">${signe(gain)} kg</span></div>
      <div class="muted">depuis le début (${g(d.poids[0][1])} kg le ${dateCourte(d.poids[0][0])})</div>
      <div class="bar lg" style="margin-top:12px"><i style="width:${Math.round(100 * progressionObjectif(d))}%"></i></div>
      <div class="goal-line">${atteint ? '<b class="ok-txt">🎯 OBJECTIF ATTEINT ! 👑</b>' : `Encore <b>${g(reste)} kg</b> avant tes ${g(d.objectif)} kg 🎯`}</div>`;
  } else {
    html += `<div class="muted">Pas encore de pesée. Monte sur la balance à jeun et note ton poids ici 👇</div>`;
  }
  html += courbePoids();
  html += `<label class="lbl" for="poidsIn">${deja ? "Corriger la pesée d'aujourd'hui" : "Pesée du jour"}</label>
    <div class="wrow"><input id="poidsIn" class="input" type="text" inputmode="decimal" placeholder="ex : 61,2" autocomplete="off">
    <button class="cta small" onclick="clicPoids()">Enregistrer</button></div>
    <p class="hint">Une pesée par jour : une nouvelle pesée remplace celle du jour (+20 XP une seule fois par jour). Entre 30 et 250 kg.</p></div>`;

  html += `<div class="card"><div class="h2">🎯 Objectif</div>
    <div class="wrow"><input id="objIn" class="input" type="text" inputmode="decimal" value="${g(d.objectif)}" autocomplete="off">
    <button class="cta small sec" onclick="clicObjectif()">Modifier</button></div></div>`;

  if (d.poids.length) {
    html += `<div class="card"><div class="h2">📒 Dernières pesées</div><div class="recs">${d.poids.slice(-8).reverse()
      .map(([j, v]) => `<div><span>${dateCourte(j)}</span><span class="num">${g(v)} kg</span></div>`).join("")}</div></div>`;
  }
  return html;
}
function clicPoids() {
  let v;
  try { v = lirePoids($("#poidsIn").value); } catch (e) { toast(e.message); return; }
  const r = enregistrerPoids(d, v);
  sauver(); afficher(); feter(r.recompense, false);
  message("⚖️ Pesée enregistrée", r.texte);
}
function clicObjectif() {
  let texte;
  try { texte = changerObjectif(d, $("#objIn").value); } catch (e) { toast("Écris par exemple 75 (entre 30 et 250 kg)"); return; }
  sauver(); afficher(); toast(texte);
}

// ---- Stats ----
function calendrier() {
  const auj = aujourdhui(), lundi = ajouterJours(auj, -((jourSemaine(auj) + 6) % 7) - 77);
  let cases = "";
  for (let i = 0; i < 84; i++) {
    const j = ajouterJours(lundi, i), h = d.historique[j], seance = !!JOURS_SEANCE[jourSemaine(j)];
    let c = h === "fait" ? "ok" : h === "rate" ? "ko" : j > auj ? "fut" : (seance && j < auj && j >= d.debut ? "miss" : "");
    if (j === auj) c += " today";
    cases += `<i class="${c}" title="${dateCourte(j)}"></i>`;
  }
  return `<div class="cal">${cases}</div><div class="legend"><span><em class="ok"></em>Faite</span><span><em class="ko"></em>Ratée</span><span><em class="miss"></em>Sans réponse</span></div>`;
}
function vueStats() {
  const s = stats(d), dernier = dernierPoids(d), recs = Object.entries(d.records);
  return carteNiveau() + `<div class="tiles">
      <div class="tile"><div class="v num">${s.semaine}</div><div class="l">Semaine du programme</div></div>
      <div class="tile"><div class="v num">🔥 ${s.serie}</div><div class="l">Série en cours</div></div>
      <div class="tile"><div class="v num ok-txt">${s.faites}</div><div class="l">Séances faites</div></div>
      <div class="tile"><div class="v num ko-txt">${s.ratees}</div><div class="l">Séances ratées</div></div>
      <div class="tile"><div class="v num">${s.taux} %</div><div class="l">Réussite</div></div>
      <div class="tile" onclick="aller('badges')"><div class="v num">${s.badges}/${s.totalBadges}</div><div class="l">Badges 🏅</div></div></div>
    <div class="card" onclick="aller('poids')"><div class="h2">⚖️ Poids <small>objectif ${g(d.objectif)} kg</small></div>
      ${dernier != null ? `<div class="wbig"><b class="num">${g(dernier)} kg</b><span class="up">${signe(gainPoids(d))} kg</span></div>` : '<div class="muted">Pas encore de pesée.</div>'}</div>
    <div class="card"><div class="h2">🏆 Records</div><div class="recs">${recs.length
      ? recs.map(([n, v]) => `<div><span>${esc(n)}</span><span class="num accent-txt">${v}</span></div>`).join("")
      : '<span class="muted">Tes records apparaîtront après ta première séance guidée.</span>'}</div></div>
    <div class="card"><div class="h2">📅 12 dernières semaines</div>${calendrier()}</div>`;
}

// ---- Badges ----
function vueBadges() {
  const n = d.badges.length;
  return `<div class="h2 page-h">🏅 Tes badges <small>${n} / ${BADGES.length}</small></div>
    <div class="bar" style="margin-bottom:14px"><i style="width:${Math.round(100 * n / BADGES.length)}%"></i></div>
    <div class="bgrid">${BADGES.map(([id, e, nom, cond]) => {
      const on = d.badges.includes(id);
      return `<div class="badge ${on ? "on" : "off"}"><span class="e">${on ? e : "🔒"}</span><b>${on ? nom : "???"}</b><small>${cond}</small></div>`;
    }).join("")}</div>`;
}

// ---- Bilan de la semaine ----
function vueBilan() {
  const b = bilanSemaine(d), n = niveau(d.xp), dernier = dernierPoids(d);
  const cases = [0, 1, 2].map(i => `<i class="${i < b.faites ? "on" : ""}"></i>`).join("");
  return `<div class="card bilan">
    <div class="h2">📋 BILAN DE LA SEMAINE <small>${dateCourte(b.du)} → ${dateCourte(b.au)}</small></div>
    <div class="bilan-big"><b class="num">${b.faites}/3</b><span>séances sur les 7 derniers jours</span></div>
    <div class="boxes">${cases}</div>
    <div class="recs">
      <div><span>🔥 Série en cours</span><span class="num">${serieEnCours(d)}</span></div>
      <div><span>Niveau</span><span>${n.nom} (${d.xp} XP)</span></div>
      <div><span>🏅 Badges</span><span class="num">${d.badges.length}/${BADGES.length}</span></div>
      ${dernier != null ? `<div><span>⚖️ Poids</span><span class="num">${g(dernier)} kg (${signe(gainPoids(d))} kg depuis le début)</span></div>` : ""}
    </div>
    <div class="verdict">${esc(b.verdict)}</div>
    <p class="muted center">${esc(b.prochaine)}</p></div>`;
}

// ---- Réglages et sauvegarde ----
function vueReglages() {
  return `<div class="h2 page-h">⚙️ Réglages</div>
    <div class="card"><div class="h2">👤 Ton prénom</div>
      <div class="wrow"><input id="prenomIn" class="input" type="text" maxlength="30" value="${esc(d.prenom)}" autocomplete="off">
      <button class="cta small sec" onclick="clicPrenom()">OK</button></div></div>

    <div class="card card-blue"><div class="h2">💾 Sauvegarde</div>
      <p class="muted">Tes données sont enregistrées uniquement dans ce téléphone. Exporte-les de temps en temps et garde le code (Notes, mail…) : il te permet de tout récupérer sur un autre téléphone.</p>
      <button class="cta" onclick="clicExporter()">📤 Exporter mes données</button>
      <div id="exportZone"></div>
      <button class="cta sec" style="margin-top:10px" onclick="clicImporter()">📥 Importer mes données</button></div>

    <div class="card"><div class="h2">🗑 Tout effacer</div>
      <p class="muted">Remet l'appli à zéro (pense à exporter avant).</p>
      <button class="btn-s danger" onclick="clicEffacer()">Effacer toutes mes données</button></div>
    <p class="muted center pad">Coach Street · séances lundi, mercredi, vendredi</p>`;
}
function clicPrenom() {
  const p = $("#prenomIn").value.trim();
  if (!p) { toast("Écris ton prénom"); return; }
  d.prenom = p.slice(0, 30); sauver(); toast("👍 C'est noté, " + d.prenom + " !");
}
function clicExporter() {
  const code = exporterCode(d);
  $("#exportZone").innerHTML = `<textarea id="codeOut" class="input code" readonly rows="4">${esc(code)}</textarea>
    <div class="btn-row"><button class="btn-s" onclick="copierCode()">📋 Copier</button>
    ${navigator.share ? '<button class="btn-s" onclick="partagerCode()">↗️ Partager</button>' : ""}</div>`;
  copierCode();
}
function copierCode() {
  const zone = $("#codeOut"), code = zone.value;
  const secours = () => { zone.focus(); zone.select(); zone.setSelectionRange(0, code.length); try { document.execCommand("copy"); toast("📋 Code copié !"); } catch (e) { toast("Sélectionne le code et copie-le"); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => toast("📋 Code copié ! Colle-le dans Notes ou un mail."), secours);
  else secours();
}
function partagerCode() { attempt(() => navigator.share({ title: "Sauvegarde Coach Street", text: $("#codeOut").value })); }

function clicImporter() {
  fenetre("📥 Importer mes données", `<p class="muted">Colle ici ton code (il commence par COACHSTREET1:).</p>
    <textarea id="codeIn" class="input code" rows="5" placeholder="COACHSTREET1:..." autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>`,
  [["📥 Importer", () => {
    let nouvelles;
    try { nouvelles = importerCode($("#codeIn").value); } catch (e) { toast(e.message); return false; }
    const n = Object.keys(nouvelles.historique).length;
    fenetre("Remplacer tes données ?", `<p class="muted">Le code contient ${n} séance(s), ${nouvelles.poids.length} pesée(s) et ${nouvelles.xp} XP.
      Tes données actuelles de ce téléphone seront remplacées.</p>`, [
      ["✅ Oui, importer", () => {
        d = nouvelles; sauver(); ecrireStockage(CLE_EN_COURS, null);
        jourChoisi = prochainJourSeance(); aller("seance");
        toast(`✅ Données importées. Content de te revoir, ${d.prenom} !`); confettis(false);
      }],
      ["Annuler", null, "sec"]]);
    return false;
  }], ["Annuler", null, "sec"]]);
}
function clicEffacer() {
  fenetre("Tout effacer ?", `<p class="muted">Séances, XP, badges, poids, records : tout sera supprimé de ce téléphone. Impossible de revenir en arrière sans code de sauvegarde.</p>`, [
    ["🗑 Oui, tout effacer", () => { d = donneesVides(); sauver(); ecrireStockage(CLE_EN_COURS, null); aller("seance"); toast("Appli remise à zéro"); }, "danger"],
    ["Annuler", null, "sec"]]);
}


// ============ DÉMARRAGE ============

afficher();

// Fonctionne sans internet (une fois ouverte une première fois)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
