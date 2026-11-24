// =====================================================================
//  app.js — L'AFFICHAGE ET LES ACTIONS DE L'APPLI
// ---------------------------------------------------------------------
//  Organisation du fichier :
//   1. Les données (chargement / sauvegarde dans le téléphone)
//   2. Petits outils (dates, formats, fenêtre de confirmation…)
//   3. Les écrans : Séance, Progrès, Poids, Réglages, Comment ça marche
//      (le questionnaire et le test sont dans questionnaire.js)
//   4. Les actions (ce qui se passe quand on touche un bouton)
//   5. Le minuteur, le son et la vibration
//   6. Les graphiques
//   7. Le démarrage
// =====================================================================
"use strict";

// ============ 1. LES DONNÉES ============

const CLE_STOCKAGE = "street-workout-donnees";

function chargerDonnees() {
  let brut = null;
  try {
    const texte = localStorage.getItem(CLE_STOCKAGE);
    if (texte) brut = JSON.parse(texte);
  } catch (e) {
    console.error("Impossible de lire les données", e);
  }
  // migrerDonnees (programme.js) met les anciennes données au format actuel
  return completerDonnees(migrerDonnees(brut));
}

// Vérifie que chaque exercice du programme a bien une progression valide
function completerDonnees(d) {
  if (d.configure && d.profil) preparerProgression(d.progression, d.profil);
  return d;
}

// Demande au téléphone de ne jamais effacer les données de l'appli tout seul
function protegerStockage() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () { /* ignoré */ });
  }
}

function sauver() {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
  } catch (e) {
    afficherToast("⚠️ Impossible d'enregistrer les données sur cet appareil.");
  }
}

let donnees = chargerDonnees();
let vueActuelle = "seance";
let vuePrecedente = "seance";     // pour revenir en arrière depuis « Comment ça marche »
let bilan = null;                 // résumé affiché juste après une séance
let familleGraphique = null;


// ============ 2. PETITS OUTILS ============

function el(id) { return document.getElementById(id); }

// Nom de l'animation d'un niveau (voir animations.js), ex. "pompes-2"
function cleAnim(familleId, niveau) { return familleId + "-" + niveau; }
// Petite image carrée d'un exercice
function vignette(familleId, niveau, classe) { return ANIM.vignette(cleAnim(familleId, niveau), classe); }

function suffixe(niv) { return niv.unite === "sec" ? " s" : ""; }
function texteObjectif(nbSeries, niv, objectif) { return nbSeries + " × " + objectif + suffixe(niv); }
function texteUnite(niv) { return niv.unite === "sec" ? "secondes" : "répétitions"; }

// Protège le texte tapé par la personne (prénom) avant de l'afficher
function echapper(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function dateCourte(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function dateLongue(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) +
    " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function memeJour(a, b) { return new Date(a).toDateString() === new Date(b).toDateString(); }
function joursEntre(a, b) {
  const j1 = new Date(a); j1.setHours(0, 0, 0, 0);
  const j2 = new Date(b); j2.setHours(0, 0, 0, 0);
  return Math.round((j2 - j1) / 86400000);
}
function formatTemps(secondes) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}
function arrondi1(x) { return Math.round(x * 10) / 10; }
function nombre(texte) { return parseFloat(String(texte).replace(",", ".")); }

// Un "score" pour le graphique : 1 = début du niveau 1, 2 = début du niveau 2...
function scoreNiveau(f, etat) {
  const niv = f.niveaux[etat.niveau];
  const fraction = Math.max(0, Math.min(1, (etat.objectif - niv.debut) / (niv.max - niv.debut)));
  return arrondi1(etat.niveau + 1 + fraction * 0.99);
}

// Le programme actuel et ses familles d'exercices
function programmeActuel() { return genererProgramme(donnees.profil); }
function famillesActives() {
  return famillesDuProgramme(programmeActuel()).filter(function (id) { return donnees.progression[id]; });
}
function prenom() { return donnees.profil && donnees.profil.prenom ? donnees.profil.prenom : ""; }

function afficherToast(texte) {
  const t = el("toast");
  t.textContent = texte;
  t.classList.remove("cache");
  clearTimeout(afficherToast.chrono);
  afficherToast.chrono = setTimeout(function () { t.classList.add("cache"); }, 3200);
}

// ----- Fenêtre de confirmation faite dans l'appli (à la place de confirm/alert) -----
// boutons : [{ texte, classe ("principal", "secondaire", "danger"), action: fonction }]
let boutonsModale = [];
function ouvrirModale(titre, html, boutons) {
  boutonsModale = boutons && boutons.length ? boutons : [{ texte: "OK", classe: "principal" }];
  el("modale-titre").textContent = titre;
  el("modale-texte").innerHTML = html || "";
  el("modale-boutons").innerHTML = boutonsModale.map(function (b, i) {
    return '<button class="btn ' + (b.classe || "secondaire") + '" data-action="modale" data-i="' + i + '">' + b.texte + "</button>";
  }).join("");
  el("modale").classList.remove("cache");
  ANIM.activer(el("modale"));
  const premier = el("modale-boutons").querySelector("button");
  if (premier) premier.focus();
}
function fermerModale() {
  el("modale").classList.add("cache");
  el("modale-texte").innerHTML = "";
}


// ============ 3. LES ÉCRANS ============

// Redessine l'écran actuel
function rendre() {
  // Premier lancement : on démarre le questionnaire
  if (!donnees.configure && !assistant) assistant = nouvelAssistant("nouveau");
  document.body.classList.toggle("mode-assistant", !!assistant);
  rendreEntete();
  let html;
  if (assistant) {
    html = vueAssistant();
  } else {
    const ecrans = { seance: vueSeance, progres: vueProgres, poids: vuePoids, reglages: vueReglages, aide: vueAide };
    html = (ecrans[vueActuelle] || vueSeance)();
  }
  el("vue").innerHTML = html;
  document.querySelectorAll(".onglets button").forEach(function (b) {
    b.classList.toggle("actif", b.dataset.vue === vueActuelle);
  });
  dessinerGraphiques();
  ANIM.activer(el("vue")); // fait bouger les personnages de l'écran
}

function rendreEntete() {
  if (!donnees.configure || assistant) { el("compteur-semaine").innerHTML = ""; return; }
  const faites = seancesCetteSemaine(donnees.seances);
  const prevues = donnees.profil.seancesParSemaine;
  let points = "";
  for (let i = 0; i < Math.max(prevues, faites); i++) {
    points += '<span class="point' + (i < faites ? " plein" : "") + '"></span>';
  }
  el("compteur-semaine").innerHTML = points + "<span>" + faites + "/" + prevues + '</span><span class="lecteur">séances cette semaine</span>';
}

// ----- Écran SÉANCE -----
function vueSeance() {
  if (donnees.enCours) return vueSeanceEnCours();
  return vueAccueilSeance();
}

const ENCOURAGEMENTS = [
  "Bravo{p} ! Une séance de plus, c'est une victoire. 💪",
  "Super travail{p} ! Ton corps te remerciera demain.",
  "Tu l'as fait{p} ! La régularité, c'est le vrai secret.",
  "Bien joué{p} ! Petit à petit, on va très loin.",
  "Excellent{p} ! Pense à boire de l'eau et à bien dormir cette nuit.",
  "Chapeau{p} ! Le plus dur, c'était de commencer. 👏",
];

function encouragement() {
  const p = prenom() ? ", " + echapper(prenom()) : "";
  return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)].replace("{p}", p);
}

function carteInvitation() {
  return '<div class="carte invitation">' +
    "<h2>✨ Nouveau : un programme fait pour toi</h2>" +
    "<p>Réponds à 5 petites questions (objectif, matériel, temps disponible, douleurs éventuelles) " +
    "et l'appli adapte ton programme. <b>Ta progression et ton historique sont conservés.</b></p>" +
    '<p class="doux">⚠️ En cas de douleur pendant un exercice, arrête-toi. Si tu as un problème de santé, demande l\'avis d\'un médecin avant de t\'entraîner.</p>' +
    '<button class="btn principal" data-action="personnaliser">Personnaliser mon programme</button>' +
    '<button class="btn secondaire" data-action="plus-tard">Plus tard (garder mon programme actuel)</button>' +
    "</div>";
}

function vueAccueilSeance() {
  let html = "";
  if (donnees.proposerQuestionnaire) html += carteInvitation();

  // Bilan de la séance qui vient d'être terminée
  if (bilan) {
    html += '<div class="carte bilan"><h2>Séance terminée 🎉</h2>' +
      '<p class="encouragement">' + bilan.encouragement + "</p><ul>" +
      bilan.lignes.map(function (b) {
        return "<li>" + vignette(b.famille.id, b.niveau) + "<div><b>" + b.famille.nom + "</b><br>" + b.texte +
          (b.record ? '<div class="record">🏆 ' + b.record + "</div>" : "") + "</div></li>";
      }).join("") +
      "</ul></div>";
  }

  const s = seanceDuJour(donnees);
  const bonjour = prenom() ? "Salut " + echapper(prenom()) + " 👋" : "Salut 👋";
  html += '<div class="carte accueil"><h2>' + bonjour + "</h2>";
  if (s.legere) {
    html += '<p class="legere">🌿 <b>Semaine légère</b> : un peu moins de séries et des objectifs plus faciles, ' +
      "pour laisser ton corps récupérer. Ta progression reprend la semaine prochaine.</p>";
  }
  html += '<p class="doux">' + (s.nom ? "Séance " + s.nom + " · " : "") + s.exercices.length + " exercices · environ " +
    dureeEstimee(s) + " min avec l'échauffement</p>" +
    '<button class="btn principal geant" data-action="commencer">▶ Commencer ma séance du jour</button>' +
    '<button class="btn secondaire" data-action="echauffement">🔥 Échauffement guidé (5 min, conseillé)</button></div>';

  // Conseils selon les dernières séances
  const faites = seancesCetteSemaine(donnees.seances);
  const derniere = donnees.seances[donnees.seances.length - 1];
  const conseils = [];
  if (faites >= donnees.profil.seancesParSemaine) {
    conseils.push("🏅 Objectif de la semaine atteint, bravo !");
  }
  if (derniere && joursEntre(derniere.date, new Date()) === 0) {
    conseils.push("✅ Séance déjà faite aujourd'hui. Repose-toi : les muscles se renforcent pendant le repos.");
  } else if (derniere && joursEntre(derniere.date, new Date()) === 1 && donnees.profil.seancesParSemaine <= 3) {
    conseils.push("💡 Tu t'es entraîné(e) hier. L'idéal : 1 jour de repos entre 2 séances (ex. lundi, mercredi, vendredi).");
  }
  if (conseils.length) {
    html += '<div class="carte">' + conseils.map(function (c) { return "<p>" + c + "</p>"; }).join("") + "</div>";
  }

  // Le programme du jour
  html += '<div class="carte"><h2>Au programme aujourd\'hui</h2><ul class="liste-plan">';
  s.exercices.forEach(function (e) {
    const f = famille(e.famille);
    const niv = f.niveaux[e.niveau];
    html += "<li>" + vignette(f.id, e.niveau) + "<div><b>" + niv.nom + "</b>" +
      '<div class="doux">' + f.nom + " · niveau " + (e.niveau + 1) + "/" + f.niveaux.length + "</div></div>" +
      '<span class="cible">' + texteObjectif(e.series, niv, e.objectif) + "</span></li>";
  });
  html += "</ul></div>";
  html += '<button class="btn secondaire" data-action="aide">❓ Comment ça marche ?</button>';
  return html;
}

function vueSeanceEnCours() {
  const ec = donnees.enCours;
  let total = 0, faites = 0;
  ec.exercices.forEach(function (ex) {
    total += ex.series.length;
    faites += ex.series.filter(function (s) { return s.faite; }).length;
  });

  let html = '<div class="carte"><div class="niveau-titre"><span>Séance en cours' + (ec.legere ? " 🌿" : "") + "</span><span>" +
    faites + " / " + total + " séries</span></div>" +
    '<div class="avancement vert"><div style="width:' + Math.round(faites / total * 100) + '%"></div></div></div>';

  if (ecranEtat === "indisponible") {
    html += '<div class="carte alerte">⚠️ Ton téléphone ne peut pas garder l\'écran allumé tout seul. ' +
      "S'il se verrouille, le minuteur ne sonnera pas. Sur iPhone : <b>Réglages → Luminosité et affichage → " +
      "Verrouillage automatique → Jamais</b> pendant la séance (pense à le remettre après).</div>";
  }

  // Les exercices de la séance : on en affiche UN à la fois, en grand
  const actuel = exerciceActuel();
  html += '<div class="etapes-seance" style="grid-template-columns:repeat(' + ec.exercices.length + ',1fr)">' + ec.exercices.map(function (ex, i) {
    const nbFaites = ex.series.filter(function (s) { return s.faite; }).length;
    const termine = nbFaites === ex.series.length;
    return '<button data-action="voir-exo" data-ex="' + i + '" class="' + (i === actuel ? "actif " : "") + (termine ? "termine" : "") + '"' +
      ' aria-label="Exercice ' + (i + 1) + " : " + famille(ex.famille).nom + '">' + vignette(ex.famille, ex.niveau) +
      "<span>" + (termine ? "✓" : nbFaites + "/" + ex.series.length) + "</span></button>";
  }).join("") + "</div>";

  const ex = ec.exercices[actuel];
  const f = famille(ex.famille);
  const niv = f.niveaux[ex.niveau];
  const repos = ex.repos || f.repos;
  const termine = ex.series.every(function (s) { return s.faite; });
  html += '<div class="carte exo' + (termine ? " termine" : "") + '">' +
    ANIM.anime(cleAnim(ex.famille, ex.niveau), "grande") +
    '<div class="exo-famille">Exercice ' + (actuel + 1) + "/" + ec.exercices.length + " · " + f.nom + " · niveau " + (ex.niveau + 1) + "/" + f.niveaux.length + "</div>" +
    '<h3 class="exo-nom">' + niv.nom + "</h3>" +
    '<div class="objectif">Objectif : <b>' + texteObjectif(ex.series.length, niv, ex.objectif) + "</b><br>" +
    '<span class="doux">' + ex.series.length + " séries de " + ex.objectif + " " + texteUnite(niv) + " · " + repos + " s de repos entre les séries</span></div>" +
    '<p class="desc">' + niv.desc + "</p>" +
    '<h4>Les bons gestes</h4><ul class="points">' + niv.points.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul>" +
    '<h4>À éviter</h4><ul class="erreurs">' + niv.erreurs.map(function (e) { return "<li>" + e + "</li>"; }).join("") + "</ul>";

  // Astuce si la personne a signalé une douleur
  if (f.conseils && donnees.profil) {
    donnees.profil.limitations.forEach(function (l) {
      if (f.conseils[l]) html += '<p class="astuce">🩹 ' + f.conseils[l] + "</p>";
    });
  }

  if (!termine) {
    html += '<button class="btn secondaire" data-action="trop-dur" data-ex="' + actuel + '">😓 Trop dur ?</button>';
  }
  if (niv.unite === "sec" && !termine) {
    html += '<button class="btn principal" data-action="chrono" data-ex="' + actuel + '">⏱️ Lancer le chrono (' + ex.objectif + " s)</button>";
  }

  html += '<p class="doux aide-serie">Après chaque série, ajuste le nombre avec − et + si besoin, puis appuie sur ✓. Le repos se lance tout seul.</p>';
  ex.series.forEach(function (s, j) {
    const bloque = s.faite ? " disabled" : "";
    const attr = ' data-ex="' + actuel + '" data-serie="' + j + '"';
    html += '<div class="serie' + (s.faite ? " faite" : "") + '">' +
      '<span class="serie-num">' + (j + 1) + "<small>série</small></span>" +
      '<button class="btn-rond" data-action="moins"' + attr + bloque + ' aria-label="moins">−</button>' +
      '<input type="number" inputmode="numeric" min="0" value="' + s.valeur + '"' + attr + bloque + ' aria-label="série ' + (j + 1) + '">' +
      '<button class="btn-rond" data-action="plus"' + attr + bloque + ' aria-label="plus">+</button>' +
      '<button class="btn-valider" data-action="' + (s.faite ? "annuler" : "valider") + '"' + attr +
      ' aria-label="' + (s.faite ? "annuler la série " : "valider la série ") + (j + 1) + '">' + (s.faite ? "↺" : "✓") + "</button>" +
      "</div>";
  });
  html += "</div>";

  // Passer d'un exercice à l'autre
  html += '<div class="nav-exo">' +
    '<button class="btn secondaire" data-action="voir-exo" data-ex="' + (actuel - 1) + '"' + (actuel === 0 ? " disabled" : "") + ">◀ Précédent</button>" +
    '<button class="btn secondaire" data-action="voir-exo" data-ex="' + (actuel + 1) + '"' + (actuel === ec.exercices.length - 1 ? " disabled" : "") + ">Suivant ▶</button>" +
    "</div>";

  html += '<button class="btn principal" data-action="terminer">🏁 Terminer la séance</button>' +
    '<button class="btn danger petit" data-action="abandonner">Abandonner la séance</button>';
  return html;
}

// L'exercice affiché pendant la séance. S'il n'est pas encore choisi
// (ou si la séance date d'une ancienne version de l'appli), on prend le
// premier qui a encore des séries à faire.
function exerciceActuel() {
  const ec = donnees.enCours;
  if (typeof ec.actuel === "number" && ec.actuel >= 0 && ec.actuel < ec.exercices.length) return ec.actuel;
  const prochaine = trouverProchaineSerie();
  return prochaine ? prochaine.i : 0;
}

// Les niveaux d'un exercice qu'on peut choisir (selon matériel et douleurs)
function selectsNiveaux() {
  return famillesActives().map(function (id) {
    const f = famille(id);
    const actuel = donnees.progression[id].niveau;
    const options = f.niveaux.map(function (n, i) {
      if (i !== actuel && !niveauPermis(n, donnees.profil)) return "";
      return '<option value="' + i + '"' + (i === actuel ? " selected" : "") + ">" + (i + 1) + ". " + n.nom + "</option>";
    }).join("");
    return '<label class="champ">' + f.nom + '<select id="niv-' + f.id + '">' + options + "</select></label>";
  }).join("");
}

// ----- Écran PROGRÈS -----
function vueProgres() {
  const actives = famillesActives();
  if (!familleGraphique || actives.indexOf(familleGraphique) < 0) familleGraphique = actives[0];

  // Mes niveaux
  let html = '<div class="carte"><h2>Mes niveaux</h2>';
  actives.forEach(function (id) {
    const f = famille(id);
    const p = donnees.progression[id];
    const niv = f.niveaux[p.niveau];
    const fraction = Math.max(0, Math.min(1, (p.objectif - niv.debut) / (niv.max - niv.debut)));
    const global = (p.niveau + fraction) / f.niveaux.length;
    html += '<div class="niveau-ligne">' + vignette(f.id, p.niveau) + '<div class="niveau-texte"><div class="niveau-titre"><span>' + f.nom + "</span>" +
      "<span>Niv. " + (p.niveau + 1) + "/" + f.niveaux.length + "</span></div>" +
      "<div>" + niv.nom + " — objectif <b>" + p.objectif + suffixe(niv) + "</b> par série" +
      ' <span class="doux">(niveau suivant à ' + niv.max + suffixe(niv) + ")</span></div>" +
      '<div class="avancement"><div style="width:' + Math.round(global * 100) + '%"></div></div></div></div>';
  });
  html += "</div>";

  // Records personnels
  html += '<div class="carte"><h2>Mes records 🏆</h2>';
  actives.forEach(function (id) {
    const f = famille(id);
    const p = donnees.progression[id];
    const niv = f.niveaux[p.niveau];
    const record = meilleureSerie(donnees.seances, f.id, p.niveau);
    const plusHaut = Math.max(niveauMaxAtteint(donnees.seances, f.id), p.niveau);
    html += '<div class="niveau-ligne">' + vignette(f.id, p.niveau) + '<div class="niveau-texte"><b>' + f.nom + "</b>" +
      "<div>" + (record === null
        ? '<span class="doux">Pas encore de série au niveau « ' + niv.nom + " »</span>"
        : "Meilleure série en " + niv.nom + " : <b>" + record + " " + texteUnite(niv) + "</b>") +
      "</div>" +
      '<div class="doux">Plus haut niveau : ' + (plusHaut + 1) + " · " + f.niveaux[plusHaut].nom + "</div></div></div>";
  });
  html += "</div>";

  // Statistiques
  let totalReps = 0;
  donnees.seances.forEach(function (s) {
    s.exercices.forEach(function (e) {
      if (e.unite !== "sec") e.faites.forEach(function (n) { totalReps += n; });
    });
  });
  html += '<div class="carte stats">' +
    '<div><div class="chiffre">' + donnees.seances.length + '</div><div class="doux">séances</div></div>' +
    '<div><div class="chiffre">' + seancesCetteSemaine(donnees.seances) + '</div><div class="doux">cette semaine</div></div>' +
    '<div><div class="chiffre">' + totalReps + '</div><div class="doux">répétitions</div></div>' +
    "</div>";

  // Graphique
  html += '<div class="carte"><h2>Ma progression</h2><div class="choix-famille">' +
    actives.map(function (id) {
      return '<button data-action="graph-famille" data-id="' + id + '" class="' +
        (id === familleGraphique ? "actif" : "") + '">' + famille(id).nom + "</button>";
    }).join("") +
    '</div><canvas id="graph-progres" class="graphique"></canvas>' +
    '<p class="doux">La courbe monte quand tu progresses. 1 = début du niveau 1, 2 = début du niveau 2, etc.</p></div>';

  // Historique
  html += '<div class="carte"><h2>Historique</h2>';
  if (donnees.seances.length === 0) {
    html += '<p class="doux">Aucune séance pour l\'instant. La première t\'attend !</p>';
  } else {
    html += '<ul class="historique">';
    donnees.seances.slice().reverse().forEach(function (s) {
      html += '<li><div class="date">' + dateLongue(s.date) + (s.legere ? " · 🌿 semaine légère" : "") + "</div>";
      s.exercices.forEach(function (e) {
        const f = famille(e.famille);
        const unite = e.unite === "sec" ? " s" : "";
        html += '<div class="exo-ligne">' + (e.reussi ? "✅" : "⏸️") + " " + (f && ANIM.existe(cleAnim(f.id, e.niveau)) ? vignette(f.id, e.niveau, "mini") : "") + " " + e.nom + " : " +
          (e.faites.length ? e.faites.join(", ") + unite : "rien") + " (objectif " + e.objectif + unite + ")</div>";
      });
      html += "</li>";
    });
    html += "</ul>";
  }
  html += "</div>";
  return html;
}

// ----- Écran POIDS -----
function vuePoids() {
  const liste = donnees.poids;
  const dernier = liste[liste.length - 1];
  const objectif = donnees.profil.poidsVise;
  const sens = sensPoids(liste, objectif);
  let html = '<div class="carte"><h2>Mon poids</h2>';

  if (dernier) {
    const depart = liste[0].kg;
    html += '<div class="grand-chiffre">' + String(dernier.kg).replace(".", ",") + " kg</div>";
    if (objectif != null) {
      const reste = arrondi1(objectif - dernier.kg);
      let avance = objectif !== depart ? (dernier.kg - depart) / (objectif - depart) : 1;
      avance = Math.max(0, Math.min(1, avance));
      const atteint = (sens > 0 && reste <= 0) || (sens < 0 && reste >= 0) || (sens === 0 && Math.abs(reste) < 0.5);
      html += "<p>Poids visé : <b>" + objectif + " kg</b> · " +
        (atteint ? "atteint 🎉" : "encore " + (reste > 0 ? "+" : "") + String(reste).replace(".", ",") + " kg") + "</p>";
      if (sens !== 0) html += '<div class="avancement vert"><div style="width:' + Math.round(avance * 100) + '%"></div></div>';
    }
    html += '<p class="doux">Départ : ' + String(depart).replace(".", ",") + " kg le " + dateCourte(liste[0].date) + "</p>";
  } else {
    html += '<p class="doux">Aucune pesée pour l\'instant. Le suivi du poids est facultatif.</p>';
  }

  html += '<label class="champ" for="saisie-poids">Nouvelle pesée (kg)<small>Pèse-toi le matin, à jeun, 1 fois par semaine.</small></label>' +
    '<div class="ligne-saisie"><input id="saisie-poids" type="text" inputmode="decimal" autocomplete="off">' +
    '<button class="btn principal" data-action="ajouter-poids">Ajouter</button></div>' +
    '<label class="champ" for="reglage-objectif">Poids visé (kg, facultatif)' +
    '<input id="reglage-objectif" type="text" inputmode="decimal" autocomplete="off" value="' + (objectif != null ? objectif : "") + '"></label></div>';

  if (liste.length) {
    html += '<div class="carte"><h2>Évolution</h2><canvas id="graph-poids" class="graphique"></canvas>' +
      '<p class="doux">' + (objectif != null ? '<span class="legende vert"></span> ton poids visé' : "") +
      (sens !== 0 ? ' · <span class="legende gris"></span> le rythme conseillé (' + (sens > 0 ? "+" + String(RYTHME_IDEAL).replace(".", ",") : "−" + String(RYTHME_IDEAL_PERTE).replace(".", ",")) + " kg par semaine)" : "") +
      "</p></div>";
    html += carteTendance(tendancePoids(liste, objectif));
  }

  if (liste.length) {
    html += '<div class="carte"><h2>Mes pesées</h2>';
    liste.slice().reverse().forEach(function (p, iInverse) {
      const index = liste.length - 1 - iInverse;
      html += '<div class="ligne-poids"><span>' + dateCourte(p.date) + " — <b>" + String(p.kg).replace(".", ",") + " kg</b></span>" +
        '<button class="btn-suppr" data-action="suppr-poids" data-index="' + index + '" aria-label="supprimer la pesée du ' + dateCourte(p.date) + '">✕</button></div>';
    });
    html += "</div>";
  }

  const astuces = {
    muscle: "💡 Pour prendre du muscle : mange un peu plus que d'habitude (3 vrais repas + 1 ou 2 collations), des protéines à chaque repas (œufs, viande, poisson, lentilles, fromage blanc) et dors bien. Vise environ +0,25 à 0,5 kg par semaine.",
    perte: "💡 Pour perdre du poids : garde 3 repas par jour avec beaucoup de légumes et des protéines, limite les boissons sucrées et le grignotage, et bouge chaque jour (la marche compte !). Vise environ −0,25 à 1 kg par semaine, pas plus.",
    force: "💡 Pour gagner en force : mange suffisamment (des protéines à chaque repas) et dors 7 à 9 heures. Le repos fait partie de l'entraînement.",
    forme: "💡 Pour garder la forme : mange varié, bois de l'eau, dors bien et bouge un peu chaque jour. Ton poids devrait rester à peu près stable.",
  };
  html += '<div class="carte"><p class="doux">' + astuces[donnees.profil.objectif] + "</p></div>";
  return html;
}

function carteTendance(t) {
  const vitesse = t.parSemaine != null ? (t.parSemaine > 0 ? "+" : "") + String(t.parSemaine).replace(".", ",") + " kg par semaine" : "";
  const sens = t.sens || 0;
  const textes = {
    attente: "📅 Pèse-toi 1 fois par semaine : ta tendance s'affichera après 2 pesées espacées d'au moins 10 jours.",
    atteint: "🎉 Poids visé atteint ! Tu peux en choisir un nouveau juste au-dessus.",
    bon: "✅ Bon rythme : " + vitesse + ".",
    stagne: sens > 0
      ? "⏸️ Ton poids ne monte presque plus (" + vitesse + "). Ajoute environ 300 kcal par jour, par exemple un grand verre de lait et une banane, ou une poignée d'amandes."
      : "⏸️ Ton poids ne baisse presque plus (" + vitesse + "). Réduis un peu les portions, le sucre et le grignotage, et marche un peu plus chaque jour.",
    baisse: sens > 0
      ? "↘️ Ton poids baisse (" + vitesse + "). Tu ne manges pas assez pour ton entraînement : ajoute une vraie collation chaque jour."
      : "↘️ Ton poids baisse un peu (" + vitesse + "). Vérifie que tu manges assez pour avoir de l'énergie.",
    inverse: "↗️ Ton poids remonte (" + vitesse + "). Pas de panique : surveille les portions et les boissons sucrées cette semaine.",
    rapide: sens > 0
      ? "⚠️ Ça monte vite (" + vitesse + "). Au-delà de 0,5 kg par semaine, une partie risque d'être du gras : réduis un peu les grignotages sucrés."
      : "⚠️ Ça baisse très vite (" + vitesse + "). Plus d'1 kg par semaine, c'est trop : mange un peu plus pour ne pas perdre de muscle ni d'énergie.",
    stable: "✅ Ton poids est stable (" + vitesse + ").",
    hausse: "↗️ Ton poids monte un peu (" + vitesse + ").",
  };
  let html = '<div class="carte"><h2>Ma tendance</h2><p>' + textes[t.type] + "</p>";
  if (t.dateObjectif && t.type !== "atteint") {
    html += '<p class="doux">À ce rythme, poids visé atteint vers ' +
      t.dateObjectif.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) + ".</p>";
  }
  return html + "</div>";
}

// ----- Écran RÉGLAGES -----
function resumeProfil(p) {
  if (p.classique) {
    return '<p>Programme d\'origine (4 exercices : tractions, pompes, abdos, gainage).</p>' +
      '<p class="doux">Réponds au questionnaire pour avoir un programme adapté à ton objectif, ton matériel et ton temps.</p>';
  }
  const materiel = p.materiel.length ? p.materiel.map(function (m) { return MATERIELS[m].nom; }).join(", ") : "Rien (exercices au sol)";
  const douleurs = p.limitations.length ? p.limitations.map(function (l) { return LIMITATIONS[l]; }).join(", ") : "Aucune";
  return '<ul class="resume">' +
    (p.prenom ? "<li><span>Prénom</span><b>" + echapper(p.prenom) + "</b></li>" : "") +
    "<li><span>Objectif</span><b>" + OBJECTIFS[p.objectif].emoji + " " + OBJECTIFS[p.objectif].nom + "</b></li>" +
    "<li><span>Niveau</span><b>" + NIVEAUX_RESSENTIS[p.niveau].nom + "</b></li>" +
    "<li><span>Matériel</span><b>" + materiel + "</b></li>" +
    "<li><span>Séances</span><b>" + p.seancesParSemaine + " par semaine, " + p.duree + " min</b></li>" +
    "<li><span>Douleurs</span><b>" + douleurs + "</b></li>" +
    "</ul>";
}

function vueReglages() {
  let html = '<div class="carte"><h2>Mon profil</h2>' + resumeProfil(donnees.profil) +
    '<button class="btn principal" data-action="personnaliser">✏️ ' + (donnees.profil.classique ? "Personnaliser mon programme" : "Modifier mes réponses") + "</button></div>";

  html += '<div class="carte"><h2>Changer mes niveaux</h2>' +
    '<p class="doux">À utiliser si un exercice est trop facile ou trop dur. L\'objectif repartira au début du niveau choisi.</p>' +
    selectsNiveaux() +
    '<button class="btn secondaire" data-action="changer-niveaux">Appliquer les niveaux</button></div>';

  html += '<div class="carte"><h2>Son et vibration</h2>' +
    '<label class="case"><input type="checkbox" id="reglage-son"' + (donnees.son ? " checked" : "") + "> 🔔 Son à la fin du minuteur</label>" +
    ("audioSession" in navigator
      ? '<label class="case"><input type="checkbox" id="reglage-son-force"' + (donnees.sonForce ? " checked" : "") + "> 🔕 Sonner même en mode silencieux</label>" +
        '<p class="doux">Si coché : le bip sonne même iPhone en silencieux, mais ta musique se met en pause un instant.</p>'
      : "") +
    (vibrationPossible
      ? '<label class="case"><input type="checkbox" id="reglage-vibration"' + (donnees.vibration ? " checked" : "") + "> 📳 Vibration</label>"
      : '<p class="doux">📳 Vibration : impossible sur ce téléphone (normal sur iPhone). À la place, l\'écran clignote en orange à la fin du minuteur.</p>') +
    "</div>";

  html += '<button class="btn secondaire espace" data-action="aide">❓ Comment ça marche ?</button>';

  html += '<div class="carte"><h2>Vérifier mon téléphone</h2>' +
    '<p class="doux">Teste le son, la vibration, l\'écran allumé et le mode hors-ligne. Monte le volume avant.</p>' +
    '<button class="btn secondaire" data-action="diagnostic">🔍 Lancer la vérification</button>';
  if (resultatsDiagnostic) {
    const icones = { ok: "✅", attention: "⚠️", ko: "❌" };
    html += '<ul class="diagnostic">' + resultatsDiagnostic.map(function (r) {
      return "<li>" + icones[r[0]] + " " + r[1] + "</li>";
    }).join("") + "</ul>";
  }
  html += "</div>";

  html += '<div class="carte"><h2>Sauvegarde</h2>' +
    '<p class="doux">Tes données sont enregistrées uniquement sur ce téléphone : rien n\'est envoyé sur internet. ' +
    "Pour changer de téléphone, exporte-les (tu obtiens un fichier .json), puis importe ce fichier sur le nouveau.</p>" +
    '<p class="doux">Dernière sauvegarde : ' + (donnees.derniereSauvegarde ? dateLongue(donnees.derniereSauvegarde) : "jamais") + "</p>" +
    '<button class="btn principal" data-action="exporter">⬇️ Exporter mes données</button>' +
    '<button class="btn secondaire" data-action="importer">⬆️ Importer une sauvegarde</button>' +
    '<input type="file" id="fichier-import" accept=".json,application/json" class="cache"></div>';

  html += '<div class="carte"><h2>Tout recommencer</h2>' +
    '<p class="doux">Efface toutes tes données (séances, niveaux, poids, réponses) et relance le questionnaire.</p>' +
    '<button class="btn danger" data-action="tout-effacer">🗑️ Tout recommencer</button></div>';
  return html;
}

// ----- Écran COMMENT ÇA MARCHE -----
function vueAide() {
  return '<button class="btn secondaire petit retour" data-action="retour-aide">◀ Retour</button>' +
    '<div class="carte aide"><h2>Comment ça marche ?</h2>' +
    "<ol>" +
    "<li><b>Un programme pour toi.</b> Au début, tu as répondu à quelques questions (objectif, niveau, matériel, temps). L'appli a choisi tes exercices et ton niveau de départ.</li>" +
    "<li><b>Chaque séance :</b> appuie sur « Commencer ma séance du jour ». Fais les exercices un par un, en suivant le petit bonhomme.</li>" +
    "<li><b>Après chaque série,</b> note combien tu en as fait et appuie sur ✓. Un minuteur de repos se lance avec un son (ou une vibration).</li>" +
    "<li><b>Tu progresses tout seul :</b> si tu réussis, l'objectif augmente un peu. Quand il est assez haut, tu passes à un exercice plus difficile. Si tu rates plusieurs fois, l'appli rend l'exercice un peu plus facile.</li>" +
    "<li><b>Trop dur ?</b> Pendant la séance, le bouton « Trop dur ? » te propose une version plus facile.</li>" +
    "<li><b>Semaine légère :</b> toutes les 5 semaines, la séance est plus légère pour que ton corps récupère.</li>" +
    "</ol></div>" +
    '<div class="carte aide"><h2>Les mots à connaître</h2><dl>' +
    "<dt>Répétition</dt><dd>Un mouvement complet (par exemple : descendre et remonter une fois pendant une pompe).</dd>" +
    "<dt>Série</dt><dd>Un groupe de répétitions faites sans s'arrêter. « 3 × 8 » veut dire : 3 séries de 8 répétitions.</dd>" +
    "<dt>Repos</dt><dd>La pause entre deux séries. Le minuteur te dit quand reprendre.</dd>" +
    "<dt>Gainage</dt><dd>Tenir une position sans bouger (comme la planche) pour muscler le ventre et le dos.</dd>" +
    "<dt>Niveau</dt><dd>Chaque exercice a plusieurs versions, de la plus facile à la plus dure.</dd>" +
    "<dt>Échauffement</dt><dd>5 minutes de mouvements doux avant la séance, pour préparer le corps et éviter les blessures.</dd>" +
    "</dl></div>" +
    '<div class="carte aide"><h2>Ta sécurité</h2>' +
    "<p>⚠️ Si tu as mal pendant un exercice (douleur vive, pas juste la fatigue du muscle), <b>arrête-toi</b>. " +
    "En cas de problème de santé (cœur, tension, blessure, grossesse…), demande l'avis d'un médecin avant de commencer.</p>" +
    "<p>Si tu as signalé une douleur (poignets, genoux, dos, épaules), l'appli évite les exercices qui la sollicitent.</p></div>" +
    '<div class="carte aide"><h2>Tes données</h2>' +
    "<p>Tout reste <b>sur ton téléphone</b> : rien n'est envoyé sur internet, personne d'autre ne voit tes données. " +
    "L'appli marche aussi sans connexion.</p>" +
    "<p>Pour changer de téléphone : Réglages → Exporter mes données, puis Importer sur le nouveau téléphone.</p>" +
    "<p>Tu peux changer tes réponses à tout moment dans Réglages → Modifier mes réponses : ta progression est gardée.</p></div>" +
    '<button class="btn secondaire" data-action="retour-aide">◀ Retour</button>';
}


// ============ 4. LES ACTIONS ============

// Chaque bouton a un attribut data-action="nom" : on appelle actions[nom]
const actions = {
  onglet: function (b) {
    vueActuelle = b.dataset.vue;
    rendre();
    window.scrollTo(0, 0);
  },

  aide: function () {
    vuePrecedente = vueActuelle === "aide" ? "seance" : vueActuelle;
    vueActuelle = "aide";
    rendre();
    window.scrollTo(0, 0);
  },
  "retour-aide": function () {
    vueActuelle = vuePrecedente || "seance";
    rendre();
    window.scrollTo(0, 0);
  },

  modale: function (b) {
    const bouton = boutonsModale[+b.dataset.i];
    fermerModale();
    if (bouton && bouton.action) bouton.action();
  },

  personnaliser: function () {
    if (donnees.enCours) { afficherToast("Termine d'abord ta séance en cours."); return; }
    assistant = nouvelAssistant("modifier");
    rendre();
    window.scrollTo(0, 0);
  },

  "plus-tard": function () {
    donnees.proposerQuestionnaire = false;
    sauver();
    rendre();
    afficherToast("Tu pourras personnaliser ton programme plus tard dans Réglages.");
  },

  commencer: function () {
    debloquerSon();
    bilan = null;
    const s = seanceDuJour(donnees);
    donnees.enCours = {
      debut: new Date().toISOString(),
      nom: s.nom,
      legere: s.legere,
      exercices: s.exercices.map(function (e) {
        const series = [];
        for (let i = 0; i < e.series; i++) series.push({ valeur: e.objectif, faite: false });
        return { famille: e.famille, niveau: e.niveau, objectif: e.objectif, repos: e.repos, series: series };
      }),
    };
    sauver();
    garderEcranAllume();
    rendre();
    window.scrollTo(0, 0);
  },

  // Afficher un autre exercice de la séance
  "voir-exo": function (b) {
    const i = +b.dataset.ex;
    if (!donnees.enCours || i < 0 || i >= donnees.enCours.exercices.length) return;
    donnees.enCours.actuel = i;
    sauver();
    rendre();
    window.scrollTo(0, 0);
  },

  echauffement: function () { lancerEchauffement(0); },

  moins: function (b) { changerValeur(b, -1); },
  plus: function (b) { changerValeur(b, +1); },

  valider: function (b) {
    debloquerSon();
    validerSerie(+b.dataset.ex, +b.dataset.serie);
  },

  annuler: function (b) {
    donnees.enCours.exercices[+b.dataset.ex].series[+b.dataset.serie].faite = false;
    sauver();
    rendre();
  },

  chrono: function (b) {
    const i = +b.dataset.ex;
    const ex = donnees.enCours.exercices[i];
    const nom = famille(ex.famille).niveaux[ex.niveau].nom;
    const visuel = cleAnim(ex.famille, ex.niveau);
    const lancerMaintien = function () {
      demarrerMinuteur(ex.objectif, "Tiens bon ! 🔥", nom,
        function () { remplirSerieChrono(i, ex.objectif, true); },
        function (ecoule) { remplirSerieChrono(i, ecoule, false); }, { visuel: visuel });
    };
    // 5 secondes pour se mettre en position, puis le maintien
    demarrerMinuteur(5, "Mets-toi en position", nom, lancerMaintien, lancerMaintien, { visuel: visuel });
  },

  "trop-dur": function (b) { proposerPlusFacile(+b.dataset.ex); },

  terminer: terminerSeance,

  abandonner: function () {
    ouvrirModale("Abandonner la séance ?", "<p>Rien ne sera enregistré pour cette séance.</p>", [
      { texte: "Oui, abandonner", classe: "danger", action: function () {
        donnees.enCours = null;
        sauver();
        libererEcran();
        rendre();
      } },
      { texte: "Non, je continue", classe: "secondaire" },
    ]);
  },

  "graph-famille": function (b) {
    familleGraphique = b.dataset.id;
    rendre();
  },

  "ajouter-poids": function () {
    const kg = nombre(el("saisie-poids").value);
    if (!(kg > 20 && kg < 300)) { afficherToast("Entre un poids valide en kg, par exemple 72,5"); return; }
    ajouterPesee(kg);
    sauver();
    rendre();
    afficherToast("Pesée enregistrée ✅");
  },

  "suppr-poids": function (b) {
    const index = +b.dataset.index;
    const p = donnees.poids[index];
    ouvrirModale("Supprimer cette pesée ?", "<p>" + dateCourte(p.date) + " — <b>" + p.kg + " kg</b></p>", [
      { texte: "Oui, supprimer", classe: "danger", action: function () {
        donnees.poids.splice(index, 1);
        sauver();
        rendre();
      } },
      { texte: "Annuler", classe: "secondaire" },
    ]);
  },

  "changer-niveaux": function () {
    if (donnees.enCours) { afficherToast("Termine d'abord ta séance en cours."); return; }
    let change = false;
    famillesActives().forEach(function (id) {
      const f = famille(id);
      const choisi = parseInt(el("niv-" + id).value, 10);
      if (choisi !== donnees.progression[id].niveau) {
        donnees.progression[id] = etatInitial(f, choisi);
        change = true;
      }
    });
    sauver();
    rendre();
    afficherToast(change ? "Niveaux mis à jour ✅" : "Aucun changement");
  },

  diagnostic: lancerDiagnostic,

  exporter: exporterDonnees,

  importer: function () { el("fichier-import").click(); },

  "tout-effacer": function () {
    ouvrirModale("Tout recommencer ?",
      "<p>Toutes tes données seront <b>effacées définitivement</b> : séances, niveaux, pesées et réponses au questionnaire.</p>" +
      '<p class="doux">Conseil : exporte tes données avant (Réglages → Sauvegarde).</p>', [
        { texte: "🗑️ Oui, tout effacer", classe: "danger", action: function () {
          try { localStorage.removeItem(CLE_STOCKAGE); } catch (e) { /* ignoré */ }
          arreterMinuteur();
          libererEcran();
          donnees = donneesParDefaut();
          bilan = null;
          assistant = null;
          vueActuelle = "seance";
          rendre();
          window.scrollTo(0, 0);
        } },
        { texte: "Non, garder mes données", classe: "secondaire" },
      ]);
  },

  "minuteur-moins": function () { minuteur.fin -= 15000; tic(); },
  "minuteur-plus": function () { minuteur.fin += 15000; tic(); },
  "minuteur-passer": passerMinuteur,
  "minuteur-stop": function () { arreterMinuteur(); finEchauffement(false); },
};
// On ajoute les actions du questionnaire (questionnaire.js)
Object.assign(actions, ACTIONS_QUESTIONNAIRE);

// Une seule pesée par jour : on remplace celle du jour si elle existe
function ajouterPesee(kg) {
  const maintenant = new Date().toISOString();
  const dernier = donnees.poids[donnees.poids.length - 1];
  if (dernier && memeJour(dernier.date, maintenant)) {
    dernier.kg = arrondi1(kg);
    dernier.date = maintenant;
  } else {
    donnees.poids.push({ date: maintenant, kg: arrondi1(kg) });
  }
}

function changerValeur(b, sens) {
  const i = +b.dataset.ex, j = +b.dataset.serie;
  const ex = donnees.enCours.exercices[i];
  const pas = famille(ex.famille).niveaux[ex.niveau].unite === "sec" ? 5 : 1;
  const serie = ex.series[j];
  serie.valeur = Math.max(0, serie.valeur + sens * pas);
  sauver();
  // On met juste à jour la case, sans tout redessiner
  document.querySelector('input[data-ex="' + i + '"][data-serie="' + j + '"]').value = serie.valeur;
}

// « Trop dur ? » : propose la version plus facile de l'exercice
function proposerPlusFacile(i) {
  const ec = donnees.enCours;
  const ex = ec.exercices[i];
  const f = famille(ex.famille);
  const niv = f.niveaux[ex.niveau];
  const facile = niveauPlusFacile(f, ex.niveau, donnees.profil);
  const nb = ex.series.length;

  if (facile >= 0) {
    const nf = f.niveaux[facile];
    const objectifNormal = objectifMilieu(nf);
    const objectif = ec.legere ? objectifLeger(nf, objectifNormal) : objectifNormal;
    ouvrirModale("Version plus facile",
      ANIM.anime(cleAnim(f.id, facile), "moyenne") +
      "<p><b>" + nf.nom + "</b> · objectif " + texteObjectif(nb, nf, objectif) + "</p>" +
      '<p class="doux">' + nf.desc + "</p>" +
      '<p class="doux">Les séries de cet exercice repartent de zéro. Pas de souci : c\'est en faisant bien les mouvements qu\'on progresse !</p>', [
        { texte: "✅ Oui, version facile", classe: "principal", action: function () {
          ex.niveau = facile;
          ex.objectif = objectif;
          ex.series.forEach(function (s) { s.valeur = objectif; s.faite = false; });
          donnees.progression[f.id] = etatInitial(f, facile, objectifNormal);
          sauver();
          rendre();
          afficherToast("C'est noté : " + nf.nom + " 👍");
        } },
        { texte: "Non, je continue", classe: "secondaire" },
      ]);
    return;
  }

  // Déjà la version la plus facile : on peut baisser l'objectif
  const plancher = objectifPlancher(niv);
  if (ex.objectif > plancher) {
    const nouvel = Math.max(plancher, ex.objectif - niv.pas);
    ouvrirModale("Baisser un peu l'objectif ?",
      "<p>C'est déjà la version la plus simple de cet exercice. On passe l'objectif de <b>" + ex.objectif + "</b> à <b>" + nouvel + "</b> " + texteUnite(niv) + " par série ?</p>", [
        { texte: "✅ Oui, baisser", classe: "principal", action: function () {
          ex.objectif = nouvel;
          ex.series.forEach(function (s) { if (!s.faite) s.valeur = nouvel; });
          const p = donnees.progression[f.id];
          p.objectif = Math.max(plancher, Math.min(p.objectif, nouvel));
          p.echecs = 0;
          sauver();
          rendre();
        } },
        { texte: "Non, je continue", classe: "secondaire" },
      ]);
    return;
  }
  ouvrirModale("Fais ce que tu peux 💪",
    "<p>C'est déjà la version la plus simple. Fais le nombre que tu peux, même une seule répétition compte. " +
    "Prends un peu plus de repos si besoin (bouton +15 s du minuteur).</p>", [{ texte: "OK", classe: "principal" }]);
}

function validerSerie(i, j) {
  const ex = donnees.enCours.exercices[i];
  ex.series[j].faite = true;

  // Chercher la prochaine série à faire
  const prochaine = trouverProchaineSerie();
  // Exercice fini : on affiche directement le suivant
  if (prochaine && ex.series.every(function (s) { return s.faite; })) donnees.enCours.actuel = prochaine.i;
  sauver();
  rendre();

  if (!prochaine) {
    afficherToast("Toutes les séries sont faites ! Appuie sur « Terminer la séance ».");
    return;
  }
  const f = famille(ex.famille);
  const exProchain = donnees.enCours.exercices[prochaine.i];
  const nivProchain = famille(exProchain.famille).niveaux[exProchain.niveau];
  demarrerMinuteur(ex.repos || f.repos, "Repos 😮‍💨", "Ensuite : " + nivProchain.nom + " — série " + (prochaine.j + 1),
    null, null, { visuel: cleAnim(exProchain.famille, exProchain.niveau) });
}

function trouverProchaineSerie() {
  const exos = donnees.enCours.exercices;
  for (let i = 0; i < exos.length; i++) {
    for (let j = 0; j < exos[i].series.length; j++) {
      if (!exos[i].series[j].faite) return { i: i, j: j };
    }
  }
  return null;
}

// Après le chrono du gainage : on remplit la prochaine série de l'exercice
function remplirSerieChrono(i, secondes, valider) {
  const ex = donnees.enCours.exercices[i];
  const j = ex.series.findIndex(function (s) { return !s.faite; });
  if (j < 0) return;
  ex.series[j].valeur = secondes;
  if (valider) {
    validerSerie(i, j);
  } else {
    sauver();
    rendre();
    afficherToast("Arrêté à " + secondes + " s. Corrige si besoin puis valide ✓");
  }
}

function terminerSeance() {
  const ec = donnees.enCours;
  let total = 0, faites = 0;
  ec.exercices.forEach(function (ex) {
    total += ex.series.length;
    faites += ex.series.filter(function (s) { return s.faite; }).length;
  });

  if (faites === 0) {
    ouvrirModale("Aucune série cochée", "<p>Tu n'as validé aucune série (bouton ✓). Annuler cette séance ?</p>", [
      { texte: "Oui, annuler la séance", classe: "danger", action: function () {
        donnees.enCours = null; sauver(); libererEcran(); rendre();
      } },
      { texte: "Non, je continue", classe: "secondaire" },
    ]);
    return;
  }
  if (faites < total) {
    ouvrirModale("Terminer maintenant ?",
      "<p>Certaines séries ne sont pas cochées : la progression n'avancera pas sur ces exercices. Ce n'est pas grave, tu feras mieux la prochaine fois !</p>", [
        { texte: "Oui, terminer", classe: "principal", action: enregistrerSeance },
        { texte: "Non, je continue", classe: "secondaire" },
      ]);
    return;
  }
  enregistrerSeance();
}

function enregistrerSeance() {
  const ec = donnees.enCours;
  const prog = programmeActuel();
  arreterMinuteur();
  const lignes = [];
  const exercices = [];
  ec.exercices.forEach(function (ex) {
    const f = famille(ex.famille);
    const niv = f.niveaux[ex.niveau];
    const seriesFaites = ex.series.filter(function (s) { return s.faite; }).map(function (s) { return s.valeur; });
    const etatAvant = donnees.progression[f.id] || etatInitial(f, ex.niveau, ex.objectif);
    const avant = { niveau: ex.niveau, objectif: ex.objectif, echecs: etatAvant.echecs || 0, reussites: etatAvant.reussites || 0 };
    let resultat;
    if (ec.legere) {
      // Semaine légère : on ne change pas la progression
      resultat = { etat: etatAvant, type: estReussie(f, avant, seriesFaites, ex.series.length) ? "legere" : "legere-ratee",
        message: "🌿 Semaine légère : bien récupéré ! On reprend la progression la semaine prochaine." };
    } else {
      resultat = appliquerResultat(f, avant, seriesFaites, {
        nbSeries: ex.series.length,
        reussitesPourMonter: prog.rythme.reussitesPourMonter,
        echecsAvantBaisse: prog.rythme.echecsAvantBaisse,
        permis: permisPour(f, donnees.profil),
      });
      donnees.progression[f.id] = resultat.etat;
    }

    // Nouveau record ? (on compare avec les séances d'avant, au même niveau)
    const ancienRecord = meilleureSerie(donnees.seances, f.id, ex.niveau);
    const meilleure = seriesFaites.length ? Math.max.apply(null, seriesFaites) : null;
    const record = ancienRecord !== null && meilleure > ancienRecord
      ? "Nouveau record : " + meilleure + suffixe(niv) + " (avant : " + ancienRecord + suffixe(niv) + ")" : null;

    exercices.push({
      famille: f.id, niveau: ex.niveau, nom: niv.nom, unite: niv.unite,
      objectif: ex.objectif, faites: seriesFaites,
      reussi: typeReussi(resultat.type) || resultat.type === "legere",
      resultat: resultat.type,
      score: scoreNiveau(f, donnees.progression[f.id]),
    });
    lignes.push({ famille: f, niveau: ex.niveau, texte: resultat.message, record: record });
  });

  const seance = { date: new Date().toISOString(), debut: ec.debut, exercices: exercices };
  if (ec.legere) seance.legere = true;
  if (ec.nom) seance.nom = ec.nom;
  donnees.seances.push(seance);
  donnees.seanceSuivante = ((donnees.seanceSuivante || 0) + 1) % prog.seances.length;
  donnees.enCours = null;
  bilan = { encouragement: encouragement(), lignes: lignes };
  sauver();
  libererEcran();
  rendre();
  window.scrollTo(0, 0);
}

// ----- Vérification du téléphone -----
let resultatsDiagnostic = null;

async function lancerDiagnostic() {
  // 1. On joue le signal de fin de minuteur (son + vibration + clignotement)
  debloquerSon();
  sonFin();
  vibrer([400, 150, 400]);
  flash();
  await new Promise(function (ok) { setTimeout(ok, 400); });

  const r = [];
  const installee = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  r.push(installee
    ? ["ok", "Appli installée sur l'écran d'accueil."]
    : ["attention", "Appli ouverte dans le navigateur. Installe-la sur l'écran d'accueil et utilise toujours l'icône (les données du navigateur et de l'appli installée sont séparées)."]);

  r.push(contexteAudio && contexteAudio.state === "running"
    ? ["ok", "Son activé : tu as dû entendre 3 bips. Rien entendu ? Monte le volume, ou enlève le mode silencieux (ou coche « Sonner même en mode silencieux »)."]
    : ["ko", "Son bloqué par le téléphone. Touche à nouveau le bouton de vérification."]);

  r.push(vibrationPossible
    ? ["ok", "Vibration disponible (tu as dû la sentir)."]
    : ["attention", "Vibration impossible (normal sur iPhone). L'écran clignote en orange à la place."]);

  try {
    const v = await demanderVerrou();
    await v.release();
    r.push(["ok", "L'écran peut rester allumé pendant les séances."]);
  } catch (e) {
    r.push(["ko", "L'écran ne peut pas rester allumé automatiquement. Sur iPhone, il faut iOS 18.4 ou plus récent (Réglages → Général → Mise à jour logicielle). Sinon : règle le Verrouillage automatique sur « Jamais » pendant la séance."]);
  }

  r.push(navigator.serviceWorker && navigator.serviceWorker.controller
    ? ["ok", "L'appli marche sans internet."]
    : ["attention", "Mode hors-ligne pas encore prêt : ferme complètement l'appli et rouvre-la une fois avec internet."]);

  if (navigator.storage && navigator.storage.persisted) {
    const protege = await navigator.storage.persisted().catch(function () { return false; });
    r.push(protege
      ? ["ok", "Données protégées contre l'effacement automatique."]
      : ["attention", "Le téléphone pourrait effacer les données s'il manque de place : exporte régulièrement."]);
  }

  resultatsDiagnostic = r;
  rendre();
}

// ----- Export / import -----
async function exporterDonnees() {
  const nom = "street-workout-" + new Date().toISOString().slice(0, 10) + ".json";
  const texte = JSON.stringify(Object.assign({}, donnees, { derniereSauvegarde: new Date().toISOString() }), null, 2);

  // Sur téléphone (surtout iPhone) : on passe par le menu "Partager",
  // qui permet de choisir "Enregistrer dans Fichiers", de l'envoyer par mail, etc.
  const fichier = new File([texte], nom, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: "Sauvegarde Street Workout" });
      donnees.derniereSauvegarde = new Date().toISOString();
      sauver();
      rendre();
      afficherToast("Sauvegarde enregistrée ✅");
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // l'utilisateur a fermé le menu
      // sinon, on essaie le téléchargement classique ci-dessous
    }
  }

  // Sur ordinateur : téléchargement classique
  donnees.derniereSauvegarde = new Date().toISOString();
  sauver();
  const blob = new Blob([texte], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  rendre();
  afficherToast("Fichier exporté (regarde dans tes Téléchargements)");
}

function importerFichier(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = function () {
    let lu;
    try { lu = JSON.parse(lecteur.result); } catch (e) { lu = null; }
    if (!lu || typeof lu !== "object" || !Array.isArray(lu.seances) || typeof lu.progression !== "object") {
      ouvrirModale("Fichier non reconnu", "<p>Ce fichier n'est pas une sauvegarde valide de l'appli.</p>", [{ texte: "OK", classe: "principal" }]);
      return;
    }
    ouvrirModale("Importer cette sauvegarde ?",
      "<p>Tes données actuelles seront remplacées par celles du fichier (<b>" + lu.seances.length + " séances</b>).</p>", [
        { texte: "✅ Oui, importer", classe: "principal", action: function () {
          // Une sauvegarde d'une ancienne version est mise au format actuel
          donnees = completerDonnees(migrerDonnees(lu));
          sauver();
          bilan = null;
          assistant = null;
          rendre();
          afficherToast("Sauvegarde importée ✅");
        } },
        { texte: "Annuler", classe: "secondaire" },
      ]);
  };
  lecteur.readAsText(fichier);
}

// ----- Écoute des clics et des saisies -----
document.addEventListener("click", function (e) {
  debloquerSon(); // chaque appui garde le son "débloqué" (indispensable sur iPhone)
  const b = e.target.closest("[data-action]");
  if (b && !b.disabled && actions[b.dataset.action]) actions[b.dataset.action](b);
});

// Touche « Échap » : ferme la fenêtre de confirmation
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !el("modale").classList.contains("cache")) fermerModale();
});

// Saisie au clavier du nombre de répétitions d'une série
document.addEventListener("input", function (e) {
  const t = e.target;
  if (t.dataset.serie !== undefined && donnees.enCours) {
    const v = parseInt(t.value, 10);
    donnees.enCours.exercices[+t.dataset.ex].series[+t.dataset.serie].valeur = isNaN(v) ? 0 : Math.max(0, v);
    sauver();
  } else if (t.dataset.q) {
    saisieQuestionnaire(t);
  }
});

// Changements dans les réglages
document.addEventListener("change", function (e) {
  const t = e.target;
  if (t.id === "reglage-objectif") {
    const v = nombre(t.value);
    if (String(t.value).trim() === "") {
      donnees.profil.poidsVise = null; sauver(); rendre(); afficherToast("Poids visé retiré");
    } else if (v > 20 && v < 300) {
      donnees.profil.poidsVise = arrondi1(v); sauver(); rendre(); afficherToast("Poids visé enregistré ✅");
    } else {
      afficherToast("Entre un poids valide en kg, par exemple 72,5");
    }
  } else if (t.id === "reglage-son") {
    donnees.son = t.checked; sauver();
  } else if (t.id === "reglage-son-force") {
    donnees.sonForce = t.checked; sauver(); reglerSessionAudio();
  } else if (t.id === "reglage-vibration") {
    donnees.vibration = t.checked; sauver();
  } else if (t.id === "fichier-import" && t.files[0]) {
    importerFichier(t.files[0]);
    t.value = "";
  }
});


// ============ 5. MINUTEUR, SON ET VIBRATION ============

const minuteur = { fin: 0, debut: 0, intervalle: null, surFin: null, surArret: null, dernierBip: null };

// secondes : durée ; surFin : appelé à la fin ; surArret : appelé si on appuie sur "Passer"
// options.visuel : animation à montrer (ex. "pompes-2")
// options.stop   : affiche le bouton "Arrêter" (pour l'échauffement)
function demarrerMinuteur(secondes, titre, sousTitre, surFin, surArret, options) {
  options = options || {};
  arreterMinuteur();
  minuteur.debut = Date.now();
  minuteur.fin = Date.now() + secondes * 1000;
  minuteur.surFin = surFin || null;
  minuteur.surArret = surArret || null;
  minuteur.dernierBip = null;
  el("minuteur-titre").textContent = titre;
  el("minuteur-sous").textContent = sousTitre || "";
  el("minuteur-visuel").innerHTML = options.visuel ? ANIM.anime(options.visuel, "grande") : "";
  el("minuteur-stop").classList.toggle("cache", !options.stop);
  el("minuteur").classList.remove("cache");
  ANIM.activer(el("minuteur"));
  tic();
  minuteur.intervalle = setInterval(tic, 200);
}

// Appelé 5 fois par seconde pour mettre l'affichage à jour
function tic() {
  if (!minuteur.intervalle && el("minuteur").classList.contains("cache")) return;
  const reste = Math.max(0, Math.ceil((minuteur.fin - Date.now()) / 1000));
  el("minuteur-temps").textContent = formatTemps(reste);
  if (reste <= 3 && reste > 0 && reste !== minuteur.dernierBip) {
    minuteur.dernierBip = reste;
    bip(660, 0.12, 0); // petit bip pour les 3 dernières secondes
  }
  if (reste === 0) finMinuteur();
}

function finMinuteur() {
  const rappel = minuteur.surFin;
  arreterMinuteur();
  sonFin();
  vibrer([400, 150, 400]);
  flash();
  if (rappel) rappel();
}

function passerMinuteur() {
  const rappel = minuteur.surArret;
  const ecoule = Math.round((Date.now() - minuteur.debut) / 1000);
  arreterMinuteur();
  if (rappel) rappel(ecoule);
}

function arreterMinuteur() {
  clearInterval(minuteur.intervalle);
  minuteur.intervalle = null;
  minuteur.surFin = null;
  minuteur.surArret = null;
  el("minuteur").classList.add("cache");
  el("minuteur-visuel").innerHTML = "";
}

// ----- Échauffement guidé : les exercices de ECHAUFFEMENT, l'un après l'autre -----
let echauffementActif = false;

function lancerEchauffement(i) {
  // Échauffement adapté au matériel et aux douleurs (programme.js)
  const liste = echauffementPour(donnees.profil);
  if (i >= liste.length) { finEchauffement(true); return; }
  echauffementActif = true;
  garderEcranAllume();
  const e = liste[i];
  const suivant = function () { lancerEchauffement(i + 1); };
  demarrerMinuteur(e.duree, "Échauffement " + (i + 1) + "/" + liste.length + " · " + e.nom,
    e.conseil + (liste[i + 1] ? "\nEnsuite : " + liste[i + 1].nom : ""),
    suivant, suivant, { visuel: e.anim, stop: true });
}

function finEchauffement(complet) {
  if (!echauffementActif) return;
  echauffementActif = false;
  if (!donnees.enCours) libererEcran();
  if (complet) afficherToast("Échauffement terminé 🔥 À toi de jouer !");
}

let contexteAudio = null;

// iPhone : par défaut, le son est coupé quand l'iPhone est en mode silencieux
// (mais ta musique continue). L'option "sonForce" fait sonner même en mode
// silencieux, mais met en pause la musique au moment du bip.
function reglerSessionAudio() {
  if (navigator.audioSession) {
    try { navigator.audioSession.type = donnees.sonForce ? "playback" : "auto"; } catch (e) { /* ignoré */ }
  }
}

// Les téléphones (surtout l'iPhone) bloquent le son tant qu'on n'a pas touché
// l'écran : on "débloque" le son à chaque appui sur un bouton.
function debloquerSon() {
  try {
    reglerSessionAudio();
    if (!contexteAudio) {
      contexteAudio = new (window.AudioContext || window.webkitAudioContext)();
      // iPhone : jouer un son vide pendant l'appui débloque le son pour la suite
      const vide = contexteAudio.createBufferSource();
      vide.buffer = contexteAudio.createBuffer(1, 1, 22050);
      vide.connect(contexteAudio.destination);
      vide.start(0);
    }
    if (contexteAudio.state !== "running") contexteAudio.resume();
  } catch (e) { /* pas de son disponible */ }
}

function bip(frequence, duree, decalage) {
  if (!donnees.son || !contexteAudio) return;
  if (contexteAudio.state !== "running") contexteAudio.resume();
  const t = contexteAudio.currentTime + decalage;
  const osc = contexteAudio.createOscillator();
  const volume = contexteAudio.createGain();
  osc.type = "sine";
  osc.frequency.value = frequence;
  volume.gain.setValueAtTime(0.4, t);
  volume.gain.exponentialRampToValueAtTime(0.001, t + duree);
  osc.connect(volume).connect(contexteAudio.destination);
  osc.start(t);
  osc.stop(t + duree);
}

function sonFin() {
  bip(880, 0.25, 0);
  bip(880, 0.25, 0.3);
  bip(1320, 0.5, 0.6);
}

const vibrationPossible = "vibrate" in navigator; // false sur iPhone

function vibrer(motif) {
  if (donnees.vibration && vibrationPossible) navigator.vibrate(motif);
}

// L'écran clignote en orange (utile sur iPhone, qui ne peut pas vibrer)
function flash() {
  document.body.classList.remove("flash");
  void document.body.offsetWidth; // relance l'animation
  document.body.classList.add("flash");
  setTimeout(function () { document.body.classList.remove("flash"); }, 1600);
}

// Garder l'écran allumé pendant la séance (si le téléphone le permet)
let verrouEcran = null;
let ecranEtat = "inconnu"; // "actif" ou "indisponible"

async function demanderVerrou() {
  if (!("wakeLock" in navigator)) throw new Error("non supporté");
  const v = await navigator.wakeLock.request("screen");
  return v;
}

async function garderEcranAllume() {
  if ((!donnees.enCours && !echauffementActif) || verrouEcran) return;
  const avant = ecranEtat;
  try {
    verrouEcran = await demanderVerrou();
    verrouEcran.addEventListener("release", function () { verrouEcran = null; });
    ecranEtat = "actif";
  } catch (e) {
    ecranEtat = "indisponible";
  }
  // Redessiner si l'état a changé (pour afficher ou cacher l'avertissement)
  if (ecranEtat !== avant && vueActuelle === "seance" && donnees.enCours) rendre();
}
function libererEcran() {
  if (verrouEcran) { verrouEcran.release(); verrouEcran = null; }
}

// Quand on revient sur l'appli : on remet l'écran allumé et on met le minuteur à l'heure
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    garderEcranAllume();
    if (minuteur.intervalle) tic();
  }
});


// ============ 6. LES GRAPHIQUES ============

function dessinerGraphiques() {
  const cProgres = el("graph-progres");
  if (cProgres && familleGraphique) {
    const f = famille(familleGraphique);
    const points = [];
    donnees.seances.forEach(function (s) {
      const e = s.exercices.find(function (x) { return x.famille === f.id; });
      if (e) points.push({ date: s.date, y: e.score });
    });
    dessinerCourbe(cProgres, points, { formatY: function (v) { return "Niv " + arrondi1(v); } });
  }
  const cPoids = el("graph-poids");
  if (cPoids) {
    const points = donnees.poids.map(function (p) { return { date: p.date, y: p.kg }; });
    const objectif = donnees.profil.poidsVise;
    const sens = sensPoids(donnees.poids, objectif);
    // Le rythme conseillé : on part de la 1re pesée et on avance vers le poids visé
    const ideal = points.length && sens !== 0 ? function (date) {
      const semaines = (new Date(date) - new Date(points[0].date)) / (7 * 86400000);
      return sens > 0 ? Math.min(objectif, points[0].y + semaines * RYTHME_IDEAL)
        : Math.max(objectif, points[0].y - semaines * RYTHME_IDEAL_PERTE);
    } : null;
    dessinerCourbe(cPoids, points, { objectif: objectif, parDate: true, ideal: ideal,
      formatY: function (v) { return Math.round(v) + " kg"; } });
  }
}

// Dessine une courbe simple sur un <canvas>
function dessinerCourbe(canvas, points, options) {
  const ratio = window.devicePixelRatio || 1;
  const L = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = L * ratio;
  canvas.height = H * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);

  const css = getComputedStyle(document.documentElement);
  const couleur = function (nom) { return css.getPropertyValue(nom).trim(); };
  ctx.font = "12px system-ui, sans-serif";

  if (points.length === 0) {
    ctx.fillStyle = couleur("--texte-doux");
    ctx.textAlign = "center";
    ctx.fillText("Pas encore de données", L / 2, H / 2);
    return;
  }

  // Échelle verticale
  const valeurs = points.map(function (p) { return p.y; });
  if (options.objectif != null) valeurs.push(options.objectif);
  const tDebut = new Date(points[0].date).getTime();
  const tFin = new Date(points[points.length - 1].date).getTime();
  if (options.ideal && tFin > tDebut) valeurs.push(options.ideal(tFin));
  let yMin = Math.min.apply(null, valeurs), yMax = Math.max.apply(null, valeurs);
  if (yMax - yMin < 1) { yMin -= 1; yMax += 1; }
  const marge = (yMax - yMin) * 0.1;
  yMin -= marge; yMax += marge;

  const g = 52, d = 14, h = 12, b = 26; // marges gauche, droite, haut, bas
  // Position horizontale : selon la date (poids) ou régulière (séances)
  const XDate = function (t) { return g + (t - tDebut) / (tFin - tDebut) * (L - g - d); };
  const X = function (i) {
    if (points.length === 1 || (options.parDate && tFin === tDebut)) return (g + L - d) / 2;
    if (options.parDate) return XDate(new Date(points[i].date).getTime());
    return g + i * (L - g - d) / (points.length - 1);
  };
  const Y = function (v) { return h + (yMax - v) / (yMax - yMin) * (H - h - b); };

  // Lignes de repère horizontales
  ctx.strokeStyle = couleur("--ligne");
  ctx.fillStyle = couleur("--texte-doux");
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let k = 0; k <= 4; k++) {
    const v = yMin + (yMax - yMin) * k / 4;
    ctx.beginPath(); ctx.moveTo(g, Y(v)); ctx.lineTo(L - d, Y(v)); ctx.stroke();
    ctx.fillText(options.formatY(v), g - 6, Y(v));
  }

  // Ligne d'objectif en pointillés
  if (options.objectif != null) {
    ctx.strokeStyle = couleur("--vert");
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(g, Y(options.objectif)); ctx.lineTo(L - d, Y(options.objectif)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Le rythme idéal en pointillés gris
  if (options.ideal && options.parDate && tFin > tDebut) {
    ctx.strokeStyle = couleur("--texte-doux");
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) {
      const t = tDebut + (tFin - tDebut) * k / 20;
      if (k === 0) ctx.moveTo(XDate(t), Y(options.ideal(t))); else ctx.lineTo(XDate(t), Y(options.ideal(t)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // La courbe
  ctx.strokeStyle = couleur("--accent");
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach(function (p, i) { if (i === 0) ctx.moveTo(X(i), Y(p.y)); else ctx.lineTo(X(i), Y(p.y)); });
  ctx.stroke();
  ctx.fillStyle = couleur("--accent");
  points.forEach(function (p, i) { ctx.beginPath(); ctx.arc(X(i), Y(p.y), 4, 0, Math.PI * 2); ctx.fill(); });

  // Dates de la première et de la dernière mesure
  ctx.fillStyle = couleur("--texte-doux");
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(dateCourte(points[0].date), g, H - 6);
  if (points.length > 1) {
    ctx.textAlign = "right";
    ctx.fillText(dateCourte(points[points.length - 1].date), L - d, H - 6);
  }
}

window.addEventListener("resize", dessinerGraphiques);


// ============ 7. DÉMARRAGE ============

rendre();
if (donnees.enCours) garderEcranAllume();
if (donnees.configure) protegerStockage();

// Le "service worker" permet à l'appli de marcher sans internet
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(function (e) {
    console.warn("Service worker non enregistré :", e);
  });
}
