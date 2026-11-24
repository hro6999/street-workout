// =====================================================================
//  questionnaire.js — LE QUESTIONNAIRE ET LE TEST DE NIVEAU
// ---------------------------------------------------------------------
//  S'affiche au premier lancement (et quand on modifie ses réponses).
//  Les écrans, dans l'ordre :
//    bienvenue (avertissement santé, seulement la 1re fois)
//    5 questions : objectif (+ prénom), niveau, matériel, rythme, précisions
//    test-intro : proposer le test de niveau (facultatif)
//    test-0 … test-3 : les 4 épreuves du test (si la personne le fait)
//    pret : le programme est prêt
//
//  Ce fichier utilise des fonctions d'app.js (donnees, sauver, rendre…)
//  et de programme.js (genererProgramme, niveauxDepuisTest…).
// =====================================================================

const QUESTIONS = ["objectif", "niveau", "materiel", "rythme", "precisions"];

let assistant = null;   // null = questionnaire fermé
let chronoTest = null;  // chrono du test de gainage { debut, intervalle }

// Prépare un nouveau questionnaire. mode : "nouveau" ou "modifier"
function nouvelAssistant(mode) {
  const p = donnees.profil;
  const dernierePesee = donnees.poids[donnees.poids.length - 1];
  return {
    mode: mode,
    etape: mode === "nouveau" ? "bienvenue" : QUESTIONS[0],
    testChoisi: false,
    test: {},
    r: {
      prenom: p ? p.prenom : "",
      // Un ancien utilisateur (programme d'origine) choisit lui-même son objectif et son niveau
      objectif: p && !p.classique ? p.objectif : null,
      niveau: p && !p.classique ? p.niveau : null,
      materiel: p ? p.materiel.slice() : [],
      seancesParSemaine: p ? p.seancesParSemaine : 3,
      duree: p && !p.classique ? p.duree : 30,
      poidsActuel: dernierePesee ? String(dernierePesee.kg).replace(".", ",") : "",
      poidsVise: p && p.poidsVise != null ? String(p.poidsVise).replace(".", ",") : "",
      limitations: p ? p.limitations.slice() : [],
    },
  };
}

// La liste des écrans, dans l'ordre
function ordreEtapes() {
  const l = [];
  if (assistant.mode === "nouveau") l.push("bienvenue");
  QUESTIONS.forEach(function (q) { l.push(q); });
  l.push("test-intro");
  if (assistant.testChoisi) epreuvesTest(profilDesReponses()).forEach(function (e, i) { l.push("test-" + i); });
  l.push("pret");
  return l;
}

function allerA(etape) {
  arreterChronoTest();
  assistant.etape = etape;
  rendre();
  window.scrollTo(0, 0);
}

// Le profil tel qu'il ressort des réponses
function profilDesReponses() {
  const r = assistant.r;
  const kg = nombre(r.poidsVise);
  return {
    classique: false,
    prenom: String(r.prenom || "").trim().slice(0, 30),
    objectif: r.objectif || "forme",
    niveau: r.niveau || "debutant",
    materiel: r.materiel.slice(),
    seancesParSemaine: r.seancesParSemaine,
    duree: r.duree,
    poidsVise: kg > 20 && kg < 300 ? arrondi1(kg) : null,
    limitations: r.limitations.slice(),
  };
}

// Enregistre les réponses et (re)crée le programme, sans effacer la progression
function appliquerQuestionnaire() {
  const profil = profilDesReponses();
  const niveauxTest = assistant.testChoisi ? niveauxDepuisTest(assistant.test, profil) : null;
  const ancien = donnees.profil;
  donnees.profil = profil;
  preparerProgression(donnees.progression, profil, niveauxTest);

  const kg = nombre(assistant.r.poidsActuel);
  const dernier = donnees.poids[donnees.poids.length - 1];
  if (kg > 20 && kg < 300 && (!dernier || dernier.kg !== arrondi1(kg))) ajouterPesee(kg);

  if (!donnees.configure || !ancien || ancien.classique || !donnees.debutProgramme) {
    donnees.debutProgramme = new Date().toISOString();
  }
  donnees.seanceSuivante = 0;
  donnees.configure = true;
  donnees.proposerQuestionnaire = false;
  sauver();
  protegerStockage();
}

// ----- Les écrans -----

function vueAssistant() {
  const e = assistant.etape;
  let html = "";
  const iQuestion = QUESTIONS.indexOf(e);
  if (iQuestion >= 0) html += barreProgression("Question " + (iQuestion + 1) + " sur " + QUESTIONS.length, (iQuestion + 1) / QUESTIONS.length);
  if (e.indexOf("test-") === 0 && e !== "test-intro") {
    const n = epreuvesTest(profilDesReponses()).length;
    const i = +e.slice(5);
    html += barreProgression("Test " + (i + 1) + " sur " + n, (i + 1) / n);
  }
  const ecrans = {
    bienvenue: ecranBienvenue, objectif: ecranObjectif, niveau: ecranNiveau, materiel: ecranMateriel,
    rythme: ecranRythme, precisions: ecranPrecisions, "test-intro": ecranTestIntro, pret: ecranPret,
  };
  html += '<div class="assistant">' + (ecrans[e] ? ecrans[e]() : ecranEpreuve(+e.slice(5))) + "</div>";
  return html;
}

function barreProgression(texte, fraction) {
  return '<div class="q-progression" role="progressbar" aria-valuenow="' + Math.round(fraction * 100) + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + texte + '">' +
    '<div class="q-progression-texte">' + texte + "</div>" +
    '<div class="avancement"><div style="width:' + Math.round(fraction * 100) + '%"></div></div></div>';
}

// Boutons du bas : Retour + Suivant
function boutonsNavigation(texteSuivant, actionSuivant) {
  const premier = assistant.mode === "modifier" && assistant.etape === QUESTIONS[0];
  return '<div class="q-nav">' +
    '<button class="btn secondaire" data-action="q-retour">' + (premier ? "✕ Annuler" : "◀ Retour") + "</button>" +
    '<button class="btn principal" data-action="' + (actionSuivant || "q-suivant") + '">' + (texteSuivant || "Suivant ▶") + "</button>" +
    "</div>";
}

// Un gros bouton de choix
function choix(champ, valeur, titre, detail, multiple) {
  const r = assistant.r[champ];
  const actif = multiple ? r.indexOf(valeur) >= 0 : r === valeur;
  return '<button class="q-choix' + (actif ? " actif" : "") + '" data-action="' + (multiple ? "q-basculer" : "q-choix") + '"' +
    ' data-champ="' + champ + '" data-valeur="' + valeur + '" aria-pressed="' + actif + '">' +
    "<span>" + titre + "</span>" + (detail ? "<small>" + detail + "</small>" : "") + "</button>";
}

function ecranBienvenue() {
  return "<h2>Bienvenue 👋</h2>" +
    "<p class=\"q-intro\">Cette appli te propose des séances de sport au poids du corps, <b>adaptées à toi</b> : ton objectif, ton niveau, ton matériel et ton temps.</p>" +
    "<p>Réponds à 5 petites questions (2 minutes) et ton programme est prêt.</p>" +
    '<div class="carte avertissement"><h3>⚠️ Avant de commencer</h3>' +
    "<p>En cas de <b>douleur</b> pendant un exercice, <b>arrête-toi</b>.</p>" +
    "<p>Si tu as un problème de santé (cœur, tension, blessure, grossesse…), <b>demande l'avis d'un médecin</b> avant de t'entraîner.</p></div>" +
    '<p class="doux">🔒 Tes réponses restent sur ton téléphone. Rien n\'est envoyé sur internet.</p>' +
    '<button class="btn principal geant" data-action="q-suivant">J\'ai compris, on commence</button>' +
    '<p class="q-deja">Tu as une sauvegarde d\'un autre téléphone ?</p>' +
    '<button class="btn secondaire petit" data-action="importer">⬆️ Importer ma sauvegarde</button>' +
    '<input type="file" id="fichier-import" accept=".json,application/json" class="cache">';
}

function ecranObjectif() {
  return "<h2>Faisons connaissance</h2>" +
    '<label class="champ" for="q-prenom">Ton prénom <small>Facultatif</small>' +
    '<input id="q-prenom" type="text" data-q="prenom" maxlength="30" autocomplete="given-name" value="' + echapper(assistant.r.prenom) + '"></label>' +
    '<h3 class="q-question">Quel est ton objectif ?</h3><div class="q-choix-liste">' +
    Object.keys(OBJECTIFS).map(function (k) { return choix("objectif", k, OBJECTIFS[k].emoji + " " + OBJECTIFS[k].nom); }).join("") +
    "</div>" + boutonsNavigation();
}

function ecranNiveau() {
  return '<h2>Comment te sens-tu en sport ?</h2><p class="doux">Pas d\'inquiétude : l\'appli s\'adapte ensuite toute seule.</p><div class="q-choix-liste">' +
    Object.keys(NIVEAUX_RESSENTIS).map(function (k) { return choix("niveau", k, NIVEAUX_RESSENTIS[k].nom, NIVEAUX_RESSENTIS[k].detail); }).join("") +
    "</div>" + boutonsNavigation();
}

function ecranMateriel() {
  const rien = assistant.r.materiel.length === 0;
  return '<h2>Quel matériel as-tu ?</h2><p class="doux">Tu peux en choisir plusieurs. Sans matériel, tout se fait au sol, avec une chaise ou une table.</p><div class="q-choix-liste">' +
    '<button class="q-choix' + (rien ? " actif" : "") + '" data-action="q-aucun" data-champ="materiel" aria-pressed="' + rien + '"><span>🏠 Rien (exercices au sol)</span></button>' +
    Object.keys(MATERIELS).map(function (k) { return choix("materiel", k, MATERIELS[k].emoji + " " + MATERIELS[k].nom, null, true); }).join("") +
    "</div>" + boutonsNavigation();
}

function ecranRythme() {
  const r = assistant.r;
  let html = "<h2>Ton rythme</h2>" +
    '<h3 class="q-question">Combien de séances par semaine ?</h3><div class="q-rangee">';
  [2, 3, 4, 5, 6].forEach(function (n) {
    html += '<button class="q-choix rond' + (r.seancesParSemaine === n ? " actif" : "") + '" data-action="q-nombre" data-champ="seancesParSemaine" data-valeur="' + n + '" aria-pressed="' + (r.seancesParSemaine === n) + '">' + n + "</button>";
  });
  html += '</div><p class="doux">Conseil : 3 séances, c\'est idéal pour commencer.</p>' +
    '<h3 class="q-question">Combien de temps par séance ?</h3><div class="q-rangee">';
  DUREES.forEach(function (n) {
    html += '<button class="q-choix rond' + (r.duree === n ? " actif" : "") + '" data-action="q-nombre" data-champ="duree" data-valeur="' + n + '" aria-pressed="' + (r.duree === n) + '">' + n + "<small>min</small></button>";
  });
  return html + "</div>" + boutonsNavigation();
}

function ecranPrecisions() {
  const r = assistant.r;
  const aucune = r.limitations.length === 0;
  return '<h2>Dernières précisions</h2><p class="doux">Tout est facultatif sur cet écran.</p>' +
    '<h3 class="q-question">As-tu mal quelque part ?</h3><p class="doux">L\'appli évitera ou remplacera les exercices concernés.</p><div class="q-choix-liste deux">' +
    '<button class="q-choix' + (aucune ? " actif" : "") + '" data-action="q-aucun" data-champ="limitations" aria-pressed="' + aucune + '"><span>👍 Aucune douleur</span></button>' +
    Object.keys(LIMITATIONS).map(function (k) { return choix("limitations", k, LIMITATIONS[k], null, true); }).join("") +
    "</div>" +
    '<h3 class="q-question">Ton poids</h3>' +
    '<div class="q-deux-champs">' +
    '<label class="champ" for="q-poids">Poids actuel (kg)<input id="q-poids" type="text" inputmode="decimal" data-q="poidsActuel" autocomplete="off" value="' + echapper(r.poidsActuel) + '"></label>' +
    '<label class="champ" for="q-vise">Poids visé (kg)<input id="q-vise" type="text" inputmode="decimal" data-q="poidsVise" autocomplete="off" value="' + echapper(r.poidsVise) + '"></label>' +
    "</div>" +
    boutonsNavigation();
}

function ecranTestIntro() {
  const modifier = assistant.mode === "modifier";
  return "<h2>Petit test de niveau</h2>" +
    "<p>4 exercices rapides (environ 5 minutes) pour que l'appli choisisse le bon niveau de départ : pompes, tractions (ou tirage sous une table), gainage et abdos.</p>" +
    '<p class="doux">Fais chaque exercice au maximum de ce que tu peux, sans te faire mal, avec 1 à 2 minutes de pause entre chaque.</p>' +
    '<button class="btn principal geant" data-action="q-test-oui">✅ Faire le test (conseillé)</button>' +
    '<button class="btn secondaire" data-action="q-test-non">' + (modifier ? "Garder mes niveaux actuels" : "Passer : utiliser mon niveau ressenti") + "</button>" +
    '<button class="btn secondaire petit" data-action="q-retour">◀ Retour</button>';
}

function ecranEpreuve(i) {
  const e = epreuvesTest(profilDesReponses())[i];
  const valeur = assistant.test[e.id] != null ? assistant.test[e.id] : 0;
  let html = "<h2>" + e.nom + "</h2>" + ANIM.anime(e.anim, "grande") +
    '<p class="q-intro">' + e.consigne + "</p>";
  if (e.unite === "sec") {
    html += '<button class="btn principal" data-action="q-chrono" id="q-chrono">' + (chronoTest ? "⏹ Stop" : "▶ Démarrer le chrono") + "</button>";
  }
  html += '<label class="champ centre" for="q-test">' + (e.unite === "sec" ? "Secondes tenues" : "Nombre fait") + "</label>" +
    '<div class="q-compteur">' +
    '<button class="btn-rond" data-action="q-test-moins" aria-label="moins">−</button>' +
    '<input id="q-test" type="number" inputmode="numeric" min="0" data-q="test" value="' + valeur + '">' +
    '<button class="btn-rond" data-action="q-test-plus" aria-label="plus">+</button></div>' +
    boutonsNavigation(i === epreuvesTest(profilDesReponses()).length - 1 ? "Voir mon programme ▶" : "Suivant ▶");
  return html;
}

function ecranPret() {
  const prog = genererProgramme(donnees.profil);
  let html = "<h2>Ton programme est prêt 🎉</h2>" +
    "<p>" + (prenom() ? echapper(prenom()) + ", voici" : "Voici") + " tes séances. Tu peux tout changer plus tard dans Réglages.</p>";
  prog.seances.forEach(function (s, k) {
    html += '<div class="carte"><h3>' + (prog.seances.length > 1 ? "Séance " + "AB"[k] : "Ta séance") + "</h3>" +
      '<ul class="liste-plan">' + s.map(function (e) {
        const f = famille(e.famille);
        const p = donnees.progression[e.famille];
        const niv = f.niveaux[p.niveau];
        return "<li>" + vignette(f.id, p.niveau) + "<div><b>" + niv.nom + "</b>" +
          '<div class="doux">' + f.nom + " · repos " + e.repos + " s</div></div>" +
          '<span class="cible">' + texteObjectif(e.series, niv, p.objectif) + "</span></li>";
      }).join("") + "</ul></div>";
  });
  if (prog.seances.length > 1) html += '<p class="doux">Les séances A et B s\'alternent pour travailler tout le corps.</p>';
  html += '<p class="doux">🌿 Toutes les 5 semaines, une semaine plus légère te permet de récupérer.</p>' +
    '<button class="btn principal geant" data-action="q-fin">🚀 C\'est parti !</button>';
  return html;
}

// ----- Le chrono du test de gainage -----
function arreterChronoTest() {
  if (chronoTest) { clearInterval(chronoTest.intervalle); chronoTest = null; }
}

// ----- Saisie dans les champs du questionnaire -----
function saisieQuestionnaire(t) {
  if (!assistant) return;
  if (t.dataset.q === "test") {
    const id = epreuvesTest(profilDesReponses())[+assistant.etape.slice(5)].id;
    const v = parseInt(t.value, 10);
    assistant.test[id] = isNaN(v) ? 0 : Math.max(0, v);
  } else {
    assistant.r[t.dataset.q] = t.value;
  }
}

function changerTest(sens) {
  const e = epreuvesTest(profilDesReponses())[+assistant.etape.slice(5)];
  const pas = e.unite === "sec" ? 5 : 1;
  assistant.test[e.id] = Math.max(0, (assistant.test[e.id] || 0) + sens * pas);
  el("q-test").value = assistant.test[e.id];
}

// ----- Les actions du questionnaire (ajoutées à "actions" dans app.js) -----
const ACTIONS_QUESTIONNAIRE = {
  "q-suivant": function () {
    const e = assistant.etape;
    if (e === "objectif" && !assistant.r.objectif) { afficherToast("Choisis ton objectif 🙂"); return; }
    if (e === "niveau" && !assistant.r.niveau) { afficherToast("Choisis ton niveau 🙂"); return; }
    if (e === "precisions") {
      const a = String(assistant.r.poidsActuel).trim(), v = String(assistant.r.poidsVise).trim();
      if ((a && !(nombre(a) > 20 && nombre(a) < 300)) || (v && !(nombre(v) > 20 && nombre(v) < 300))) {
        afficherToast("Poids en kg, par exemple 72,5 (ou laisse vide)");
        return;
      }
    }
    const l = ordreEtapes();
    const i = l.indexOf(e);
    if (l[i + 1] === "pret") appliquerQuestionnaire();
    allerA(l[i + 1]);
  },

  "q-retour": function () {
    const l = ordreEtapes();
    const i = l.indexOf(assistant.etape);
    if (i <= 0 || (assistant.mode === "modifier" && assistant.etape === QUESTIONS[0])) {
      if (assistant.mode === "modifier") {
        arreterChronoTest();
        assistant = null;
        rendre();
      }
      return;
    }
    allerA(l[i - 1]);
  },

  "q-choix": function (b) {
    assistant.r[b.dataset.champ] = b.dataset.valeur;
    rendre();
  },

  "q-nombre": function (b) {
    assistant.r[b.dataset.champ] = +b.dataset.valeur;
    rendre();
  },

  "q-basculer": function (b) {
    const liste = assistant.r[b.dataset.champ];
    const i = liste.indexOf(b.dataset.valeur);
    if (i >= 0) liste.splice(i, 1); else liste.push(b.dataset.valeur);
    rendre();
  },

  "q-aucun": function (b) {
    assistant.r[b.dataset.champ] = [];
    rendre();
  },

  "q-test-oui": function () {
    assistant.testChoisi = true;
    assistant.test = {};
    allerA("test-0");
  },

  "q-test-non": function () {
    assistant.testChoisi = false;
    appliquerQuestionnaire();
    allerA("pret");
  },

  "q-test-moins": function () { changerTest(-1); },
  "q-test-plus": function () { changerTest(+1); },

  "q-chrono": function () {
    const e = epreuvesTest(profilDesReponses())[+assistant.etape.slice(5)];
    if (chronoTest) {
      const secondes = Math.round((Date.now() - chronoTest.debut) / 1000);
      arreterChronoTest();
      assistant.test[e.id] = secondes;
      sonFin();
      el("q-test").value = secondes;
      el("q-chrono").textContent = "▶ Recommencer le chrono";
      afficherToast("Bravo : " + secondes + " secondes ! 💪");
      return;
    }
    debloquerSon();
    chronoTest = { debut: Date.now(), intervalle: null };
    el("q-chrono").textContent = "⏹ Stop";
    el("q-test").value = 0;
    chronoTest.intervalle = setInterval(function () {
      const champ = el("q-test");
      if (!champ || !chronoTest) { arreterChronoTest(); return; }
      champ.value = Math.round((Date.now() - chronoTest.debut) / 1000);
    }, 250);
  },

  "q-fin": function () {
    assistant = null;
    vueActuelle = "seance";
    rendre();
    window.scrollTo(0, 0);
  },
};
