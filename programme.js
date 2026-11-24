// =====================================================================
//  programme.js — LE PROGRAMME PERSONNALISÉ
// ---------------------------------------------------------------------
//  Ce fichier fabrique le programme de chaque personne à partir de ses
//  réponses au questionnaire (son "profil") :
//   1. Les données (valeurs par défaut + MIGRATION des anciennes données)
//   2. Ce qui est possible pour la personne (matériel, douleurs)
//   3. La création du programme (exercices, séries, repos, séances A/B)
//   4. La séance du jour et la semaine légère
//   5. Le test de niveau
//
//  Rien ici n'est propre à une personne : toutes les données restent dans
//  le téléphone de chacun (localStorage).
// =====================================================================

// ============ 1. LES DONNÉES ============

const VERSION_DONNEES = 2;

// Les textes des choix du questionnaire
const OBJECTIFS = {
  muscle: { nom: "Prendre du muscle", emoji: "💪" },
  perte: { nom: "Perdre du poids", emoji: "🔥" },
  force: { nom: "Gagner en force", emoji: "🏋️" },
  forme: { nom: "Garder la forme", emoji: "🌿" },
};
const NIVEAUX_RESSENTIS = {
  jamais: { nom: "Jamais fait de sport", detail: "Je pars de zéro" },
  debutant: { nom: "Débutant", detail: "Un peu de sport de temps en temps" },
  intermediaire: { nom: "Intermédiaire", detail: "Je m'entraîne depuis quelques mois" },
  confirme: { nom: "Confirmé", detail: "Je m'entraîne régulièrement depuis longtemps" },
};
const MATERIELS = {
  barre: { nom: "Barre de traction", emoji: "🔩" },
  paralleles: { nom: "Barres parallèles", emoji: "🟰" },
  elastique: { nom: "Élastiques", emoji: "➰" },
};
const LIMITATIONS = {
  poignets: "Poignets",
  genoux: "Genoux",
  dos: "Dos",
  epaules: "Épaules",
};
const DUREES = [15, 30, 45, 60];

function donneesParDefaut() {
  return {
    version: VERSION_DONNEES,
    configure: false,        // false tant que le questionnaire n'est pas rempli
    profil: null,            // les réponses au questionnaire
    proposerQuestionnaire: false, // anciens utilisateurs : on propose le questionnaire une fois
    debutProgramme: null,    // date de début (sert à compter les semaines légères)
    seanceSuivante: 0,       // 0 = séance A, 1 = séance B
    progression: {},         // { tractions: {niveau, objectif, echecs, reussites}, ... }
    seances: [],             // historique des séances terminées
    poids: [],               // [{ date, kg }]
    son: true,
    sonForce: false,         // iPhone : sonner même en mode silencieux
    vibration: true,
    enCours: null,           // la séance en train d'être faite (gardée si on ferme l'appli)
    derniereSauvegarde: null,
  };
}

// Profil d'un ancien utilisateur qui n'a pas (encore) répondu au questionnaire :
// il garde EXACTEMENT son programme d'avant (4 exercices, 3 séries).
function profilClassique(seancesParSemaine, poidsVise) {
  return {
    classique: true,
    prenom: "",
    objectif: "muscle",
    niveau: "intermediaire",
    materiel: ["barre"],
    seancesParSemaine: seancesParSemaine || 3,
    duree: 45,
    poidsVise: poidsVise != null ? poidsVise : null,
    limitations: [],
  };
}

// MIGRATION : transforme des données de n'importe quelle ancienne version
// en données au format actuel, SANS rien perdre (historique, niveaux, poids).
function migrerDonnees(brut) {
  const d = Object.assign(donneesParDefaut(), brut || {});
  const ancienneVersion = brut && brut.version ? brut.version : 1;

  if (ancienneVersion < 2) {
    // Version 1 : pas de profil ; "seancesParSemaine" et "poidsObjectif" à la racine
    if (d.configure) {
      d.profil = profilClassique(d.seancesParSemaine, typeof d.poidsObjectif === "number" ? d.poidsObjectif : null);
      d.proposerQuestionnaire = true;
      const premiere = d.seances[0];
      d.debutProgramme = premiere ? premiere.date : new Date().toISOString();
    }
    delete d.seancesParSemaine;
    delete d.poidsObjectif;
  }
  d.version = VERSION_DONNEES;

  if (!Array.isArray(d.seances)) d.seances = [];
  if (!Array.isArray(d.poids)) d.poids = [];
  if (!d.progression || typeof d.progression !== "object") d.progression = {};
  Object.keys(d.progression).forEach(function (id) {
    const p = d.progression[id];
    if (p && p.reussites == null) p.reussites = 0;
    if (p && p.echecs == null) p.echecs = 0;
  });
  if (d.configure && !d.profil) d.profil = profilClassique(3, null);
  if (d.profil) {
    d.profil = Object.assign(profilClassique(3, null), { classique: false }, d.profil);
  }
  return d;
}


// ============ 2. CE QUI EST POSSIBLE POUR LA PERSONNE ============

// Un niveau est possible si la personne a le matériel et pas de douleur concernée
function niveauPermis(niv, profil) {
  if (!profil) return true;
  if (niv.materiel && profil.materiel.indexOf(niv.materiel) < 0) return false;
  if (niv.eviter && niv.eviter.some(function (l) { return profil.limitations.indexOf(l) >= 0; })) return false;
  return true;
}

// Fonction "permis(i)" pour une famille (utilisée par progression.js)
function permisPour(f, profil) {
  return function (i) { return niveauPermis(f.niveaux[i], profil); };
}

function famillePossible(f, profil) {
  return f.niveaux.some(function (n) { return niveauPermis(n, profil); });
}

// Le niveau possible le plus proche (en dessous d'abord, sinon au-dessus)
function ajusterNiveau(f, niveau, profil) {
  niveau = Math.max(0, Math.min(f.niveaux.length - 1, niveau));
  for (let i = niveau; i >= 0; i--) if (niveauPermis(f.niveaux[i], profil)) return i;
  for (let i = niveau + 1; i < f.niveaux.length; i++) if (niveauPermis(f.niveaux[i], profil)) return i;
  return -1;
}

// Niveau de départ d'après le niveau ressenti
function niveauDepart(f, profil) {
  const voulu = f.depart ? f.depart[profil.niveau] || 0 : 0;
  return ajusterNiveau(f, voulu, profil);
}

// La version plus facile d'un exercice (-1 s'il n'y en a pas)
function niveauPlusFacile(f, niveau, profil) {
  return niveauPrecedentPermis(f, niveau, permisPour(f, profil));
}


// ============ 3. LA CRÉATION DU PROGRAMME ============

// Pour chaque rôle, les familles possibles (la 1re possible est choisie)
const ROLES = {
  tirer: ["tractions", "tirage"],
  pousser: ["pompes"],
  jambes: ["jambes", "fessiers"],
  triceps: ["dips"],
  abdos: ["abdos"],
  gainage: ["gainage"],
  cardio: ["cardio"],
  fessiers: ["fessiers"],
};

// L'ordre d'importance des rôles selon l'objectif
const PRIORITES = {
  muscle: ["tirer", "pousser", "jambes", "triceps", "abdos", "gainage"],
  force: ["tirer", "pousser", "jambes", "triceps", "gainage", "abdos"],
  perte: ["cardio", "jambes", "pousser", "tirer", "gainage", "abdos", "fessiers"],
  forme: ["jambes", "pousser", "tirer", "gainage", "cardio", "abdos", "fessiers"],
};

const EXERCICES_PAR_DUREE = { 15: 3, 30: 4, 45: 5, 60: 6 };
// Repos en secondes : [exercices principaux, abdos/gainage/cardio]
const REPOS = { muscle: [90, 60], force: [120, 75], perte: [45, 30], forme: [60, 45] };
const FAMILLES_LEGERES = ["abdos", "gainage", "cardio"];
const SEMAINE_LEGERE_TOUTES_LES = 5;

function seriesPour(profil) {
  if (profil.duree <= 15) return 2;
  if (profil.duree >= 60 && (profil.objectif === "muscle" || profil.objectif === "force")) return 4;
  return 3;
}

function reposPour(profil, familleId) {
  const r = REPOS[profil.objectif] || REPOS.forme;
  let s = FAMILLES_LEGERES.indexOf(familleId) >= 0 ? r[1] : r[0];
  if (profil.duree <= 15) s = Math.min(s, 60); // séance courte : repos plus courts
  return s;
}

// Rythme de progression : plus doux pour les débutants
function rythmePour(profil) {
  const doux = profil.niveau === "jamais" || profil.niveau === "debutant";
  return { reussitesPourMonter: doux ? 2 : 1, echecsAvantBaisse: doux ? 2 : 3 };
}

// La liste des familles du programme, de la plus importante à la moins importante
function famillesPrioritaires(profil) {
  const liste = [];
  (PRIORITES[profil.objectif] || PRIORITES.forme).forEach(function (role) {
    const id = ROLES[role].find(function (fid) { return famillePossible(famille(fid), profil); });
    if (id && liste.indexOf(id) < 0) liste.push(id);
  });
  return liste;
}

// Renvoie { seances: [ [ {famille, series, repos}, ... ], ... ], rythme, classique }
//   1 séance (A) si tout tient dans le temps voulu, sinon 2 (A et B) en alternance
function genererProgramme(profil) {
  if (profil.classique) {
    return {
      classique: true,
      rythme: { reussitesPourMonter: 1, echecsAvantBaisse: ECHECS_AVANT_BAISSE },
      seances: [["tractions", "pompes", "abdos", "gainage"].map(function (id) {
        const f = famille(id);
        return { famille: id, series: f.series, repos: f.repos };
      })],
    };
  }
  const pool = famillesPrioritaires(profil);
  const n = Math.min(EXERCICES_PAR_DUREE[profil.duree] || 4, pool.length);
  const a = pool.slice(0, n);
  const seances = [a];
  if (pool.length > n) {
    const b = pool.slice(n, 2 * n);
    pool.forEach(function (id) { if (b.length < n && b.indexOf(id) < 0) b.push(id); });
    seances.push(b);
  }
  const series = seriesPour(profil);
  return {
    classique: false,
    rythme: rythmePour(profil),
    seances: seances.map(function (liste) {
      return liste.map(function (id) { return { famille: id, series: series, repos: reposPour(profil, id) }; });
    }),
  };
}

// Toutes les familles utilisées par le programme (A et B)
function famillesDuProgramme(programme) {
  const ids = [];
  programme.seances.forEach(function (s) {
    s.forEach(function (e) { if (ids.indexOf(e.famille) < 0) ids.push(e.famille); });
  });
  return ids;
}

// Met la progression en accord avec le profil :
//  - garde les niveaux déjà atteints (en les ajustant si le matériel a changé)
//  - crée le niveau de départ des nouvelles familles
//  - niveauxTest (facultatif) : niveaux calculés par le test, prioritaires
function preparerProgression(progression, profil, niveauxTest) {
  const prog = genererProgramme(profil);
  famillesDuProgramme(prog).forEach(function (id) {
    const f = famille(id);
    const test = niveauxTest && niveauxTest[id];
    if (test) {
      progression[id] = etatInitial(f, test.niveau, test.objectif);
      return;
    }
    const p = progression[id];
    if (!p || p.niveau == null || p.niveau >= f.niveaux.length) {
      progression[id] = etatInitial(f, niveauDepart(f, profil));
      return;
    }
    const ajuste = ajusterNiveau(f, p.niveau, profil);
    if (ajuste !== p.niveau) progression[id] = etatInitial(f, ajuste);
  });
  return progression;
}


// ============ 4. LA SÉANCE DU JOUR ET LA SEMAINE LÉGÈRE ============

// Numéro de la semaine du programme (1 = la première)
function numeroSemaine(debut, maintenant) {
  if (!debut) return 1;
  const jours = Math.floor((new Date(maintenant || new Date()) - new Date(debut)) / 86400000);
  return Math.max(1, Math.floor(jours / 7) + 1);
}

// Toutes les 5 semaines : semaine plus légère pour récupérer
function estSemaineLegere(donnees, maintenant) {
  if (!donnees.profil || donnees.profil.classique) return false;
  return numeroSemaine(donnees.debutProgramme, maintenant) % SEMAINE_LEGERE_TOUTES_LES === 0;
}

// Objectif réduit d'environ 30 % pendant la semaine légère
function objectifLeger(niv, objectif) {
  return Math.max(1, Math.round(objectif * 0.7));
}

// La séance à faire aujourd'hui :
// { nom: "A" ou "B" (ou ""), legere, exercices: [{famille, niveau, objectif, series, repos}] }
function seanceDuJour(donnees, maintenant) {
  const prog = genererProgramme(donnees.profil);
  const index = (donnees.seanceSuivante || 0) % prog.seances.length;
  const legere = estSemaineLegere(donnees, maintenant);
  return {
    nom: prog.seances.length > 1 ? "AB"[index] : "",
    legere: legere,
    exercices: prog.seances[index].map(function (e) {
      const f = famille(e.famille);
      const p = donnees.progression[e.famille] || etatInitial(f, niveauDepart(f, donnees.profil));
      const niv = f.niveaux[p.niveau];
      return {
        famille: e.famille,
        niveau: p.niveau,
        objectif: legere ? objectifLeger(niv, p.objectif) : p.objectif,
        series: legere ? Math.max(2, e.series - 1) : e.series,
        repos: e.repos,
      };
    }),
  };
}

// Durée estimée d'une séance en minutes, échauffement de 5 minutes compris
function dureeEstimee(seance) {
  let s = 5 * 60;
  seance.exercices.forEach(function (e) {
    const niv = famille(e.famille).niveaux[e.niveau];
    const effort = niv.unite === "sec" ? e.objectif + 5 : e.objectif * 4;
    // séries + mise en place + repos entre les séries + passage à l'exercice suivant
    s += e.series * (effort + 20) + e.series * e.repos + 90;
  });
  return Math.max(10, Math.round(s / 60 / 5) * 5);
}

// L'échauffement adapté (sans barre, sans sauts si genoux sensibles…)
function echauffementPour(profil) {
  return ECHAUFFEMENT.map(function (e) {
    const sansMateriel = e.materiel && profil && profil.materiel.indexOf(e.materiel) < 0;
    const douleur = e.eviter && profil && e.eviter.some(function (l) { return profil.limitations.indexOf(l) >= 0; });
    return (sansMateriel || douleur) && e.sinon ? e.sinon : e;
  });
}


// ============ 5. LE TEST DE NIVEAU ============

// Les épreuves du test (pompes, tirage, gainage, abdos)
function epreuvesTest(profil) {
  const barre = profil.materiel.indexOf("barre") >= 0;
  return [
    { id: "pompes", nom: "Pompes", anim: "pompes-2", unite: "reps",
      consigne: "Fais le plus de pompes possible, bien droit, sans t'arrêter. Pas une seule ? Mets 0, ce n'est pas grave !" },
    barre
      ? { id: "tractions", nom: "Tractions", anim: "tractions-4", unite: "reps",
          consigne: "Suspendu à la barre, bras tendus : fais le plus de tractions possible (menton au-dessus de la barre). Pas une seule ? Mets 0." }
      : { id: "tirage", nom: "Tractions australiennes sous une table", anim: "tirage-3", unite: "reps",
          consigne: "Sous une table SOLIDE, attrape le bord et tire ta poitrine vers la table, genoux pliés. Fais-en le plus possible. Pas de table adaptée ? Mets 0." },
    { id: "gainage", nom: "Planche (gainage)", anim: "gainage-0", unite: "sec",
      consigne: "Sur les avant-bras et la pointe des pieds, corps bien droit. Lance le chrono et tiens le plus longtemps possible." },
    { id: "abdos", nom: "Relevés de genoux au sol", anim: "abdos-1", unite: "reps",
      consigne: "Sur le dos, mains sous les fesses : ramène les genoux vers la poitrine, le plus de fois possible." },
  ];
}

// Objectif = environ 60 % du maximum, dans les limites du niveau
function objectifDepuisMax(niv, max, part) {
  const v = Math.round(max * (part || 0.6));
  return Math.max(objectifPlancher(niv), Math.min(niv.max, v));
}

// Transforme les résultats du test en niveaux de départ
// resultats : { pompes: 12, tractions: 0, tirage: 4, gainage: 45, abdos: 10 }
// Renvoie { pompes: {niveau, objectif}, ... }
function niveauxDepuisTest(resultats, profil) {
  const r = {};
  function placer(id, niveau, max, part) {
    const f = famille(id);
    const n = ajusterNiveau(f, niveau, profil);
    if (n < 0) return;
    const niv = f.niveaux[n];
    r[id] = { niveau: n, objectif: n === niveau && max != null ? objectifDepuisMax(niv, max, part) : niv.debut };
  }

  if (resultats.pompes != null) {
    const n = resultats.pompes;
    if (n < 1) placer("pompes", 0, null);
    else if (n < 5) placer("pompes", 1, null);
    else if (n < 25) placer("pompes", 2, n);
    else if (n < 35) placer("pompes", 3, null);
    else placer("pompes", 4, null);
  }
  if (resultats.tractions != null) {
    const n = resultats.tractions;
    if (n < 1) placer("tractions", profil.niveau === "jamais" ? 0 : 1, null);
    else if (n < 3) placer("tractions", 2, null);
    else if (n < 5) placer("tractions", profil.materiel.indexOf("elastique") >= 0 ? 3 : 2, null);
    else if (n < 17) placer("tractions", 4, n);
    else placer("tractions", 5, null);
  }
  if (resultats.tirage != null) {
    const n = resultats.tirage;
    if (n < 1) placer("tirage", profil.niveau === "jamais" ? 0 : 1, null);
    else if (n < 10) placer("tirage", 3, n, 0.7);
    else placer("tirage", 4, n, 0.5);
  }
  if (resultats.gainage != null) {
    const t = resultats.gainage;
    if (t <= 100) {
      const niv = famille("gainage").niveaux[0];
      r.gainage = { niveau: 0, objectif: Math.max(10, Math.min(niv.max, Math.round(t * 0.6 / 5) * 5)) };
    } else placer("gainage", 1, null);
  }
  if (resultats.abdos != null) {
    const n = resultats.abdos;
    if (n < 8) placer("abdos", 0, null);
    else if (n < 20) placer("abdos", 1, n);
    else if (n < 30) placer("abdos", 2, null);
    else placer("abdos", 3, null);
  }
  return r;
}
