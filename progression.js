// =====================================================================
//  progression.js — LES RÈGLES DE PROGRESSION
// ---------------------------------------------------------------------
//  Pour chaque famille, on retient :
//    niveau    : le numéro du niveau actuel (0 = le premier)
//    objectif  : le nombre de répétitions (ou secondes) visé par série
//    echecs    : combien de séances ratées d'affilée sur cette famille
//    reussites : combien de séances réussies d'affilée (pour les débutants,
//                il en faut 2 avant que l'objectif monte)
//
//  Règles :
//   1. Séance réussie → objectif + "pas" (après 1 ou 2 réussites selon le niveau)
//   2. Objectif max réussi → niveau suivant (on repart à "debut")
//   3. Séance ratée → l'objectif ne bouge pas
//   4. Plusieurs ratés d'affilée → l'objectif baisse d'un cran ; s'il est
//      déjà au plus bas, on repasse au niveau plus facile (jamais bloqué)
//
//  Les niveaux impossibles (pas le matériel, douleur) sont sautés : c'est
//  l'option "permis" (une fonction qui dit si un niveau est autorisé).
// =====================================================================

const ECHECS_AVANT_BAISSE = 3;

// État de départ pour une famille, au niveau choisi
function etatInitial(famille, niveau, objectif) {
  return { niveau: niveau, objectif: objectif != null ? objectif : famille.niveaux[niveau].debut, echecs: 0, reussites: 0 };
}

// Le plus petit objectif possible au premier niveau d'une famille
function objectifPlancher(niv) { return Math.max(1, Math.ceil(niv.debut / 2)); }

// Objectif au milieu d'un niveau (quand on redescend d'un niveau)
function objectifMilieu(niv) {
  return Math.round((niv.debut + niv.max) / 2 / niv.pas) * niv.pas;
}

// La séance est réussie si TOUTES les séries ont atteint l'objectif
function estReussie(famille, etat, seriesFaites, nbSeries) {
  if (seriesFaites.length < (nbSeries || famille.series)) return false;
  return seriesFaites.every(function (n) { return n >= etat.objectif; });
}

// Niveau autorisé suivant / précédent (-1 s'il n'y en a pas)
function niveauSuivantPermis(famille, niveau, permis) {
  for (let i = niveau + 1; i < famille.niveaux.length; i++) if (!permis || permis(i)) return i;
  return -1;
}
function niveauPrecedentPermis(famille, niveau, permis) {
  for (let i = niveau - 1; i >= 0; i--) if (!permis || permis(i)) return i;
  return -1;
}

// Calcule le nouvel état après une séance.
// options (toutes facultatives) :
//   nbSeries           : nombre de séries prévues (sinon celui de la famille)
//   reussitesPourMonter: 1 (normal) ou 2 (rythme doux pour débutants)
//   echecsAvantBaisse  : 3 par défaut
//   permis(i)          : dit si le niveau i est possible pour la personne
// Renvoie { etat: nouvel état, type: "...", message: "texte à afficher" }
function appliquerResultat(famille, etat, seriesFaites, options) {
  const o = Object.assign({ nbSeries: famille.series, reussitesPourMonter: 1, echecsAvantBaisse: ECHECS_AVANT_BAISSE, permis: null }, options || {});
  const niv = famille.niveaux[etat.niveau];
  const unite = niv.unite === "sec" ? " s" : "";
  const x = o.nbSeries + " × ";
  const nouveau = { niveau: etat.niveau, objectif: etat.objectif, echecs: etat.echecs || 0, reussites: etat.reussites || 0 };

  if (estReussie(famille, etat, seriesFaites, o.nbSeries)) {
    nouveau.echecs = 0;
    nouveau.reussites += 1;

    // Rythme doux : il faut réussir plusieurs fois avant de monter
    if (nouveau.reussites < o.reussitesPourMonter) {
      return { etat: nouveau, type: "valide",
        message: "✅ Réussi ! Refais-le encore une fois et l'objectif montera." };
    }
    nouveau.reussites = 0;

    if (etat.objectif >= niv.max) {
      // Objectif max atteint : niveau suivant (s'il est possible)
      const i = niveauSuivantPermis(famille, etat.niveau, o.permis);
      if (i >= 0) {
        nouveau.niveau = i;
        const suivant = famille.niveaux[i];
        nouveau.objectif = suivant.debut;
        return { etat: nouveau, type: "niveau",
          message: "🎉 Niveau supérieur : " + suivant.nom + " (" + x + suivant.debut + (suivant.unite === "sec" ? " s" : "") + ")" };
      }
      return { etat: nouveau, type: "max",
        message: "🏆 Niveau maximum maîtrisé ! Pour continuer : ralentis le mouvement ou fais une pause de 2 secondes en bas." };
    }

    nouveau.objectif = Math.min(niv.max, etat.objectif + niv.pas);
    return { etat: nouveau, type: "progres",
      message: "✅ Réussi ! Prochain objectif : " + x + nouveau.objectif + unite };
  }

  // Séance ratée
  nouveau.reussites = 0;
  nouveau.echecs += 1;
  if (nouveau.echecs >= o.echecsAvantBaisse) {
    nouveau.echecs = 0;
    const facile = niveauPrecedentPermis(famille, etat.niveau, o.permis);
    if (etat.objectif > niv.debut || facile < 0) {
      // On baisse un peu l'objectif (au premier niveau : jusqu'à la moitié du début)
      const plancher = facile < 0 ? objectifPlancher(niv) : niv.debut;
      nouveau.objectif = Math.max(plancher, etat.objectif - niv.pas);
      return { etat: nouveau, type: "baisse",
        message: "↘️ Objectif allégé à " + x + nouveau.objectif + unite + ". Tu vas repartir plus fort !" };
    }
    // Déjà au plus bas de ce niveau : on repasse au niveau plus facile
    const nf = famille.niveaux[facile];
    nouveau.niveau = facile;
    nouveau.objectif = objectifMilieu(nf);
    return { etat: nouveau, type: "descente",
      message: "↘️ On consolide avec " + nf.nom + " (" + x + nouveau.objectif + (nf.unite === "sec" ? " s" : "") + "). Tu reviendras vite au niveau du dessus !" };
  }
  return { etat: nouveau, type: "stagne",
    message: "⏸️ Pas encore : on garde " + x + etat.objectif + unite + ". Ça viendra !" };
}

// Une séance "réussie" (pour l'historique)
function typeReussi(type) { return type === "progres" || type === "niveau" || type === "max" || type === "valide"; }

// Renvoie le lundi 00h00 de la semaine d'une date
function debutSemaine(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const jour = (d.getDay() + 6) % 7; // lundi = 0 ... dimanche = 6
  d.setDate(d.getDate() - jour);
  return d;
}

// Nombre de séances faites depuis lundi
function seancesCetteSemaine(seances, maintenant) {
  const lundi = debutSemaine(maintenant || new Date()).getTime();
  return seances.filter(function (s) { return new Date(s.date).getTime() >= lundi; }).length;
}


// =====================================================================
//  RECORDS PERSONNELS
// =====================================================================

// Meilleure série jamais faite à un niveau (null si jamais fait)
function meilleureSerie(seances, familleId, niveau) {
  let meilleur = null;
  seances.forEach(function (s) {
    s.exercices.forEach(function (e) {
      if (e.famille !== familleId || e.niveau !== niveau) return;
      e.faites.forEach(function (n) { if (meilleur === null || n > meilleur) meilleur = n; });
    });
  });
  return meilleur;
}

// Plus haut niveau où au moins une série a été faite (-1 si aucun)
function niveauMaxAtteint(seances, familleId) {
  let max = -1;
  seances.forEach(function (s) {
    s.exercices.forEach(function (e) {
      if (e.famille === familleId && e.faites.length && e.niveau > max) max = e.niveau;
    });
  });
  return max;
}


// =====================================================================
//  POIDS : la tendance des dernières semaines
// =====================================================================

const RYTHME_IDEAL = 0.35;       // prise de poids : kg par semaine (entre 0,25 et 0,5 kg c'est bien)
const RYTHME_IDEAL_PERTE = 0.5;  // perte de poids : kg par semaine (entre 0,25 et 1 kg)

// Sens visé : +1 = prendre, -1 = perdre, 0 = garder son poids
function sensPoids(pesees, objectif) {
  if (objectif == null || !pesees.length) return 0;
  const depart = pesees[0].kg;
  if (objectif > depart + 0.2) return 1;
  if (objectif < depart - 0.2) return -1;
  return 0;
}

// Renvoie { type, parSemaine, dateObjectif, sens }
//   type : "attente" (pas assez de pesées), "atteint", "stagne", "bon", "rapide",
//          "inverse" (ça va dans le mauvais sens), "stable", "hausse", "baisse"
function tendancePoids(pesees, objectif, maintenant, sens) {
  const JOUR = 86400000;
  if (!pesees.length) return { type: "attente", sens: 0 };
  if (sens == null) sens = sensPoids(pesees, objectif);
  const dernier = pesees[pesees.length - 1];
  if (sens > 0 && dernier.kg >= objectif) return { type: "atteint", sens: sens };
  if (sens < 0 && dernier.kg <= objectif) return { type: "atteint", sens: sens };

  // On regarde les 4 dernières semaines (ou tout, s'il y a moins de données)
  let liste = pesees.filter(function (p) { return new Date(dernier.date) - new Date(p.date) <= 28 * JOUR; });
  if (liste.length < 2) liste = pesees.slice(-2);
  if (liste.length < 2) return { type: "attente", sens: sens };
  const etendue = (new Date(liste[liste.length - 1].date) - new Date(liste[0].date)) / JOUR;
  if (etendue < 10) return { type: "attente", sens: sens };

  // Droite qui passe au mieux par les points (régression linéaire)
  const t0 = new Date(liste[0].date).getTime();
  const xs = liste.map(function (p) { return (new Date(p.date).getTime() - t0) / JOUR; });
  const ys = liste.map(function (p) { return p.kg; });
  const mx = xs.reduce(function (a, b) { return a + b; }) / xs.length;
  const my = ys.reduce(function (a, b) { return a + b; }) / ys.length;
  let num = 0, den = 0;
  xs.forEach(function (x, i) { num += (x - mx) * (ys[i] - my); den += (x - mx) * (x - mx); });
  const parSemaine = Math.round(num / den * 7 * 100) / 100;

  let type;
  if (sens === 0) {
    type = parSemaine > 0.2 ? "hausse" : parSemaine < -0.2 ? "baisse" : "stable";
    return { type: type, parSemaine: parSemaine, dateObjectif: null, sens: 0 };
  }
  // v = la vitesse "dans le bon sens" (positive si on avance vers l'objectif)
  const v = parSemaine * sens;
  const trop = sens > 0 ? 0.6 : 1.0;
  if (v < -0.05) type = sens > 0 ? "baisse" : "inverse";
  else if (v < 0.1) type = "stagne";
  else if (v > trop) type = "rapide";
  else type = "bon";

  let dateObjectif = null;
  if (v >= 0.1) {
    const semaines = Math.abs(objectif - dernier.kg) / v;
    dateObjectif = new Date(new Date(dernier.date).getTime() + semaines * 7 * JOUR);
  }
  return { type: type, parSemaine: parSemaine, dateObjectif: dateObjectif, sens: sens };
}
