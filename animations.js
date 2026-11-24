// =====================================================================
//  animations.js — LES PETITS PERSONNAGES ANIMÉS DES EXERCICES
// ---------------------------------------------------------------------
//  Chaque exercice est dessiné par un personnage "bâton" en SVG
//  (dessin vectoriel : très léger, net sur tous les écrans, et il
//  marche sans internet).
//
//  Comment ça marche :
//   - Une POSE dit où sont la hanche, l'angle du buste, et où vont
//     les mains et les pieds. Le programme calcule tout seul où se
//     placent les coudes et les genoux (comme une vraie articulation).
//   - Une ANIMATION est une liste de poses. Le personnage passe en
//     douceur d'une pose à l'autre, en boucle.
//
//  Repères du dessin : 160 de large, 120 de haut, le haut est en y = 0.
//  Les angles sont en degrés : 0 = vers la droite, 90 = vers le bas,
//  -90 = vers le haut, 180 = vers la gauche.
//  Vue "cote" : le personnage regarde vers la droite.
//  Vue "face" : le personnage est de face (bras 1 = côté droit de l'image).
// =====================================================================

const ANIM = (function () {
  "use strict";

  // Longueur de chaque partie du corps
  const L = { torse: 30, cou: 10, tete: 6.5, bras: 15, avantBras: 14, cuisse: 19, tibia: 19 };
  const SOL = 112;   // la ligne du sol
  const S = 109;     // hauteur d'un pied / d'une main posé(e) au sol
  const JAMBE = L.cuisse + L.tibia;
  const CORPS = JAMBE + L.torse; // des pieds aux épaules

  // ---------- Petits calculs de géométrie ----------
  function dir(a) { const r = a * Math.PI / 180; return [Math.cos(r), Math.sin(r)]; }
  function plus(p, v, k) { return [p[0] + v[0] * k, p[1] + v[1] * k]; }
  function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }

  // Bras ou jambe à 2 segments : de l'épaule (ou hanche) O vers la cible C.
  // "sens" (+1 ou -1) choisit de quel côté plie le coude (ou le genou).
  function membre(O, C, a, b, sens) {
    let d = dist(O, C);
    const base = Math.atan2(C[1] - O[1], C[0] - O[0]);
    d = Math.max(Math.abs(a - b) + 0.01, Math.min(a + b - 0.001, d));
    const angle = Math.acos((a * a + d * d - b * b) / (2 * a * d));
    const J = [O[0] + a * Math.cos(base + sens * angle), O[1] + a * Math.sin(base + sens * angle)];
    const v = [C[0] - J[0], C[1] - J[1]];
    const n = Math.hypot(v[0], v[1]) || 1;
    return [O, J, [J[0] + v[0] / n * b, J[1] + v[1] / n * b]];
  }

  // Une cible est soit un point [x, y], soit { a: angle, r: distance }
  // mesurée depuis l'épaule (pour une main) ou la hanche (pour un pied).
  function cible(c, origine) {
    return Array.isArray(c) ? c : plus(origine, dir(c.a), c.r);
  }

  // Corps bien droit (gainé) qui part des pieds avec un certain angle
  function gaine(pied, angle) {
    return { h: plus(pied, dir(angle), JAMBE), t: angle, p1: pied };
  }
  // Pareil, mais à partir des genoux (pompes sur les genoux)
  function gaineGenoux(genou, angle, pied) {
    return { h: plus(genou, dir(angle), L.cuisse), t: angle, p1: pied };
  }

  // Complète une pose avec les valeurs par défaut
  // Vue de face : par défaut, coudes et genoux plient vers l'extérieur
  function completer(p, vue) {
    const face = vue === "face";
    const q = Object.assign({ hd: 0, c: 1, g: -1 }, p);
    if (q.m2 === undefined) q.m2 = q.m1;
    if (q.p2 === undefined) q.p2 = q.p1;
    if (q.c1 === undefined) q.c1 = face ? 1 : q.c;
    if (q.c2 === undefined) q.c2 = face ? -1 : q.c;
    if (q.g1 === undefined) q.g1 = face ? -1 : q.g;
    if (q.g2 === undefined) q.g2 = face ? 1 : q.g;
    return q;
  }

  // Calcule la position de toutes les articulations pour une pose
  function squelette(p, vue) {
    const d = dir(p.t);
    const perp = [-d[1], d[0]];
    const face = vue === "face";
    const hanche = p.h;
    const epaule = plus(hanche, d, p.tl != null ? p.tl : L.torse);
    const e1 = plus(epaule, perp, face ? 9 : 0), e2 = plus(epaule, perp, face ? -9 : 0);
    const h1 = plus(hanche, perp, face ? 5 : 0), h2 = plus(hanche, perp, face ? -5 : 0);
    return {
      hanche: hanche, epaule: epaule, e1: e1, e2: e2, h1: h1, h2: h2, perp: perp,
      tete: plus(epaule, dir(p.t + p.hd), L.cou),
      m1: membre(e1, cible(p.m1, e1), L.bras, L.avantBras, p.c1),
      m2: membre(e2, cible(p.m2, e2), L.bras, L.avantBras, p.c2),
      j1: membre(h1, cible(p.p1, h1), L.cuisse, L.tibia, p.g1),
      j2: membre(h2, cible(p.p2, h2), L.cuisse, L.tibia, p.g2),
    };
  }

  // Transforme une cible [x, y] en { a, r } (vue depuis l'épaule ou la hanche),
  // pour pouvoir la mélanger avec une cible { a, r }
  function versPolaire(pose, cle, vue, angleVoisin) {
    const p = completer(pose, vue);
    const d = dir(p.t), perp = [-d[1], d[0]];
    const ecart = vue === "face" ? (cle[0] === "m" ? 9 : 5) * (cle[1] === "1" ? 1 : -1) : 0;
    const base = cle[0] === "m" ? plus(p.h, d, p.tl != null ? p.tl : L.torse) : p.h;
    const o = plus(base, perp, ecart);
    const c = p[cle];
    let a = Math.atan2(c[1] - o[1], c[0] - o[0]) * 180 / Math.PI;
    while (a - angleVoisin > 180) a -= 360;
    while (a - angleVoisin < -180) a += 360;
    return { a: a, r: dist(o, c) };
  }

  // Valeurs qu'on ne mélange pas (le côté où plie un coude ou un genou)
  const DISCRET = { c: 1, c1: 1, c2: 1, g: 1, g1: 1, g2: 1 };

  // Mélange deux poses (k = 0 → pose a, k = 1 → pose b)
  function melanger(a, b, k, vue) {
    const r = {};
    Object.keys(b).forEach(function (cle) {
      let x = a[cle], y = b[cle];
      // Une cible point et une cible angle : on convertit le point en angle
      if (x && y && Array.isArray(x) !== Array.isArray(y) && /^[mp][12]$/.test(cle)) {
        if (Array.isArray(x)) x = versPolaire(a, cle, vue, y.a);
        else y = versPolaire(b, cle, vue, x.a);
      }
      if (DISCRET[cle]) r[cle] = k < 0.5 && x !== undefined ? x : y;
      else if (typeof y === "number" && typeof x === "number") r[cle] = x + (y - x) * k;
      else if (Array.isArray(y) && Array.isArray(x)) r[cle] = [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k];
      else if (y && x && typeof y === "object" && !Array.isArray(y) && !Array.isArray(x)) r[cle] = { a: x.a + (y.a - x.a) * k, r: x.r + (y.r - x.r) * k };
      else r[cle] = k < 0.5 && x !== undefined ? x : y;
    });
    return r;
  }

  // Accélère au début et ralentit à la fin : mouvement naturel
  function douceur(k) { return 0.5 - 0.5 * Math.cos(Math.PI * k); }

  // Pose à l'instant "ms" de l'animation
  function poseA(def, ms, vue) {
    const etapes = def.etapes;
    let total = 0;
    etapes.forEach(function (e) { total += (e.d || 0) + (e.h || 0); });
    let t = total ? ms % total : 0;
    for (let i = 0; i < etapes.length; i++) {
      const e = etapes[i], avant = etapes[(i - 1 + etapes.length) % etapes.length];
      const d = e.d || 0;
      if (t < d) return melanger(avant.pose, e.pose, douceur(t / d), vue);
      t -= d;
      if (t < (e.h || 0)) return e.pose;
      t -= e.h || 0;
    }
    return etapes[0].pose;
  }

  // ---------- Le décor (barre, sol, banc…) ----------
  const DECORS = {
    sol: function () { return '<line class="sol" x1="0" y1="' + SOL + '" x2="160" y2="' + SOL + '"/>'; },
    // barre vue de côté : un rond + le poteau derrière
    barreCote: function (x, y) {
      return '<line class="poteau" x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="120"/>' +
        '<circle class="barre" cx="' + x + '" cy="' + y + '" r="3.2"/>';
    },
    // barre vue de face : une ligne + deux poteaux
    barreFace: function (x1, x2, y) {
      return '<line class="poteau" x1="' + x1 + '" y1="' + y + '" x2="' + x1 + '" y2="120"/>' +
        '<line class="poteau" x1="' + x2 + '" y1="' + y + '" x2="' + x2 + '" y2="120"/>' +
        '<line class="barre-face" x1="' + (x1 - 4) + '" y1="' + y + '" x2="' + (x2 + 4) + '" y2="' + y + '"/>';
    },
    banc: function (x, y, l) {
      return '<rect class="meuble" x="' + x + '" y="' + y + '" width="' + l + '" height="' + (SOL - y) + '" rx="2"/>';
    },
    parallette: function (x, y) {
      return '<path class="poteau" d="M' + (x - 9) + " " + SOL + " L" + (x - 5) + " " + y + " L" + (x + 5) + " " + y + " L" + (x + 9) + " " + SOL + '"/>' +
        '<circle class="barre" cx="' + x + '" cy="' + y + '" r="3"/>';
    },
  };

  // ---------- Les animations ----------
  // Chaque étape : pose = la position, d = durée pour y aller (ms), h = temps de pause (ms)
  // cle = numéro de l'étape utilisée pour l'image fixe
  const A = {};

  // ===== TRACTIONS =====
  const BF = function () { return [["barreFace", 44, 116, 14]]; };
  const piedsPendus = function (hx, hy) { return { p1: [hx + 4, hy + 37], p2: [hx - 4, hy + 37] }; };

  A["tractions-0"] = { vue: "face", decor: BF(), cle: 1, etapes: [
    { pose: Object.assign({ h: [80, 74], t: -90, m1: [96, 14], m2: [64, 14] }, piedsPendus(80, 74)), d: 900, h: 900 },
    { pose: Object.assign({ h: [80, 70.5], t: -90, m1: [96, 14], m2: [64, 14] }, piedsPendus(80, 70.5)), d: 700, h: 1800 },
  ] };

  A["tractions-1"] = { vue: "cote", decor: [["sol"], ["barreCote", 114, 64]], cle: 1, etapes: [
    { pose: Object.assign(gaine([44, S], -14), { m1: [114, 64], c: 1, hd: 6 }), d: 1100, h: 400 },
    { pose: Object.assign(gaine([44, S], -30), { m1: [114, 64], c: 1, hd: 8 }), d: 900, h: 500 },
  ] };

  A["tractions-2"] = { vue: "cote", decor: [["barreCote", 90, 14]], cle: 1, etapes: [
    { pose: { h: [86, 71], t: -92, m1: [90, 14], c: 1, p1: { a: 96, r: 37 }, p2: { a: 92, r: 37 } }, d: 600, h: 500 },
    { pose: { h: [83, 46], t: -94, m1: [90, 14], c: 1, p1: { a: 115, r: 33 }, p2: { a: 110, r: 33 } }, d: 500, h: 500 },
    { pose: { h: [86, 71], t: -92, m1: [90, 14], c: 1, p1: { a: 96, r: 37 }, p2: { a: 92, r: 37 } }, d: 4000, h: 0 },
  ] };

  // droite = main du côté droit de l'image, gauche = l'autre
  const tractionFace = function (h, gauche, droite, plie) {
    return Object.assign({ h: h, t: -90, m1: droite, m2: gauche },
      plie ? { p1: [h[0] + 6, h[1] + 33], p2: [h[0] - 6, h[1] + 33] } : piedsPendus(h[0], h[1]));
  };

  A["tractions-3"] = { vue: "face", decor: BF().concat([["elastique"]]), cle: 1, etapes: [
    { pose: tractionFace([80, 73], [64, 14], [96, 14], true), d: 1500, h: 400 },
    { pose: tractionFace([80, 50], [64, 14], [96, 14], true), d: 1200, h: 400 },
  ] };

  A["tractions-4"] = { vue: "face", decor: BF(), cle: 1, etapes: [
    { pose: tractionFace([80, 72], [62, 14], [98, 14]), d: 1500, h: 400 },
    { pose: tractionFace([80, 50], [62, 14], [98, 14]), d: 1100, h: 400 },
  ] };

  A["tractions-5"] = { vue: "face", decor: BF(), cle: 1, etapes: [
    { pose: tractionFace([80, 74], [75, 14], [85, 14]), d: 1500, h: 400 },
    { pose: tractionFace([80, 52], [75, 14], [85, 14]), d: 1100, h: 400 },
  ] };

  A["tractions-6"] = { vue: "face", decor: [["barreFace", 30, 130, 14]], cle: 1, etapes: [
    { pose: tractionFace([80, 62], [48, 14], [112, 14]), d: 1300, h: 300 },
    { pose: tractionFace([92, 50], [48, 14], [112, 14]), d: 1200, h: 400 },
    { pose: tractionFace([80, 62], [48, 14], [112, 14]), d: 1300, h: 300 },
    { pose: tractionFace([68, 50], [48, 14], [112, 14]), d: 1200, h: 400 },
  ] };

  A["tractions-7"] = { vue: "cote", decor: [["barreCote", 90, 14], ["sac"]], cle: 1, etapes: [
    { pose: { h: [86, 71], t: -92, m1: [90, 14], c: 1, p1: { a: 100, r: 36 }, p2: { a: 96, r: 36 } }, d: 1500, h: 400 },
    { pose: { h: [82, 46], t: -95, m1: [90, 14], c: 1, p1: { a: 115, r: 32 }, p2: { a: 110, r: 32 } }, d: 1200, h: 400 },
  ] };

  // ===== POMPES =====
  A["pompes-0"] = { vue: "cote", decor: [["sol"], ["banc", 98, 96, 42]], cle: 0, etapes: [
    { pose: Object.assign(gaine([54, S], -40.3), { m1: [107, 93], hd: 25 }), d: 1100, h: 300 },
    { pose: Object.assign(gaine([54, S], -19.8), { m1: [107, 93], hd: 15 }), d: 1300, h: 200 },
  ] };

  A["pompes-1"] = { vue: "cote", decor: [["sol"]], cle: 0, etapes: [
    { pose: Object.assign(gaineGenoux([70, S], -36, [52, S - 3]), { m1: [109, S], g: 1, hd: 30 }), d: 1100, h: 300 },
    { pose: Object.assign(gaineGenoux([70, S], -11, [52, S - 3]), { m1: [109, S], g: 1, hd: 15 }), d: 1300, h: 200 },
  ] };

  A["pompes-2"] = { vue: "cote", decor: [["sol"]], cle: 0, etapes: [
    { pose: Object.assign(gaine([42, S], -25), { m1: [106, S], hd: 25 }), d: 1100, h: 300 },
    { pose: Object.assign(gaine([42, S], -8), { m1: [106, S], hd: 10 }), d: 1300, h: 200 },
  ] };

  A["pompes-3"] = { vue: "cote", decor: [["sol"]], cle: 0, etapes: [
    { pose: Object.assign(gaine([42, S], -24), { m1: [100, S], hd: 25 }), d: 1100, h: 300 },
    { pose: Object.assign(gaine([42, S], -9), { m1: [100, S], hd: 10 }), d: 1300, h: 200 },
  ] };

  A["pompes-4"] = { vue: "cote", decor: [["sol"], ["banc", 14, 88, 32]], cle: 0, etapes: [
    { pose: Object.assign(gaine([30, 85], -4), { m1: [96, S], hd: 30 }), d: 1100, h: 300 },
    { pose: Object.assign(gaine([30, 85], 11), { m1: [96, S], hd: -5 }), d: 1300, h: 200 },
  ] };

  // Pompes archer : vues de face (on voit la tête et les épaules, les jambes sont derrière)
  // (le buste est vu "en raccourci" : la tête est sous les épaules, face au sol)
  const archer = function (x, y) { return { h: [x, y + 4], t: -90, tl: 4, hd: 180, m1: [108, S], m2: [52, S], p1: [x, y], p2: [x, y] }; };
  A["pompes-5"] = { vue: "face", decor: [["sol"]], cle: 1, jambes: false, cadre: "36 62 88 66", etapes: [
    { pose: archer(80, 84), d: 1000, h: 300 },
    { pose: archer(91, 100), d: 1200, h: 300 },
    { pose: archer(80, 84), d: 1000, h: 300 },
    { pose: archer(69, 100), d: 1200, h: 300 },
  ] };

  A["pompes-6"] = { vue: "cote", decor: [["sol"]], cle: 0, etapes: [
    { pose: Object.assign(gaine([38, S], -24), { m1: [88, S], c: 1, hd: 25 }), d: 1200, h: 300 },
    { pose: Object.assign(gaine([38, S], -9), { m1: [88, S], c: 1, hd: 10 }), d: 1400, h: 200 },
  ] };

  // ===== ABDOS (allongé sur le dos, la tête à droite) =====
  A["abdos-0"] = { vue: "cote", decor: [["sol"]], cle: 1, etapes: [
    { pose: { h: [70, 106], t: 0, hd: -10, m1: [104, 100], c: 1, p1: [42, S], g: 1 }, d: 1000, h: 300 },
    { pose: { h: [70, 106], t: -32, hd: 0, m1: [96, 83], c: 1, p1: [42, S], g: 1 }, d: 900, h: 400 },
  ] };

  A["abdos-1"] = { vue: "cote", decor: [["sol"]], cle: 1, etapes: [
    { pose: { h: [72, 106], t: -2, m1: [74, S], c: 1, p1: { a: 172, r: 37 }, g: 1 }, d: 1200, h: 300 },
    { pose: { h: [72, 104], t: 2, m1: [74, S], c: 1, p1: { a: 235, r: 16 }, g: 1 }, d: 1000, h: 300 },
  ] };

  A["abdos-2"] = { vue: "cote", decor: [["sol"]], cle: 1, etapes: [
    { pose: { h: [72, 106], t: -2, m1: [74, S], c: 1, p1: { a: 174, r: 38 }, g: 1 }, d: 1600, h: 200 },
    { pose: { h: [72, 106], t: -2, m1: [74, S], c: 1, p1: { a: 262, r: 38 }, g: 1 }, d: 1100, h: 300 },
  ] };

  const pendu = function (extra) { return Object.assign({ h: [86, 71], t: -92, m1: [88, 14], c: 1 }, extra); };
  A["abdos-3"] = { vue: "cote", decor: [["barreCote", 88, 14]], cle: 1, etapes: [
    { pose: pendu({ p1: { a: 94, r: 37 }, p2: { a: 92, r: 37 }, g: -1 }), d: 1300, h: 300 },
    { pose: pendu({ h: [89, 66], t: -100, p1: { a: 28, r: 18 }, p2: { a: 32, r: 18 }, g: -1 }), d: 1000, h: 400 },
  ] };

  A["abdos-4"] = { vue: "cote", decor: [["barreCote", 88, 14]], cle: 1, etapes: [
    { pose: pendu({ p1: { a: 94, r: 38 }, p2: { a: 92, r: 38 } }), d: 1500, h: 300 },
    { pose: pendu({ h: [90, 67], t: -103, p1: { a: 2, r: 38 }, p2: { a: 4, r: 38 } }), d: 1200, h: 400 },
  ] };

  A["abdos-5"] = { vue: "cote", decor: [["barreCote", 88, 14]], cle: 1, etapes: [
    { pose: pendu({ p1: { a: 94, r: 37 }, p2: { a: 92, r: 37 } }), d: 1600, h: 300 },
    { pose: pendu({ h: [101, 48], t: -150, p1: { a: -96, r: 36 }, p2: { a: -94, r: 36 } }), d: 1200, h: 400 },
  ] };

  // ===== GAINAGE =====
  // Planche sur les avant-bras : coude sous l'épaule, avant-bras posé devant
  const plancheCoudes = function (angle) {
    const p = gaine([40, S], angle);
    const ep = plus(p.h, dir(angle), L.torse);
    return Object.assign(p, { m1: [ep[0] + 14, S], c: 1, hd: 20 });
  };
  A["gainage-0"] = { vue: "cote", decor: [["sol"]], cle: 0, etapes: [
    { pose: plancheCoudes(-12.7), d: 1400, h: 400 },
    { pose: plancheCoudes(-12.2), d: 1400, h: 400 },
  ] };

  A["gainage-1"] = { vue: "cote", decor: [["sol"]], cle: 0, etapes: [
    { pose: Object.assign(plancheCoudes(-14), { m2: { a: -90, r: 29 }, p2: [44, S - 1] }), d: 1500, h: 600 },
    { pose: Object.assign(plancheCoudes(-12), { m2: { a: -90, r: 29 }, p2: [44, S - 1] }), d: 1500, h: 600 },
  ] };

  const plancheBras = function (bras, jambe) {
    const p = gaine([40, S], -25.2);
    const ep = plus(p.h, dir(-25.2), L.torse);
    const repos = [ep[0], S];
    return Object.assign(p, {
      hd: 25, c: 1,
      m1: bras === 1 ? { a: -12, r: 29 } : repos, m2: bras === 2 ? { a: -12, r: 29 } : repos,
      p1: jambe === 1 ? { a: 182, r: 38 } : [40, S], p2: jambe === 2 ? { a: 182, r: 38 } : [40, S],
    });
  };
  A["gainage-2"] = { vue: "cote", decor: [["sol"]], cle: 1, etapes: [
    { pose: plancheBras(0, 0), d: 700, h: 300 },
    { pose: plancheBras(1, 2), d: 700, h: 1600 },
    { pose: plancheBras(0, 0), d: 700, h: 300 },
    { pose: plancheBras(2, 1), d: 700, h: 1600 },
  ] };

  A["gainage-3"] = { vue: "cote", decor: [["sol"]], cle: 1, etapes: [
    { pose: { h: [72, 106], t: 0, hd: 0, m1: { a: 0, r: 29 }, p1: { a: 180, r: 38 } }, d: 1000, h: 400 },
    { pose: { h: [72, 104], t: -14, hd: -8, m1: { a: -18, r: 29 }, p1: { a: 196, r: 38 } }, d: 1000, h: 2200 },
  ] };

  A["gainage-4"] = { vue: "cote", decor: [["sol"], ["parallette", 90, 96]], cle: 1, etapes: [
    { pose: { h: [88, 99], t: -86, hd: 10, m1: [90, 96], c: 1, p1: [106, S], g: -1 }, d: 1000, h: 400 },
    { pose: { h: [88, 97], t: -86, hd: 10, m1: [90, 96], c: 1, p1: [100, 100], g: -1 }, d: 800, h: 2200 },
  ] };

  A["gainage-5"] = { vue: "cote", decor: [["sol"], ["parallette", 90, 96]], cle: 1, etapes: [
    { pose: { h: [88, 98], t: -88, hd: 10, m1: [90, 96], c: 1, p1: { a: 17, r: 38 } }, d: 1000, h: 400 },
    { pose: { h: [88, 97], t: -88, hd: 10, m1: [90, 96], c: 1, p1: { a: 0, r: 38 } }, d: 900, h: 2200 },
  ] };

  // ===== ÉCHAUFFEMENT =====
  const debout = function (extra) { return Object.assign({ h: [80, 71], t: -90 }, extra); };

  A["echauffement-jumping"] = { vue: "face", decor: [["sol"]], cle: 1, etapes: [
    { pose: debout({ m1: { a: 80, r: 29 }, m2: { a: 100, r: 29 }, p1: [86, S], p2: [74, S] }), d: 350, h: 50 },
    { pose: debout({ h: [80, 74], m1: { a: -60, r: 29 }, m2: { a: 240, r: 29 }, p1: [100, S], p2: [60, S] }), d: 350, h: 50 },
  ] };

  const cercle = function (a) { return debout({ m1: { a: a, r: 29 }, m2: { a: 180 - a, r: 29 }, p1: [86, S], p2: [74, S] }); };
  A["echauffement-epaules"] = { vue: "face", decor: [["sol"]], cle: 2, etapes: [
    { pose: cercle(80), d: 0, h: 0 },
    { pose: cercle(-10), d: 450, h: 0 },
    { pose: cercle(-100), d: 450, h: 0 },
    { pose: cercle(-190), d: 450, h: 0 },
    { pose: cercle(-280), d: 450, h: 0 },
  ] };

  const poignets = function (dx, dy) { return debout({ m1: [83 + dx, 58 + dy], m2: [77 + dx, 58 + dy], p1: [86, S], p2: [74, S] }); };
  A["echauffement-poignets"] = { vue: "face", decor: [["sol"]], cle: 0, etapes: [
    { pose: poignets(0, -5), d: 300, h: 0 },
    { pose: poignets(5, 0), d: 300, h: 0 },
    { pose: poignets(0, 5), d: 300, h: 0 },
    { pose: poignets(-5, 0), d: 300, h: 0 },
  ] };

  A["echauffement-squats"] = { vue: "cote", decor: [["sol"]], cle: 1, etapes: [
    { pose: { h: [78, 71], t: -90, m1: { a: 95, r: 29 }, p1: [80, S], g: -1 }, d: 1000, h: 200 },
    { pose: { h: [62, 90], t: -58, m1: { a: 0, r: 29 }, p1: [80, S], g: -1 }, d: 1100, h: 200 },
  ] };

  A["echauffement-genoux"] = { vue: "cote", decor: [["sol"]], cle: 0, etapes: [
    { pose: { h: [80, 70], t: -88, m1: { a: 40, r: 26 }, m2: { a: 130, r: 26 }, c1: -1, c2: -1, p1: [94, 80], p2: [80, S], g: -1 }, d: 280, h: 40 },
    { pose: { h: [80, 70], t: -88, m1: { a: 130, r: 26 }, m2: { a: 40, r: 26 }, c1: -1, c2: -1, p1: [80, S], p2: [94, 80], g: -1 }, d: 280, h: 40 },
  ] };

  // ---------- Fabrication du dessin SVG ----------
  function points(m) { return m.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }

  function svgDynamique(def, sq) {
    let html = "";
    def.decor.forEach(function (d) {
      if (d[0] === "elastique") {
        const k1 = sq.j1[1], k2 = sq.j2[1];
        html += '<polyline class="elastique" points="77,14 ' + points([k1, k2]) + ' 83,14"/>';
      } else if (d[0] === "sac") {
        const dos = [-sq.perp[0], -sq.perp[1]];
        const haut = plus(sq.epaule, [sq.hanche[0] - sq.epaule[0], sq.hanche[1] - sq.epaule[1]], 0.12);
        const bas = plus(sq.epaule, [sq.hanche[0] - sq.epaule[0], sq.hanche[1] - sq.epaule[1]], 0.7);
        html += '<polygon class="sac" points="' + points([plus(haut, dos, 3), plus(bas, dos, 3), plus(bas, dos, 11), plus(haut, dos, 10)]) + '"/>';
      }
    });
    return html;
  }

  function svgCorps(def, sq) {
    const face = def.vue === "face";
    const loin = face ? "" : " loin";
    let html = '<g class="dyn">' + svgDynamique(def, sq) + "</g>";
    if (def.jambes !== false) html += '<polyline class="membre' + loin + '" points="' + points(sq.j2) + '"/>';
    html += '<polyline class="membre' + loin + '" points="' + points(sq.m2) + '"/>';
    if (face) {
      html += '<line class="buste" x1="' + sq.e1[0].toFixed(1) + '" y1="' + sq.e1[1].toFixed(1) + '" x2="' + sq.e2[0].toFixed(1) + '" y2="' + sq.e2[1].toFixed(1) + '"/>';
      if (def.jambes !== false) html += '<line class="buste" x1="' + sq.h1[0].toFixed(1) + '" y1="' + sq.h1[1].toFixed(1) + '" x2="' + sq.h2[0].toFixed(1) + '" y2="' + sq.h2[1].toFixed(1) + '"/>';
    }
    html += '<line class="buste" x1="' + sq.hanche[0].toFixed(1) + '" y1="' + sq.hanche[1].toFixed(1) + '" x2="' + sq.epaule[0].toFixed(1) + '" y2="' + sq.epaule[1].toFixed(1) + '"/>';
    html += '<circle class="tete" cx="' + sq.tete[0].toFixed(1) + '" cy="' + sq.tete[1].toFixed(1) + '" r="' + L.tete + '"/>';
    if (def.jambes !== false) html += '<polyline class="membre" points="' + points(sq.j1) + '"/>';
    html += '<polyline class="membre" points="' + points(sq.m1) + '"/>';
    return html;
  }

  function svgDecor(def) {
    return def.decor.map(function (d) {
      return DECORS[d[0]] ? DECORS[d[0]].apply(null, d.slice(1)) : "";
    }).join("");
  }

  // Cadre serré autour du personnage (pour les petites vignettes carrées)
  function cadreSerre(sq) {
    const pts = [sq.tete, sq.e1, sq.e2, sq.h1, sq.h2].concat(sq.m1, sq.m2, sq.j1, sq.j2);
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    pts.forEach(function (p) { x1 = Math.min(x1, p[0]); y1 = Math.min(y1, p[1]); x2 = Math.max(x2, p[0]); y2 = Math.max(y2, p[1]); });
    const cote = Math.max(x2 - x1, y2 - y1) + 18;
    return [(x1 + x2 - cote) / 2, (y1 + y2 - cote) / 2, cote, cote].map(function (v) { return v.toFixed(1); }).join(" ");
  }

  function svg(def, pose, classe, serre) {
    const sq = squelette(completer(pose, def.vue), def.vue);
    const cadre = serre ? cadreSerre(sq) : (def.cadre || "0 0 160 120");
    return '<svg class="fig ' + (classe || "") + '" viewBox="' + cadre + '" aria-hidden="true" focusable="false">' +
      '<g class="decor">' + svgDecor(def) + "</g>" +
      '<g class="corps">' + svgCorps(def, sq) + "</g></svg>";
  }

  // ---------- Ce que le reste de l'appli utilise ----------

  // Image fixe d'un exercice. "vignette" = cadre carré serré (pour les listes)
  function image(cle, classe, vignette) {
    const def = A[cle];
    if (!def) return "";
    return svg(def, def.etapes[def.cle || 0].pose, classe, vignette);
  }
  function vignette(cle, classe) { return image(cle, "vignette " + (classe || ""), true); }

  // Animation (le dessin bouge une fois "activer" appelé)
  function anime(cle, classe) {
    if (!A[cle]) return "";
    return '<div class="anim ' + (classe || "") + '" data-anim="' + cle + '">' + image(cle) + "</div>";
  }

  // Lance toutes les animations présentes dans la page
  const actives = [];
  let boucleEnCours = false;
  const mouvementReduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function activer(racine) {
    if (mouvementReduit) return; // l'utilisateur préfère les images fixes
    (racine || document).querySelectorAll("[data-anim]").forEach(function (el) {
      if (el.dataset.active) return;
      el.dataset.active = "1";
      const def = A[el.dataset.anim];
      actives.push({ el: el, def: def, debut: performance.now(),
        corps: el.querySelector(".corps"), etapes: def.etapes.map(function (e) { return { pose: completer(e.pose, def.vue), d: e.d, h: e.h }; }) });
    });
    if (!boucleEnCours && actives.length) { boucleEnCours = true; requestAnimationFrame(image_suivante); }
  }

  function image_suivante(maintenant) {
    for (let i = actives.length - 1; i >= 0; i--) {
      const a = actives[i];
      if (!a.el.isConnected) { actives.splice(i, 1); continue; }
      const pose = poseA({ etapes: a.etapes }, maintenant - a.debut, a.def.vue);
      a.corps.innerHTML = svgCorps(a.def, squelette(pose, a.def.vue));
    }
    if (actives.length) requestAnimationFrame(image_suivante);
    else boucleEnCours = false;
  }

  return {
    image: image, vignette: vignette, anime: anime, activer: activer, existe: function (cle) { return !!A[cle]; },
    // Pour la page de vérification (apercu) : dessin d'une étape précise
    etape: function (cle, i) { const def = A[cle]; return svg(def, def.etapes[i].pose); },
    vignetteEtape: function (cle, i) { const def = A[cle]; return svg(def, def.etapes[i].pose, '', true); },
    // Dessin à un instant précis (en millisecondes), pour vérifier les transitions
    instant: function (cle, ms) {
      const def = A[cle];
      const etapes = def.etapes.map(function (e) { return { pose: completer(e.pose, def.vue), d: e.d, h: e.h }; });
      return '<svg class="fig" viewBox="' + (def.cadre || "0 0 160 120") + '"><g class="decor">' + svgDecor(def) + '</g><g class="corps">' +
        svgCorps(def, squelette(poseA({ etapes: etapes }, ms, def.vue), def.vue)) + "</g></svg>";
    },
    duree: function (cle) { let t = 0; A[cle].etapes.forEach(function (e) { t += (e.d || 0) + (e.h || 0); }); return t; },
    nbEtapes: function (cle) { return A[cle].etapes.length; },
    cles: function () { return Object.keys(A); },
  };
})();
