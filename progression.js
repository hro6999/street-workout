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
