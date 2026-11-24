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
//    points : les points clés pour bien faire le mouvement
//    erreurs: les erreurs à éviter
//
//  Chaque niveau a son animation dans animations.js
//  (nom : "famille-numéro", par exemple "pompes-2" = pompes classiques).
//
//  Tu peux modifier ce fichier pour ajouter / changer des exercices.
// =====================================================================

const FAMILLES = [
  {
    id: "tractions",
    nom: "Tractions",
    series: 3,
    repos: 90, // secondes de repos entre les séries
    niveaux: [
      { nom: "Suspension active", unite: "sec", debut: 15, max: 40, pas: 5,
        desc: "Suspends-toi à la barre, bras tendus. Tire les épaules vers le bas (loin des oreilles) et serre les omoplates. Garde les jambes serrées, sans te balancer.",
        points: ["Bras tendus, épaules tirées vers le bas", "Omoplates serrées, poitrine sortie", "Jambes serrées, corps immobile"],
        erreurs: ["Pendre « mou », épaules collées aux oreilles", "Se balancer"] },
      { nom: "Tractions australiennes", unite: "reps", debut: 6, max: 12, pas: 1,
        desc: "Barre basse (hauteur de hanches), pieds au sol, corps bien droit comme une planche. Tire la poitrine jusqu'à la barre, puis redescends lentement. Plus tes pieds sont loin devant, plus c'est dur.",
        points: ["Corps droit comme une planche", "Tire la poitrine jusqu'à la barre", "Descente lente, bras tendus en bas"],
        erreurs: ["Fesses qui tombent", "Tirer avec le cou au lieu du dos"] },
      { nom: "Tractions négatives", unite: "reps", debut: 3, max: 8, pas: 1,
        desc: "Monte menton au-dessus de la barre en sautant (ou avec une chaise). Puis descends le plus LENTEMENT possible (3 à 5 secondes) jusqu'aux bras tendus.",
        points: ["Pars menton au-dessus de la barre", "Descends en 3 à 5 secondes", "Finis bras tendus"],
        erreurs: ["Se laisser tomber d'un coup", "Monter en tirant au lieu de sauter (garde ta force pour la descente)"] },
      { nom: "Tractions assistées (élastique)", unite: "reps", debut: 5, max: 10, pas: 1,
        desc: "Accroche un élastique à la barre et mets un pied ou un genou dedans. Tire jusqu'à passer le menton au-dessus de la barre, redescends bras tendus. Pas d'élastique ? Garde un pied posé sur une chaise et pousse le moins possible.",
        points: ["Pars bras tendus", "Menton au-dessus de la barre", "Descente contrôlée"],
        erreurs: ["Rebondir en bas grâce à l'élastique", "Demi-mouvements"] },
      { nom: "Tractions complètes", unite: "reps", debut: 3, max: 10, pas: 1,
        desc: "Prise un peu plus large que les épaules, paumes vers l'avant. Pars bras tendus, tire jusqu'au menton au-dessus de la barre, redescends contrôlé. Pas d'élan avec les jambes.",
        points: ["Pars bras tendus, épaules engagées", "Tire les coudes vers les côtes", "Menton au-dessus de la barre"],
        erreurs: ["Élan avec les jambes", "Remonter avant d'avoir tendu les bras"] },
      { nom: "Tractions prise serrée", unite: "reps", debut: 5, max: 10, pas: 1,
        desc: "Mains rapprochées (largeur de poing à épaules). Même mouvement que la traction classique, poitrine vers la barre, coudes près du corps.",
        points: ["Mains rapprochées", "Coudes près du corps", "Poitrine vers la barre"],
        erreurs: ["Coudes qui s'écartent", "Mouvement incomplet en bas"] },
      { nom: "Tractions archer", unite: "reps", debut: 2, max: 6, pas: 1,
        desc: "Prise très large. Tire vers une main en gardant l'autre bras presque tendu sur la barre. Alterne les côtés : 1 répétition = 1 côté gauche + 1 côté droit.",
        points: ["Prise très large", "Monte vers une main", "L'autre bras reste presque tendu"],
        erreurs: ["Plier les deux bras pareil", "Oublier d'alterner les côtés"] },
      { nom: "Tractions lestées", unite: "reps", debut: 5, max: 10, pas: 1,
        desc: "Tractions complètes avec du poids (sac à dos avec des bouteilles/livres, ou ceinture de lest). Commence avec 2 à 5 kg. Quand tu atteins l'objectif max, ajoute 2,5 kg et recommence.",
        points: ["Commence léger (2 à 5 kg)", "Même technique que sans lest", "Poids collé au corps"],
        erreurs: ["Charger trop vite", "Sac qui se balance"] },
    ],
  },
  {
    id: "pompes",
    nom: "Pompes",
    series: 3,
    repos: 90,
    niveaux: [
      { nom: "Pompes inclinées", unite: "reps", debut: 6, max: 15, pas: 1,
        desc: "Mains sur un support en hauteur (table, banc, rebord). Corps bien droit de la tête aux pieds. Descends la poitrine jusqu'au support, coudes à environ 45° du corps, puis pousse.",
        points: ["Mains sur un support stable", "Corps droit de la tête aux pieds", "Poitrine jusqu'au support"],
        erreurs: ["Fesses en l'air", "Coudes écartés à 90°"] },
      { nom: "Pompes sur les genoux", unite: "reps", debut: 6, max: 15, pas: 1,
        desc: "Genoux au sol, corps droit des genoux à la tête (pas les fesses en l'air). Mains un peu plus larges que les épaules. Poitrine presque au sol, puis pousse.",
        points: ["Corps droit des genoux à la tête", "Mains un peu plus larges que les épaules", "Poitrine presque au sol"],
        erreurs: ["Fesses en l'air", "Tête qui pique vers le sol"] },
      { nom: "Pompes classiques", unite: "reps", debut: 5, max: 15, pas: 1,
        desc: "Mains sous les épaules, corps gainé (fesses et abdos serrés). Descends jusqu'à frôler le sol avec la poitrine, coudes à 45°, puis remonte bras tendus.",
        points: ["Mains sous les épaules", "Fesses et abdos serrés", "Coudes à 45° du corps"],
        erreurs: ["Dos creusé (ventre qui tombe)", "Mouvement trop court"] },
      { nom: "Pompes diamant", unite: "reps", debut: 5, max: 12, pas: 1,
        desc: "Mains rapprochées sous la poitrine, pouces et index qui forment un losange. Coudes près du corps. Travaille beaucoup les triceps.",
        points: ["Mains en losange sous la poitrine", "Coudes près du corps", "Descente contrôlée"],
        erreurs: ["Coudes qui s'ouvrent", "Poignets douloureux : élargis un peu les mains"] },
      { nom: "Pompes déclinées", unite: "reps", debut: 6, max: 15, pas: 1,
        desc: "Pieds surélevés sur un banc ou une chaise, mains au sol. Garde le corps bien droit. Plus les pieds sont hauts, plus c'est dur.",
        points: ["Pieds sur un support", "Corps bien droit", "Tête dans l'alignement"],
        erreurs: ["Bassin qui casse", "Support qui glisse"] },
      { nom: "Pompes archer", unite: "reps", debut: 3, max: 8, pas: 1,
        desc: "Mains très écartées. Descends vers une main en gardant l'autre bras tendu sur le côté. Alterne : 1 répétition = 1 côté gauche + 1 côté droit.",
        points: ["Mains très écartées", "Descends vers une main", "L'autre bras reste tendu"],
        erreurs: ["Plier les deux bras", "Oublier d'alterner les côtés"] },
      { nom: "Pompes pseudo-planche", unite: "reps", debut: 5, max: 12, pas: 1,
        desc: "Mains au niveau des hanches, doigts tournés vers l'extérieur ou les pieds. Penche le corps vers l'avant, épaules au-delà des mains. Très dur pour les épaules : vas-y progressivement.",
        points: ["Mains au niveau des hanches", "Épaules en avant des mains", "Bras et corps gainés"],
        erreurs: ["Aller trop vite : les poignets et les épaules doivent s'habituer", "Fesses en l'air"] },
    ],
  },
  {
    id: "abdos",
    nom: "Abdos",
    series: 3,
    repos: 60,
    niveaux: [
      { nom: "Crunchs", unite: "reps", debut: 10, max: 20, pas: 2,
        desc: "Sur le dos, genoux pliés, pieds au sol. Enroule le haut du dos pour décoller les épaules, en soufflant. Ne tire pas sur la nuque avec les mains.",
        points: ["Enroule le haut du dos", "Souffle en montant", "Regard vers le plafond"],
        erreurs: ["Tirer sur la nuque", "Monter avec l'élan"] },
      { nom: "Relevés de genoux au sol", unite: "reps", debut: 8, max: 15, pas: 1,
        desc: "Sur le dos, mains sous les fesses. Ramène les genoux vers la poitrine en décollant légèrement le bassin, puis redescends sans toucher le sol avec les pieds.",
        points: ["Mains sous les fesses", "Genoux vers la poitrine", "Pieds ne touchent pas le sol en bas"],
        erreurs: ["Bas du dos qui se creuse", "Aller trop vite"] },
      { nom: "Relevés de jambes au sol", unite: "reps", debut: 6, max: 15, pas: 1,
        desc: "Sur le dos, jambes tendues, bas du dos COLLÉ au sol. Monte les jambes à la verticale puis redescends lentement jusqu'à frôler le sol.",
        points: ["Bas du dos COLLÉ au sol", "Jambes tendues", "Descente lente"],
        erreurs: ["Dos qui se décolle en bas", "Rebondir avec les pieds"] },
      { nom: "Relevés de genoux suspendu", unite: "reps", debut: 6, max: 12, pas: 1,
        desc: "Suspendu à la barre, épaules engagées. Monte les genoux jusqu'à la poitrine en enroulant le bassin, sans te balancer. Redescends contrôlé.",
        points: ["Épaules engagées", "Genoux à la poitrine", "Enroule le bassin"],
        erreurs: ["Se balancer", "Juste lever les cuisses sans enrouler"] },
      { nom: "Relevés de jambes suspendu", unite: "reps", debut: 5, max: 12, pas: 1,
        desc: "Suspendu à la barre, jambes tendues. Monte les jambes jusqu'à l'horizontale (ou plus haut), sans élan.",
        points: ["Jambes tendues", "Monte au moins à l'horizontale", "Sans élan"],
        erreurs: ["Se balancer", "Plier les genoux pour tricher"] },
      { nom: "Toes to bar", unite: "reps", debut: 3, max: 10, pas: 1,
        desc: "Suspendu à la barre, monte les pieds jusqu'à toucher la barre, jambes le plus tendues possible. Redescends lentement pour ne pas te balancer.",
        points: ["Pieds jusqu'à la barre", "Jambes le plus tendues possible", "Redescends lentement"],
        erreurs: ["Gros balancement", "Bras qui plient beaucoup"] },
    ],
  },
  {
    id: "gainage",
    nom: "Gainage",
    series: 3,
    repos: 60,
    niveaux: [
      { nom: "Planche", unite: "sec", debut: 20, max: 60, pas: 5,
        desc: "Sur les avant-bras et la pointe des pieds. Corps droit : serre les fesses et les abdos, ne creuse pas le dos, regarde le sol.",
        points: ["Coudes sous les épaules", "Fesses et abdos serrés", "Regard vers le sol"],
        erreurs: ["Dos creusé", "Fesses trop hautes"] },
      { nom: "Planche latérale", unite: "sec", debut: 15, max: 45, pas: 5,
        desc: "Sur un avant-bras, coude sous l'épaule, corps de côté bien aligné, hanches hautes. Fais le temps indiqué de CHAQUE côté.",
        points: ["Coude sous l'épaule", "Hanches hautes, corps aligné", "Fais les 2 côtés"],
        erreurs: ["Hanches qui tombent", "Corps qui tourne vers le sol"] },
      { nom: "Planche avec levée bras/jambe", unite: "sec", debut: 20, max: 60, pas: 5,
        desc: "En planche sur les mains, lève le bras droit et la jambe gauche tendus, tiens 2 secondes, change de côté. Le bassin ne doit pas tourner.",
        points: ["Bras et jambe opposés", "Tiens 2 secondes", "Bassin immobile"],
        erreurs: ["Bassin qui tourne", "Aller trop vite"] },
      { nom: "Hollow body", unite: "sec", debut: 15, max: 45, pas: 5,
        desc: "Sur le dos, bas du dos plaqué au sol. Décolle les épaules et les jambes tendues, bras tendus derrière la tête : ton corps forme une banane. Trop dur ? Plie les genoux.",
        points: ["Bas du dos plaqué au sol", "Épaules et jambes décollées", "Le corps forme une banane"],
        erreurs: ["Dos qui se décolle", "Bloquer sa respiration"] },
      { nom: "Tuck L-sit", unite: "sec", debut: 5, max: 20, pas: 2,
        desc: "Mains au sol (ou sur 2 chaises / parallettes), bras tendus, pousse fort pour décoller les fesses. Garde les genoux repliés contre la poitrine.",
        points: ["Bras tendus et verrouillés", "Pousse fort dans les mains", "Genoux contre la poitrine"],
        erreurs: ["Épaules qui remontent aux oreilles", "Bras pliés"] },
      { nom: "L-sit", unite: "sec", debut: 5, max: 20, pas: 2,
        desc: "Comme le tuck L-sit, mais jambes tendues devant toi à l'horizontale. Pointe les pieds, épaules basses, bras verrouillés.",
        points: ["Jambes tendues à l'horizontale", "Pointes de pieds tendues", "Épaules basses"],
        erreurs: ["Jambes qui tombent", "Dos rond et épaules hautes"] },
    ],
  },
];

// =====================================================================
//  L'ÉCHAUFFEMENT GUIDÉ (environ 5 minutes)
//  duree : en secondes · anim : le nom de l'animation (animations.js)
// =====================================================================
const ECHAUFFEMENT = [
  { nom: "Jumping jacks", duree: 45, anim: "echauffement-jumping",
    conseil: "Saute en écartant les bras et les jambes, à ton rythme." },
  { nom: "Cercles de bras", duree: 45, anim: "echauffement-epaules",
    conseil: "Grands cercles, bras tendus. Change de sens à la moitié." },
  { nom: "Rotations des poignets", duree: 30, anim: "echauffement-poignets",
    conseil: "Doigts croisés devant toi, fais des cercles dans les deux sens." },
  { nom: "Squats", duree: 45, anim: "echauffement-squats",
    conseil: "Descends comme pour t'asseoir, talons au sol, dos droit." },
  { nom: "Montées de genoux", duree: 40, anim: "echauffement-genoux",
    conseil: "Sur place, genoux à hauteur des hanches." },
  { nom: "Pompes inclinées douces", duree: 30, anim: "pompes-0",
    conseil: "Lentement et sans forcer : juste pour réveiller les bras." },
  { nom: "Suspension à la barre", duree: 20, anim: "tractions-0",
    conseil: "Bras tendus, épaules basses. Pas de barre ? Serre les omoplates 10 fois." },
  { nom: "Planche", duree: 30, anim: "gainage-0",
    conseil: "Corps bien droit, fesses et abdos serrés." },
];
