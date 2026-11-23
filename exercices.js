// =====================================================================
//  exercices.js — LA LISTE DES EXERCICES
// ---------------------------------------------------------------------
//  4 familles. Chaque famille a des niveaux, du plus facile au plus dur.
//
//  Pour chaque niveau :
//    nom    : le nom affiché
//    desc   : comment bien faire l'exercice
//    unite  : "reps" (répétitions) ou "sec" (secondes)
//    debut  : objectif par série quand on arrive à ce niveau
//    max    : objectif à atteindre pour passer au niveau suivant
//    pas    : de combien l'objectif augmente après une séance réussie
//
//  Tu peux modifier ce fichier pour ajouter / changer des exercices.
// =====================================================================

const FAMILLES = [
  {
    id: "tractions",
    nom: "Tractions",
    emoji: "🧗",
    series: 3,
    repos: 90, // secondes de repos entre les séries
    niveaux: [
      { nom: "Suspension active", unite: "sec", debut: 15, max: 40, pas: 5,
        desc: "Suspends-toi à la barre, bras tendus. Tire les épaules vers le bas (loin des oreilles) et serre les omoplates. Garde les jambes serrées, sans te balancer." },
      { nom: "Tractions australiennes", unite: "reps", debut: 6, max: 12, pas: 1,
        desc: "Barre basse (hauteur de hanches), pieds au sol, corps bien droit comme une planche. Tire la poitrine jusqu'à la barre, puis redescends lentement. Plus tes pieds sont loin devant, plus c'est dur." },
      { nom: "Tractions négatives", unite: "reps", debut: 3, max: 8, pas: 1,
        desc: "Monte menton au-dessus de la barre en sautant (ou avec une chaise). Puis descends le plus LENTEMENT possible (3 à 5 secondes) jusqu'aux bras tendus." },
      { nom: "Tractions assistées (élastique)", unite: "reps", debut: 5, max: 10, pas: 1,
        desc: "Accroche un élastique à la barre et mets un pied ou un genou dedans. Tire jusqu'à passer le menton au-dessus de la barre, redescends bras tendus. Pas d'élastique ? Garde un pied posé sur une chaise et pousse le moins possible." },
      { nom: "Tractions complètes", unite: "reps", debut: 3, max: 10, pas: 1,
        desc: "Prise un peu plus large que les épaules, paumes vers l'avant. Pars bras tendus, tire jusqu'au menton au-dessus de la barre, redescends contrôlé. Pas d'élan avec les jambes." },
      { nom: "Tractions prise serrée", unite: "reps", debut: 5, max: 10, pas: 1,
        desc: "Mains rapprochées (largeur de poing à épaules). Même mouvement que la traction classique, poitrine vers la barre, coudes près du corps." },
      { nom: "Tractions archer", unite: "reps", debut: 2, max: 6, pas: 1,
        desc: "Prise très large. Tire vers une main en gardant l'autre bras presque tendu sur la barre. Alterne les côtés : 1 répétition = 1 côté gauche + 1 côté droit." },
      { nom: "Tractions lestées", unite: "reps", debut: 5, max: 10, pas: 1,
        desc: "Tractions complètes avec du poids (sac à dos avec des bouteilles/livres, ou ceinture de lest). Commence avec 2 à 5 kg. Quand tu atteins l'objectif max, ajoute 2,5 kg et recommence." },
    ],
  },
  {
    id: "pompes",
    nom: "Pompes",
    emoji: "💪",
    series: 3,
    repos: 90,
    niveaux: [
      { nom: "Pompes inclinées", unite: "reps", debut: 6, max: 15, pas: 1,
        desc: "Mains sur un support en hauteur (table, banc, rebord). Corps bien droit de la tête aux pieds. Descends la poitrine jusqu'au support, coudes à environ 45° du corps, puis pousse." },
      { nom: "Pompes sur les genoux", unite: "reps", debut: 6, max: 15, pas: 1,
        desc: "Genoux au sol, corps droit des genoux à la tête (pas les fesses en l'air). Mains un peu plus larges que les épaules. Poitrine presque au sol, puis pousse." },
      { nom: "Pompes classiques", unite: "reps", debut: 5, max: 15, pas: 1,
        desc: "Mains sous les épaules, corps gainé (fesses et abdos serrés). Descends jusqu'à frôler le sol avec la poitrine, coudes à 45°, puis remonte bras tendus." },
      { nom: "Pompes diamant", unite: "reps", debut: 5, max: 12, pas: 1,
        desc: "Mains rapprochées sous la poitrine, pouces et index qui forment un losange. Coudes près du corps. Travaille beaucoup les triceps." },
      { nom: "Pompes déclinées", unite: "reps", debut: 6, max: 15, pas: 1,
        desc: "Pieds surélevés sur un banc ou une chaise, mains au sol. Garde le corps bien droit. Plus les pieds sont hauts, plus c'est dur." },
      { nom: "Pompes archer", unite: "reps", debut: 3, max: 8, pas: 1,
        desc: "Mains très écartées. Descends vers une main en gardant l'autre bras tendu sur le côté. Alterne : 1 répétition = 1 côté gauche + 1 côté droit." },
      { nom: "Pompes pseudo-planche", unite: "reps", debut: 5, max: 12, pas: 1,
        desc: "Mains au niveau des hanches, doigts tournés vers l'extérieur ou les pieds. Penche le corps vers l'avant, épaules au-delà des mains. Très dur pour les épaules : vas-y progressivement." },
    ],
  },
  {
    id: "abdos",
    nom: "Abdos",
    emoji: "🔥",
    series: 3,
    repos: 60,
    niveaux: [
      { nom: "Crunchs", unite: "reps", debut: 10, max: 20, pas: 2,
        desc: "Sur le dos, genoux pliés, pieds au sol. Enroule le haut du dos pour décoller les épaules, en soufflant. Ne tire pas sur la nuque avec les mains." },
      { nom: "Relevés de genoux au sol", unite: "reps", debut: 8, max: 15, pas: 1,
        desc: "Sur le dos, mains sous les fesses. Ramène les genoux vers la poitrine en décollant légèrement le bassin, puis redescends sans toucher le sol avec les pieds." },
      { nom: "Relevés de jambes au sol", unite: "reps", debut: 6, max: 15, pas: 1,
        desc: "Sur le dos, jambes tendues, bas du dos COLLÉ au sol. Monte les jambes à la verticale puis redescends lentement jusqu'à frôler le sol." },
      { nom: "Relevés de genoux suspendu", unite: "reps", debut: 6, max: 12, pas: 1,
        desc: "Suspendu à la barre, épaules engagées. Monte les genoux jusqu'à la poitrine en enroulant le bassin, sans te balancer. Redescends contrôlé." },
      { nom: "Relevés de jambes suspendu", unite: "reps", debut: 5, max: 12, pas: 1,
        desc: "Suspendu à la barre, jambes tendues. Monte les jambes jusqu'à l'horizontale (ou plus haut), sans élan." },
      { nom: "Toes to bar", unite: "reps", debut: 3, max: 10, pas: 1,
        desc: "Suspendu à la barre, monte les pieds jusqu'à toucher la barre, jambes le plus tendues possible. Redescends lentement pour ne pas te balancer." },
    ],
  },
  {
    id: "gainage",
    nom: "Gainage",
    emoji: "🧱",
    series: 3,
    repos: 60,
    niveaux: [
      { nom: "Planche", unite: "sec", debut: 20, max: 60, pas: 5,
        desc: "Sur les avant-bras et la pointe des pieds. Corps droit : serre les fesses et les abdos, ne creuse pas le dos, regarde le sol." },
      { nom: "Planche latérale", unite: "sec", debut: 15, max: 45, pas: 5,
        desc: "Sur un avant-bras, coude sous l'épaule, corps de côté bien aligné, hanches hautes. Fais le temps indiqué de CHAQUE côté." },
      { nom: "Planche avec levée bras/jambe", unite: "sec", debut: 20, max: 60, pas: 5,
        desc: "En planche sur les mains, lève le bras droit et la jambe gauche tendus, tiens 2 secondes, change de côté. Le bassin ne doit pas tourner." },
      { nom: "Hollow body", unite: "sec", debut: 15, max: 45, pas: 5,
        desc: "Sur le dos, bas du dos plaqué au sol. Décolle les épaules et les jambes tendues, bras tendus derrière la tête : ton corps forme une banane. Trop dur ? Plie les genoux." },
      { nom: "Tuck L-sit", unite: "sec", debut: 5, max: 20, pas: 2,
        desc: "Mains au sol (ou sur 2 chaises / parallettes), bras tendus, pousse fort pour décoller les fesses. Garde les genoux repliés contre la poitrine." },
      { nom: "L-sit", unite: "sec", debut: 5, max: 20, pas: 2,
        desc: "Comme le tuck L-sit, mais jambes tendues devant toi à l'horizontale. Pointe les pieds, épaules basses, bras verrouillés." },
    ],
  },
];
