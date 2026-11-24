// =====================================================================
//  progression.js — LES RÈGLES DE PROGRESSION
// ---------------------------------------------------------------------
//  Pour chaque famille, on retient :
//    niveau   : le numéro du niveau actuel (0 = le premier)
//    objectif : le nombre de répétitions (ou secondes) visé par série
//    echecs   : combien de séances ratées d'affilée sur cette famille
//
//  Règles :
//   1. Séance réussie (toutes les séries à l'objectif) → objectif + "pas"
//   2. Objectif max réussi → niveau suivant (on repart à "debut")
//   3. Séance ratée → l'objectif ne bouge pas
//   4. 3 ratés d'affilée → l'objectif baisse d'un cran (sécurité)
// =====================================================================

const ECHECS_AVANT_BAISSE = 3;

// État de départ pour une famille, au niveau choisi
function etatInitial(famille, niveau) {
  return { niveau: niveau, objectif: famille.niveaux[niveau].debut, echecs: 0 };
}

// La séance est réussie si TOUTES les séries ont atteint l'objectif
function estReussie(famille, etat, seriesFaites) {
  if (seriesFaites.length < famille.series) return false;
  return seriesFaites.every(function (n) { return n >= etat.objectif; });
}

// Calcule le nouvel état après une séance.
// Renvoie { etat: nouvel état, type: "...", message: "texte à afficher" }
function appliquerResultat(famille, etat, seriesFaites) {
  const niv = famille.niveaux[etat.niveau];
  const unite = niv.unite === "sec" ? " s" : "";
  const nouveau = { niveau: etat.niveau, objectif: etat.objectif, echecs: etat.echecs };

  if (estReussie(famille, etat, seriesFaites)) {
    nouveau.echecs = 0;

    if (etat.objectif >= niv.max) {
      // Objectif max atteint
      if (etat.niveau < famille.niveaux.length - 1) {
        nouveau.niveau = etat.niveau + 1;
        const suivant = famille.niveaux[nouveau.niveau];
        nouveau.objectif = suivant.debut;
        return { etat: nouveau, type: "niveau",
          message: "🎉 Niveau supérieur : " + suivant.nom + " (" + famille.series + " × " + suivant.debut + (suivant.unite === "sec" ? " s" : "") + ")" };
      }
      return { etat: nouveau, type: "max",
        message: "🏆 Niveau maximum maîtrisé ! Ajoute du lest ou ralentis le mouvement." };
    }

    nouveau.objectif = Math.min(niv.max, etat.objectif + niv.pas);
    return { etat: nouveau, type: "progres",
      message: "✅ Réussi ! Prochain objectif : " + famille.series + " × " + nouveau.objectif + unite };
  }

  // Séance ratée
  nouveau.echecs = etat.echecs + 1;
  if (nouveau.echecs >= ECHECS_AVANT_BAISSE) {
    nouveau.objectif = Math.max(niv.debut, etat.objectif - niv.pas);
    nouveau.echecs = 0;
    return { etat: nouveau, type: "baisse",
      message: "↘️ 3 ratés de suite : objectif allégé à " + famille.series + " × " + nouveau.objectif + unite + ". Tu vas repartir plus fort !" };
  }
  return { etat: nouveau, type: "stagne",
    message: "⏸️ Pas encore : on garde " + famille.series + " × " + etat.objectif + unite + " (" + nouveau.echecs + "/" + ECHECS_AVANT_BAISSE + ")" };
}

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
//  PRISE DE POIDS : la tendance des dernières semaines
// =====================================================================

const RYTHME_IDEAL = 0.35; // kg par semaine (entre 0,25 et 0,5 kg c'est bien)

// Renvoie { type, parSemaine, dateObjectif }
//   type : "attente" (pas assez de pesées), "atteint", "stagne", "bon", "rapide", "baisse"
function tendancePoids(pesees, objectif, maintenant) {
  maintenant = maintenant || new Date();
  const JOUR = 86400000;
  if (!pesees.length) return { type: "attente" };
  const dernier = pesees[pesees.length - 1];
  if (dernier.kg >= objectif) return { type: "atteint" };

  // On regarde les 4 dernières semaines (ou tout, s'il y a moins de données)
  let liste = pesees.filter(function (p) { return new Date(dernier.date) - new Date(p.date) <= 28 * JOUR; });
  if (liste.length < 2) liste = pesees.slice(-2);
  const etendue = (new Date(liste[liste.length - 1].date) - new Date(liste[0].date)) / JOUR;
  if (liste.length < 2 || etendue < 10) return { type: "attente" };

  // Droite qui passe au mieux par les points (régression linéaire)
  const t0 = new Date(liste[0].date).getTime();
  const xs = liste.map(function (p) { return (new Date(p.date).getTime() - t0) / JOUR; });
  const ys = liste.map(function (p) { return p.kg; });
  const mx = xs.reduce(function (a, b) { return a + b; }) / xs.length;
  const my = ys.reduce(function (a, b) { return a + b; }) / ys.length;
  let num = 0, den = 0;
  xs.forEach(function (x, i) { num += (x - mx) * (ys[i] - my); den += (x - mx) * (x - mx); });
  const parSemaine = Math.round(num / den * 7 * 100) / 100;

  let type = "bon";
  if (parSemaine < -0.05) type = "baisse";
  else if (parSemaine < 0.1) type = "stagne";
  else if (parSemaine > 0.6) type = "rapide";

  let dateObjectif = null;
  if (parSemaine >= 0.1) {
    const semaines = (objectif - dernier.kg) / parSemaine;
    dateObjectif = new Date(new Date(dernier.date).getTime() + semaines * 7 * JOUR);
  }
  return { type: type, parSemaine: parSemaine, dateObjectif: dateObjectif };
}
