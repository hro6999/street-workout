// =====================================================================
//  coach.js — LES RÈGLES DU COACH (copie fidèle du bot Telegram bot.py)
// ---------------------------------------------------------------------
//  Ici, aucun affichage : seulement les calculs.
//   1. Réglages, programme, niveaux, badges, textes
//   2. Les données (création, nettoyage, import/export)
//   3. Les calculs (semaine, série, cibles, niveau, badges, XP)
//   4. Les actions (séance guidée, Fait / Pas fait, ressenti, poids, test)
//   5. Le bilan de la semaine et les stats
//
//  Chaque fonction reçoit "d" = toutes tes données (comme dans le bot).
//  Les dates sont des textes "AAAA-MM-JJ" (ex : "2026-11-25").
// =====================================================================

// ============ 1. RÉGLAGES (identiques au bot) ============

const OBJECTIF_DEFAUT = 70.0;
const SERIES = 3;
const REPOS_DEFAUT = 90;
const JOURS_SEANCE = { 1: "lundi", 3: "mercredi", 5: "vendredi" }; // JavaScript : 0 = dimanche, 1 = lundi…

function E(nom, depart, ajout, unite, anim, famille, ratio) {
  return { nom, depart, ajout, unite, anim, famille: famille || null, ratio: ratio || 0 };
}

const PROGRAMME = {
  lundi: { titre: "💪 Haut du corps", exercices: [
    E("Pompes", 10, 2, "reps", "pompes", "pompes", 0.6),
    E("Tractions", 3, 1, "reps", "tractions", "tractions", 0.6),
    E("Dips sur chaise", 8, 1, "reps", "dips"),
    E("Gainage", 30, 5, "sec", "gainage", "gainage", 0.6)] },
  mercredi: { titre: "🔥 Abdos & jambes", exercices: [
    E("Squats", 15, 2, "reps", "squats"),
    E("Crunchs", 15, 2, "reps", "crunch"),
    E("Relevés de jambes", 8, 1, "reps", "releves"),
    E("Gainage latéral", 20, 5, "sec", "lateral", "gainage", 0.4)] },
  vendredi: { titre: "⚡ Full body", exercices: [
    E("Pompes", 12, 2, "reps", "pompes", "pompes", 0.7),
    E("Tractions", 4, 1, "reps", "tractions", "tractions", 0.7),
    E("Squats sautés", 10, 1, "reps", "sauts"),
    E("Gainage", 40, 5, "sec", "gainage", "gainage", 0.75)] },
};
const JOURS = ["lundi", "mercredi", "vendredi"];

const NIVEAUX = [[0, "🥚 Débutant"], [300, "🌱 Rookie"], [800, "💪 Street Warrior"], [1500, "🔥 Machine"],
  [2500, "⚡ Athlète"], [4000, "🦍 Bête de la barre"], [6000, "👑 Légende du street"]];
const XP_SEANCE = 100, XP_PARFAITE = 20, XP_RECORD = 10, XP_PESEE = 20, XP_TEST = 50, XP_BADGE = 50;

// Mêmes id et même ordre que dans le bot : [id, emoji, nom, condition affichée, test]
const BADGES = [
  ["premiere", "🎯", "Premier pas", "Première séance validée", s => s.faites >= 1],
  ["serie3", "🔥", "En feu", "3 séances d'affilée", s => s.serie >= 3],
  ["serie5", "🚀", "Inarrêtable", "5 séances d'affilée", s => s.serie >= 5],
  ["serie10", "🦾", "Mental d'acier", "10 séances d'affilée", s => s.serie >= 10],
  ["semaine", "📅", "Semaine parfaite", "3 séances dans la même semaine", s => s.semaine >= 3],
  ["total10", "🔟", "Dizaine", "10 séances au total", s => s.faites >= 10],
  ["total25", "🏋️", "Habitué", "25 séances au total", s => s.faites >= 25],
  ["total50", "🏆", "Vétéran", "50 séances au total", s => s.faites >= 50],
  ["retour", "💥", "Retour en force", "Séance faite juste après une ratée", s => s.retour],
  ["perfection", "🎖️", "Perfectionniste", "Tous les objectifs d'une séance atteints", s => s.parfaites >= 1],
  ["record", "📈", "Record battu", "Battre un record perso", s => s.records >= 1],
  ["test", "🧪", "Calibré", "Test de niveau réalisé", s => s.test],
  ["kilo1", "⚖️", "Premier kilo", "+1 kg depuis le début", s => s.gain >= 1],
  ["kilo5", "🍗", "Prise de masse", "+5 kg depuis le début", s => s.gain >= 5],
  ["objectif", "👑", "Objectif atteint", "Objectif de poids atteint", s => s.obj > 0 && s.poids >= s.obj],
];
function badgeParId(id) { return BADGES.find(b => b[0] === id); }
function nomBadge(b) { return b[1] + " " + b[2]; } // ex : "🎯 Premier pas" (comme dans le bot)

// ---- Les textes (identiques au bot) ----
const MOTIVATION_MATIN = [
  "Debout champion, aujourd'hui on construit le physique ! 🔥",
  "Chaque répétition te rapproche de ton objectif. Let's go ! 💪",
  "La discipline bat la motivation. On y va !",
  "Petit à petit, la barre devient facile. C'est parti !",
  "Personne ne va le faire à ta place. À toi de jouer ! ⚡",
  "Le corps suit là où la tête décide. Go ! 🧠",
  "Aujourd'hui tu fais ce que les autres ne font pas. 💯",
];
const BRAVO = ["Énorme ! Séance validée ✅", "Respect, t'as rien lâché 💪",
  "Une de plus au compteur, continue comme ça ! 🔥",
  "Propre ! Le physique se construit séance après séance. 🧱", "Machine ! Tu tiens le rythme 🚀"];
const ENCOURAGEMENT = ["Pas grave, on rebondit à la prochaine. 💯",
  "Un jour raté, ce n'est pas un échec. On reprend la série !",
  "Repose-toi bien, la prochaine sera la bonne 💪",
  "Les champions tombent aussi. Ils se relèvent, c'est tout. 🔁"];
const RELANCE_14H = ["Alors, la séance du jour, c'est fait ? 🤔", "Petit check : t'as fait ta séance aujourd'hui ? 💪"];
const RELANCE_18H = ["Hey ! Toujours pas de nouvelles de ta séance… on lâche pas ? 💪",
  "Il reste encore du temps pour la faire, champion ! ⏳"];
const RELANCE_REPORT = "⏰ C'est l'heure ! Tu l'as faite, ta séance ?";
const VERDICTS = {
  0: "Semaine blanche… pas grave, lundi on repart à fond ! 🔁",
  1: "Une séance, c'est mieux que zéro. On vise plus haut la semaine prochaine !",
  2: "Bonne semaine ! Encore un petit effort pour la perfection 💪",
};
const VERDICT_PARFAIT = "Semaine PARFAITE ! Rien à dire, t'es une machine 🔥";

function auHasard(liste) { return liste[Math.floor(Math.random() * liste.length)]; }


// ============ 2. LES DATES ============

// "Aujourd'hui" au format AAAA-MM-JJ (heure du téléphone). Remplaçable pour les tests.
let horloge = () => new Date();
function reglerHorloge(f) { horloge = f; }
function isoDate(x) {
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
function aujourdhui() { return isoDate(horloge()); }
// Nombre de jours entre deux dates "AAAA-MM-JJ"
function joursEntre(a, b) {
  const [y1, m1, j1] = a.split("-").map(Number), [y2, m2, j2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, j2) - Date.UTC(y1, m1 - 1, j1)) / 86400000);
}
function ajouterJours(iso, n) {
  const [y, m, j] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, j + n));
}
function jourSemaine(iso) { // 0 = dimanche … 6 = samedi
  const [y, m, j] = iso.split("-").map(Number);
  return new Date(y, m - 1, j).getDay();
}
function estDateValide(iso) {
  return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) && ajouterJours(iso, 0) === iso;
}

// Arrondi "à la Python" : 2.5 → 2, 3.5 → 4 (pour que les cibles soient exactement celles du bot)
function arrondiPython(x) {
  const bas = Math.floor(x), reste = x - bas;
  if (reste > 0.5) return bas + 1;
  if (reste < 0.5) return bas;
  return bas % 2 === 0 ? bas : bas + 1;
}
const arrondi1 = x => Math.round(x * 10) / 10;
// Affichage d'un nombre comme le bot (61.0 → "61", 61.2 → "61.2")
const g = x => String(arrondi1(x));
// Avec signe : +1.2 / -0.5 / +0
const signe = x => (x >= 0 ? "+" : "") + g(x);


// ============ 3. LES DONNÉES ============

const VERSION_DONNEES = 1;

function donneesVides() {
  return {
    app: "coach-street", v: VERSION_DONNEES,
    prenom: "Champion",
    debut: aujourdhui(),
    historique: {},       // { "2026-11-24": "fait" | "rate" }
    ressentis: {},        // { "2026-11-24": "facile" | "correct" | "dur" }
    ajustements: { lundi: 0, mercredi: 0, vendredi: 0 },
    xp: 0,
    badges: [],
    poids: [],            // [["2026-11-24", 61.2], …]
    objectif: OBJECTIF_DEFAUT,
    records: {},          // { "Pompes": 16 }
    test: null,           // { pompes, tractions, gainage }
    parfaites: 0,
    nb_records: 0,
    repos: REPOS_DEFAUT,  // temps de repos choisi (90 ou 120 s)
    reporte: null,        // heure (en ms) jusqu'à laquelle "Reporter" cache la question
  };
}

// Nettoie des données (venant du téléphone, d'un import ou du bot) : tout ce qui
// est abîmé ou manquant est remplacé par la valeur par défaut.
function normaliser(brut) {
  const d = donneesVides();
  if (!brut || typeof brut !== "object") return d;
  const entier = (x, def) => (Number.isFinite(+x) ? Math.round(+x) : def);

  if (typeof brut.prenom === "string" && brut.prenom.trim()) d.prenom = brut.prenom.trim().slice(0, 30);
  if (estDateValide(brut.debut)) d.debut = brut.debut;
  if (brut.historique && typeof brut.historique === "object") {
    for (const [j, v] of Object.entries(brut.historique)) if (estDateValide(j) && (v === "fait" || v === "rate")) d.historique[j] = v;
  }
  if (brut.ressentis && typeof brut.ressentis === "object") {
    for (const [j, v] of Object.entries(brut.ressentis)) if (estDateValide(j) && ["facile", "correct", "dur"].includes(v)) d.ressentis[j] = v;
  }
  if (brut.ajustements && typeof brut.ajustements === "object") {
    for (const j of JOURS) d.ajustements[j] = Math.max(-3, Math.min(3, entier(brut.ajustements[j], 0)));
  }
  d.xp = Math.max(0, entier(brut.xp, 0));
  if (Array.isArray(brut.badges)) d.badges = [...new Set(brut.badges.filter(b => badgeParId(b)))];
  if (Array.isArray(brut.poids)) {
    const parJour = {};
    for (const p of brut.poids) {
      if (Array.isArray(p) && estDateValide(p[0]) && +p[1] >= 30 && +p[1] <= 250) parJour[p[0]] = arrondi1(+p[1]);
    }
    d.poids = Object.keys(parJour).sort().map(j => [j, parJour[j]]);
  }
  if (+brut.objectif >= 30 && +brut.objectif <= 250) d.objectif = arrondi1(+brut.objectif);
  if (brut.records && typeof brut.records === "object") {
    for (const [n, v] of Object.entries(brut.records)) if (Number.isFinite(+v) && +v >= 0) d.records[String(n).slice(0, 40)] = Math.round(+v);
  }
  if (brut.test && typeof brut.test === "object") {
    d.test = {};
    for (const k of ["pompes", "tractions", "gainage"]) d.test[k] = Math.max(0, entier(brut.test[k], 0));
  }
  d.parfaites = Math.max(0, entier(brut.parfaites, 0));
  d.nb_records = Math.max(0, entier(brut.nb_records, 0));
  if (brut.repos === 90 || brut.repos === 120) d.repos = brut.repos;
  if (Number.isFinite(brut.reporte)) d.reporte = brut.reporte;
  return d;
}

// ---- Sauvegarde : un code texte à copier / coller ----
const PREFIXE_CODE = "COACHSTREET1:";

function exporterCode(d) {
  const json = JSON.stringify(d);
  const octets = new TextEncoder().encode(json);
  let bin = "";
  octets.forEach(o => { bin += String.fromCharCode(o); });
  return PREFIXE_CODE + btoa(bin);
}

// Renvoie les données lues dans le code, ou lance une erreur si le code est invalide
function importerCode(texte) {
  const propre = String(texte || "").replace(/\s+/g, "");
  if (!propre.startsWith(PREFIXE_CODE)) throw new Error("Ce n'est pas un code Coach Street.");
  let brut;
  try {
    const bin = atob(propre.slice(PREFIXE_CODE.length));
    const octets = Uint8Array.from(bin, c => c.charCodeAt(0));
    brut = JSON.parse(new TextDecoder().decode(octets));
  } catch (e) {
    throw new Error("Code incomplet ou abîmé. Recopie-le en entier.");
  }
  if (!brut || typeof brut !== "object" || !brut.historique) throw new Error("Code incomplet ou abîmé. Recopie-le en entier.");
  return normaliser(brut);
}


// ============ 4. LES CALCULS (identiques au bot) ============

function numeroSemaine(d) { return Math.floor(joursEntre(d.debut, aujourdhui()) / 7) + 1; }

function serieEnCours(d) {
  let serie = 0;
  for (const jour of Object.keys(d.historique).sort().reverse()) {
    if (d.historique[jour] !== "fait") break;
    serie++;
  }
  return serie;
}

function gainPoids(d) {
  return d.poids.length ? arrondi1(d.poids[d.poids.length - 1][1] - d.poids[0][1]) : 0;
}
function dernierPoids(d) { return d.poids.length ? d.poids[d.poids.length - 1][1] : null; }

// { index, nom, min, suivant } — suivant = null au niveau max
function niveau(xp) {
  let index = 0;
  NIVEAUX.forEach(([seuil], i) => { if (xp >= seuil) index = i; });
  return { index, nom: NIVEAUX[index][1], min: NIVEAUX[index][0], suivant: index + 1 < NIVEAUX.length ? NIVEAUX[index + 1][0] : null };
}

// Barre en emojis (pour les messages), comme le bot mais aux nouvelles couleurs
function barre(valeur, maximum, taille) {
  taille = taille || 8;
  const plein = maximum ? Math.max(0, Math.min(taille, arrondiPython(taille * valeur / maximum))) : taille;
  return "🟩".repeat(plein) + "⬛".repeat(taille - plein);
}

function etatBadges(d) {
  const hist = d.historique, auj = aujourdhui();
  const lundi = ajouterJours(auj, -((jourSemaine(auj) + 6) % 7));
  const jours = Object.keys(hist).sort();
  const valeurs = Object.values(hist);
  return {
    faites: valeurs.filter(v => v === "fait").length,
    serie: serieEnCours(d),
    semaine: Object.entries(hist).filter(([j, v]) => v === "fait" && j >= lundi).length,
    retour: jours.length >= 2 && hist[jours[jours.length - 1]] === "fait" && hist[jours[jours.length - 2]] === "rate",
    parfaites: d.parfaites, records: d.nb_records, test: !!d.test,
    gain: gainPoids(d), poids: dernierPoids(d) || 0, obj: d.objectif,
  };
}

// Donne l'XP + les nouveaux badges. Renvoie { texte, nouveaux, monte }
function recompenser(d, xpGagne) {
  const avant = niveau(d.xp).index;
  const etat = etatBadges(d);
  const nouveaux = BADGES.filter(b => !d.badges.includes(b[0]) && b[4](etat)).map(b => b[0]);
  d.badges.push(...nouveaux);
  const total = xpGagne + XP_BADGE * nouveaux.length;
  d.xp += total;
  const lignes = total ? [`✨ +${total} XP`] : [];
  for (const id of nouveaux) { const b = badgeParId(id); lignes.push(`🏅 Nouveau badge : ${nomBadge(b)} — ${b[3]}`); }
  const apres = niveau(d.xp);
  const monte = apres.index > avant;
  if (monte) lignes.push(`\n🎉 NIVEAU SUPÉRIEUR ! Tu es maintenant ${apres.nom} 🎉`);
  return { texte: lignes.join("\n"), nouveaux, monte, xp: total };
}

// ---- Les séances ----
function jourDuJour() { return JOURS_SEANCE[jourSemaine(aujourdhui())] || null; }

function prochainJourSeance() {
  let jour = aujourdhui();
  for (let i = 0; i < 7; i++) {
    const nom = JOURS_SEANCE[jourSemaine(jour)];
    if (nom) return nom;
    jour = ajouterJours(jour, 1);
  }
  return "lundi";
}
// Date (AAAA-MM-JJ) de la prochaine séance
function dateProchaineSeance() {
  let jour = aujourdhui();
  for (let i = 0; i < 7; i++) { if (JOURS_SEANCE[jourSemaine(jour)]) return jour; jour = ajouterJours(jour, 1); }
  return jour;
}

function semaineEffective(d, nomJour) { return Math.max(1, numeroSemaine(d) + (d.ajustements[nomJour] || 0)); }

function cible(d, ex, effective) {
  let depart = ex.depart;
  const test = d.test;
  if (test && ex.famille && test[ex.famille]) depart = Math.max(1, arrondiPython(test[ex.famille] * ex.ratio));
  return depart + ex.ajout * (effective - 1);
}

// Les 4 exercices de la séance avec leur cible : [{nom, cible, unite, anim}]
function seanceExos(d, nomJour) {
  const eff = semaineEffective(d, nomJour);
  return PROGRAMME[nomJour].exercices.map(ex => ({ nom: ex.nom, cible: cible(d, ex, eff), unite: ex.unite, anim: ex.anim }));
}

// Les petites notes sous la séance (comme le bot)
function notesSeance(d, nomJour) {
  const semaine = numeroSemaine(d), eff = semaineEffective(d, nomJour), notes = [];
  if (eff !== semaine) notes.push(`🎚 Niveau ajusté selon ton ressenti (${eff - semaine > 0 ? "+" : ""}${eff - semaine})`);
  if (d.test) notes.push("🧪 Programme calibré sur ton test de niveau");
  notes.push("🍽 Après la séance : une collation riche (protéines + glucides).");
  return notes;
}


// ============ 5. LES ACTIONS ============

function appliquerRessenti(d, nomJour, valeur) {
  const ajust = d.ajustements[nomJour] || 0;
  let reponse;
  if (valeur === "facile") {
    d.ajustements[nomJour] = Math.min(ajust + 1, 3);
    reponse = "😎 Noté ! La prochaine fois, ça montera d'un cran.";
  } else if (valeur === "dur") {
    d.ajustements[nomJour] = Math.max(ajust - 1, -3);
    reponse = "🥵 Noté ! On allège un peu la prochaine fois, récupère bien.";
  } else {
    reponse = "👍 Parfait, on garde ce rythme.";
  }
  d.ressentis[aujourdhui()] = valeur;
  return reponse;
}

// Fin de la séance guidée. data = { jour, res: {"Pompes": [12, 11, 10]}, ressenti, duree }
// Renvoie { texte, parfaite, nouveauxRecords, recompense }
function validerSeance(d, data) {
  const jour = aujourdhui();
  const nomJour = PROGRAMME[data.jour] ? data.jour : prochainJourSeance();
  const exos = seanceExos(d, nomJour);
  const cibles = {}, unites = {};
  exos.forEach(e => { cibles[e.nom] = e.cible; unites[e.nom] = e.unite; });
  const resultats = {};
  for (const [n, vals] of Object.entries(data.res || {})) {
    if (vals && vals.length && n in cibles) resultats[n] = vals.map(v => Math.max(0, Math.round(+v) || 0));
  }

  const parfaite = Object.keys(resultats).length > 0 && Object.entries(cibles).every(([n, c]) =>
    (resultats[n] || []).length >= SERIES && Math.min(...resultats[n]) >= c);
  const nouveauxRecords = [];
  for (const [nom, vals] of Object.entries(resultats)) {
    const meilleur = Math.max(...vals), avant = d.records[nom];
    if (avant == null || meilleur > avant) {
      if (avant != null) {
        nouveauxRecords.push(`📈 Record ${nom} : ${meilleur} (avant ${avant})`);
        d.nb_records++;
      }
      d.records[nom] = meilleur;
    }
  }

  const deja = d.historique[jour] === "fait";
  d.historique[jour] = "fait";
  if (parfaite) d.parfaites++;
  const ressenti = appliquerRessenti(d, nomJour, data.ressenti || "correct");
  const xp = deja ? 0 : XP_SEANCE + (parfaite ? XP_PARFAITE : 0) + XP_RECORD * nouveauxRecords.length;
  const recompense = recompenser(d, xp);
  d.reporte = null;

  const duree = Math.max(0, Math.round(+data.duree || 0));
  let reps = 0;
  for (const [n, v] of Object.entries(resultats)) if (unites[n] === "reps") reps += v.reduce((a, b) => a + b, 0);
  const lignes = [auHasard(BRAVO),
    `${PROGRAMME[nomJour].titre} en ${Math.floor(duree / 60)} min ${String(duree % 60).padStart(2, "0")} s — ${reps} répétitions`];
  if (parfaite) lignes.push("🎖️ Séance PARFAITE : tous les objectifs atteints !");
  lignes.push(...nouveauxRecords);
  lignes.push(`🔥 Série : ${serieEnCours(d)} séance(s) d'affilée`);
  if (deja) lignes.push("(Séance du jour déjà comptée : pas d'XP en plus, mais tes records sont à jour 😉)");
  lignes.push("", ressenti);
  if (recompense.texte) lignes.push("", recompense.texte);
  return { texte: lignes.join("\n"), parfaite, nouveauxRecords, recompense, reps, duree };
}

// Bouton "✅ Fait" (séance faite sans la séance guidée)
// Renvoie null si la journée est déjà notée
function marquerFait(d) {
  const jour = aujourdhui();
  if (jour in d.historique) return null;
  d.historique[jour] = "fait";
  d.reporte = null;
  const recompense = recompenser(d, XP_SEANCE);
  const texte = `${auHasard(BRAVO)}\n🔥 Série : ${serieEnCours(d)} séance(s) d'affilée\n\n${recompense.texte}`;
  return { texte, recompense };
}

// Bouton "❌ Pas fait" : la séance compte comme ratée (la série repart à 0)
function marquerRate(d) {
  const jour = aujourdhui();
  if (jour in d.historique) return null;
  d.historique[jour] = "rate";
  d.reporte = null;
  return { texte: auHasard(ENCOURAGEMENT) };
}

// Bouton "⏰ Reporter" : la question revient dans 2 heures
function reporter(d) {
  d.reporte = horloge().getTime() + 2 * 3600 * 1000;
  return "OK, je te relance dans 2 heures ⏰";
}

// Faut-il poser la question "c'est fait ?" maintenant ? Renvoie le texte de la question ou null.
function questionBilan(d) {
  if (!jourDuJour() || aujourdhui() in d.historique) return null;
  const maintenant = horloge();
  if (d.reporte && maintenant.getTime() < d.reporte) return null;
  if (d.reporte) return RELANCE_REPORT;
  const h = maintenant.getHours();
  if (h >= 18) return auHasard(RELANCE_18H);
  if (h >= 14) return auHasard(RELANCE_14H);
  return "Tu as fait ta séance sans la séance guidée ? Dis-le moi ici 👇";
}

function lirePoids(texte) {
  const valeur = parseFloat(String(texte).replace(",", "."));
  if (!(valeur >= 30 && valeur <= 250)) throw new Error("Poids invalide 🤔 Écris par exemple 61.2 (entre 30 et 250 kg)");
  return arrondi1(valeur);
}

// Une seule pesée par jour : une nouvelle pesée le même jour remplace l'ancienne
function enregistrerPoids(d, valeur) {
  const jour = aujourdhui(), obj = d.objectif;
  d.poids = d.poids.filter(p => p[0] !== jour).concat([[jour, valeur]]);
  const recompense = recompenser(d, XP_PESEE);
  const gain = gainPoids(d), debut = d.poids[0][1];
  const reste = arrondi1(Math.abs(obj - valeur));
  const atteint = objectifAtteint(d);
  const progression = obj !== debut ? barre(Math.abs(valeur - debut), Math.abs(obj - debut)) : barre(1, 1);
  const texte = `⚖️ ${g(valeur)} kg enregistré !\nDepuis le début : ${signe(gain)} kg\n`
    + (atteint ? "🎯 OBJECTIF ATTEINT !\n" : `Encore ${g(reste)} kg avant tes ${g(obj)} kg 🎯\n`)
    + `${progression}\n\n${recompense.texte}`;
  return { texte, recompense };
}

// Objectif atteint ? (dans le bon sens : prise ou perte de poids)
function objectifAtteint(d) {
  if (!d.poids.length) return false;
  const debut = d.poids[0][1], valeur = dernierPoids(d), obj = d.objectif;
  return (obj >= debut && valeur >= obj) || (obj < debut && valeur <= obj);
}
// Progression vers l'objectif, de 0 à 1
function progressionObjectif(d) {
  if (!d.poids.length) return 0;
  const debut = d.poids[0][1], valeur = dernierPoids(d), obj = d.objectif;
  if (obj === debut) return 1;
  return Math.max(0, Math.min(1, Math.abs(valeur - debut) / Math.abs(obj - debut)));
}

function changerObjectif(d, texte) {
  d.objectif = lirePoids(texte);
  return `🎯 Objectif enregistré : ${g(d.objectif)} kg. On y va ! 💪`;
}

function enregistrerTest(d, vals) {
  d.test = {};
  for (const k of ["pompes", "tractions", "gainage"]) d.test[k] = Math.max(0, Math.round(+vals[k]) || 0);
  const x = d.test;
  const recompense = recompenser(d, XP_TEST);
  const texte = `🧪 Test enregistré : ${x.pompes} pompes, ${x.tractions} tractions, ${x.gainage} s de gainage.\n`
    + "Ton programme est maintenant calibré sur ton vrai niveau 💪\n\n" + recompense.texte;
  return { texte, recompense };
}


// ============ 6. STATS ET BILAN DE LA SEMAINE ============

function stats(d) {
  const valeurs = Object.values(d.historique);
  const faites = valeurs.filter(v => v === "fait").length, ratees = valeurs.filter(v => v === "rate").length;
  return {
    faites, ratees,
    taux: faites + ratees ? arrondiPython(100 * faites / (faites + ratees)) : 0,
    serie: serieEnCours(d), semaine: numeroSemaine(d), niveau: niveau(d.xp),
    badges: d.badges.length, totalBadges: BADGES.length,
  };
}

function bilanSemaine(d) {
  const debut = ajouterJours(aujourdhui(), -6);
  const faites = Object.entries(d.historique).filter(([j, v]) => v === "fait" && j >= debut).length;
  const ratees = Object.entries(d.historique).filter(([j, v]) => v === "rate" && j >= debut).length;
  const ecoules = joursEntre(d.debut, aujourdhui());
  const dans = 7 - (((ecoules % 7) + 7) % 7);
  return {
    du: debut, au: aujourdhui(), faites, ratees,
    verdict: faites in VERDICTS ? VERDICTS[faites] : VERDICT_PARFAIT,
    prochaine: `Semaine ${numeroSemaine(d) + 1} ${dans === 1 ? "demain" : "dans " + dans + " jours"} : les répétitions augmentent ! 📈`,
  };
}


// Pour les tests automatiques (node tests.js) — ignoré par le navigateur
if (typeof module !== "undefined") {
  module.exports = {
    PROGRAMME, JOURS, NIVEAUX, BADGES, SERIES, MOTIVATION_MATIN, BRAVO, ENCOURAGEMENT, VERDICTS, VERDICT_PARFAIT,
    reglerHorloge, aujourdhui, ajouterJours, jourSemaine, arrondiPython, donneesVides, normaliser,
    exporterCode, importerCode, numeroSemaine, serieEnCours, gainPoids, niveau, etatBadges, recompenser,
    prochainJourSeance, semaineEffective, cible, seanceExos, notesSeance, appliquerRessenti, validerSeance,
    marquerFait, marquerRate, reporter, questionBilan, lirePoids, enregistrerPoids, objectifAtteint,
    changerObjectif, enregistrerTest, stats, bilanSemaine, progressionObjectif,
  };
}
