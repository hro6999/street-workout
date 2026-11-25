// =====================================================================
//  figures.js — LES BONSHOMMES ANIMÉS ET LES CONFETTIS
// ---------------------------------------------------------------------
//  Chaque exercice = quelques "poses" (positions des articulations).
//  L'animation passe en douceur d'une pose à l'autre, en boucle.
//  h = tête, s = épaule, e = coude, w = main, p = bassin, k = genou, f = pied
// =====================================================================

const POSES = {
  pompes: { pr: "floor", d: 1600, f: [
    { h: [160, 96], s: [146, 104], e: [147, 122], w: [148, 140], p: [96, 120], k: [68, 130], f: [38, 140] },
    { h: [162, 118], s: [146, 124], e: [132, 128], w: [148, 140], p: [96, 132], k: [68, 136], f: [38, 140] }] },
  tractions: { pr: "bar", d: 2000, f: [
    { h: [108, 48], s: [100, 58], e: [100, 40], w: [100, 22], p: [99, 100], k: [102, 121], f: [98, 141] },
    { h: [108, 10], s: [100, 30], e: [86, 32], w: [100, 22], p: [99, 72], k: [104, 92], f: [100, 112] }] },
  dips: { pr: "chair", d: 1800, f: [
    { h: [112, 58], s: [114, 72], e: [118, 90], w: [124, 108], p: [110, 118], k: [78, 120], f: [50, 140] },
    { h: [112, 82], s: [114, 96], e: [134, 98], w: [124, 108], p: [110, 134], k: [78, 128], f: [50, 140] }] },
  gainage: { pr: "floor", d: 2600, f: [
    { h: [158, 110], s: [146, 118], e: [146, 140], w: [166, 140], p: [96, 124], k: [68, 131], f: [40, 140] },
    { h: [158, 108], s: [146, 117], e: [146, 140], w: [166, 140], p: [96, 120], k: [68, 130], f: [40, 140] }] },
  lateral: { pr: "floor", d: 2400, f: [
    { h: [158, 102], s: [146, 110], e: [146, 125], w: [146, 140], p: [96, 122], k: [68, 131], f: [40, 140] },
    { h: [158, 106], s: [146, 113], e: [146, 126], w: [146, 140], p: [96, 131], k: [68, 136], f: [40, 140] }] },
  squats: { pr: "floor", d: 2000, f: [
    { h: [100, 33], s: [100, 46], e: [116, 50], w: [132, 50], p: [100, 86], k: [102, 113], f: [100, 140] },
    { h: [112, 64], s: [106, 76], e: [124, 78], w: [142, 78], p: [86, 112], k: [113, 116], f: [100, 140] }] },
  sauts: { pr: "floor", d: 1800, f: [
    { h: [112, 64], s: [106, 76], e: [124, 78], w: [142, 78], p: [86, 112], k: [113, 116], f: [100, 140] },
    { h: [100, 13], s: [100, 26], e: [108, 10], w: [114, -6], p: [100, 66], k: [101, 93], f: [100, 120] },
    { h: [100, 33], s: [100, 46], e: [116, 50], w: [132, 50], p: [100, 86], k: [102, 113], f: [100, 140] }] },
  crunch: { pr: "floor", d: 1700, f: [
    { h: [46, 128], s: [60, 134], e: [60, 118], w: [50, 124], p: [100, 136], k: [124, 112], f: [146, 138] },
    { h: [62, 106], s: [74, 118], e: [80, 100], w: [66, 104], p: [100, 136], k: [124, 112], f: [146, 138] }] },
  releves: { pr: "floor", d: 2000, f: [
    { h: [44, 130], s: [58, 136], e: [76, 138], w: [94, 138], p: [98, 136], k: [124, 136], f: [150, 136] },
    { h: [44, 130], s: [58, 136], e: [76, 138], w: [94, 138], p: [98, 136], k: [112, 112], f: [124, 88] }] },
};

// Le décor : sol, barre de traction, chaise
const DECORS = {
  floor: '<line class="prop" x1="10" y1="147" x2="190" y2="147"/>',
  bar: '<line class="prop" x1="52" y1="24" x2="52" y2="2"/><line class="prop" x1="148" y1="24" x2="148" y2="2"/><line class="prop barre-fixe" x1="48" y1="22" x2="152" y2="22"/>',
  chair: '<line class="prop" x1="10" y1="147" x2="190" y2="147"/><path class="prop" d="M118 110 H172 M124 110 V147 M166 110 V147 M172 110 V68"/>',
};

// Code SVG d'un bonhomme. taille = "xl" (grand) ou "sm" (petit)
function figure(cle, taille) {
  const A = POSES[cle] || POSES.pompes;
  const membres = '<line class="ua"/><line class="fa"/><line class="th"/><line class="sh"/>';
  return `<svg class="fig ${taille || ""}" viewBox="0 0 200 160" aria-hidden="true" data-anim="${cle}" data-ph="${Math.random().toFixed(3)}">`
    + (DECORS[A.pr] || "")
    + `<g class="bk" opacity=".35">${membres}</g><g class="fr"><line class="sp"/>${membres}<circle class="hd" r="10"/></g></svg>`;
}

let FIGURES = [];
// À appeler après chaque affichage : repère les bonshommes présents à l'écran
function brancherFigures() {
  FIGURES = [...document.querySelectorAll("svg[data-anim]")].map(svg => {
    const q = (gr, c) => svg.querySelector(`.${gr} .${c}`);
    return {
      cle: svg.dataset.anim, ph: +svg.dataset.ph,
      fr: { sp: q("fr", "sp"), ua: q("fr", "ua"), fa: q("fr", "fa"), th: q("fr", "th"), sh: q("fr", "sh"), hd: q("fr", "hd") },
      bk: { ua: q("bk", "ua"), fa: q("bk", "fa"), th: q("bk", "th"), sh: q("bk", "sh") },
    };
  });
}

function poseA(A, t) {
  const n = A.f.length, u = t * n, i = Math.floor(u) % n, l = u - Math.floor(u), e = 0.5 - 0.5 * Math.cos(Math.PI * l);
  const a = A.f[i], b = A.f[(i + 1) % n], r = {};
  for (const k in a) r[k] = [a[k][0] + (b[k][0] - a[k][0]) * e, a[k][1] + (b[k][1] - a[k][1]) * e];
  return r;
}
function trait(el, a, b, dx, dy) {
  if (!el) return;
  dx = dx || 0; dy = dy || 0;
  el.setAttribute("x1", a[0] + dx); el.setAttribute("y1", a[1] + dy);
  el.setAttribute("x2", b[0] + dx); el.setAttribute("y2", b[1] + dy);
}
function boucleAnimation(maintenant) {
  for (const F of FIGURES) {
    const A = POSES[F.cle];
    if (!A) continue;
    const p = poseA(A, ((maintenant / A.d) + F.ph) % 1);
    trait(F.fr.sp, p.s, p.p); trait(F.fr.ua, p.s, p.e); trait(F.fr.fa, p.e, p.w); trait(F.fr.th, p.p, p.k); trait(F.fr.sh, p.k, p.f);
    trait(F.bk.ua, p.s, p.e, -6, -3); trait(F.bk.fa, p.e, p.w, -6, -3); trait(F.bk.th, p.p, p.k, -6, -3); trait(F.bk.sh, p.k, p.f, -6, -3);
    if (F.fr.hd) { F.fr.hd.setAttribute("cx", p.h[0]); F.fr.hd.setAttribute("cy", p.h[1]); }
  }
  requestAnimationFrame(boucleAnimation);
}
requestAnimationFrame(boucleAnimation);


// ---- CONFETTIS ----
function confettis(fort) {
  const c = document.getElementById("confettis");
  if (!c) return;
  const x = c.getContext("2d"), dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const couleurs = ["#2f7bff", "#00d4ff", "#39ff88", "#c6ff3d", "#ffffff", "#7a5cff"];
  const ps = Array.from({ length: fort ? 260 : 170 }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    c: couleurs[Math.floor(Math.random() * couleurs.length)],
  }));
  const t0 = performance.now();
  (function image(t) {
    x.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach(p => {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore();
    });
    if (t - t0 < 3800) requestAnimationFrame(image); else x.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}
