// =====================================================================
//  tests.js — VÉRIFICATIONS AUTOMATIQUES DES RÈGLES
//  Lancer dans un terminal :  node tests.js
//  (ce fichier n'est pas utilisé par l'appli elle-même)
// =====================================================================

const C = require("./coach.js");
let reussis = 0, rates = 0;
function verifie(nom, condition) {
  if (condition) reussis++; else { rates++; console.log("❌ " + nom); }
}
// Simule une date et une heure
function le(iso, heure) {
  C.reglerHorloge(() => { const [y, m, j] = iso.split("-").map(Number); return new Date(y, m - 1, j, heure == null ? 12 : heure); });
}

// ---- Programme et cibles ----
le("2026-11-23"); // un lundi
let d = C.donneesVides();
verifie("12 exercices au programme", C.JOURS.reduce((n, j) => n + C.PROGRAMME[j].exercices.length, 0) === 12);
verifie("15 badges", C.BADGES.length === 15);
verifie("7 niveaux", C.NIVEAUX.length === 7);
verifie("semaine 1 au départ", C.numeroSemaine(d) === 1);
verifie("cible de départ pompes du lundi = 10", C.seanceExos(d, "lundi")[0].cible === 10);
le("2026-12-07"); // 2 semaines plus tard
verifie("semaine 3 après 14 jours", C.numeroSemaine(d) === 3);
verifie("pompes lundi semaine 3 = 10 + 2×2", C.seanceExos(d, "lundi")[0].cible === 14);
d.ajustements.lundi = 3;
verifie("ajustement +3 = semaine 6", C.semaineEffective(d, "lundi") === 6);
d.ajustements.lundi = -3;
verifie("semaine effective jamais sous 1", C.semaineEffective(d, "lundi") === 1);
for (let i = 0; i < 5; i++) C.appliquerRessenti(d, "lundi", "dur");
verifie("ajustement limité à -3", d.ajustements.lundi === -3);
for (let i = 0; i < 9; i++) C.appliquerRessenti(d, "lundi", "facile");
verifie("ajustement limité à +3", d.ajustements.lundi === 3);
verifie("arrondi à la Python : 4.5 → 4", C.arrondiPython(4.5) === 4 && C.arrondiPython(5.5) === 6 && C.arrondiPython(2.4) === 2);
d = C.donneesVides(); d.test = { pompes: 6, tractions: 0, gainage: 60 };
verifie("test pompes 6 × 0,6 = 4", C.seanceExos(d, "lundi")[0].cible === 4);
verifie("test tractions à 0 : on garde le départ", C.seanceExos(d, "lundi")[1].cible === 3);

// ---- Séance guidée ----
le("2026-11-23");
d = C.donneesVides();
const pleine = { Pompes: [10, 10, 10], Tractions: [3, 3, 3], "Dips sur chaise": [8, 8, 8], Gainage: [30, 30, 30] };
let r = C.validerSeance(d, { jour: "lundi", res: pleine, ressenti: "correct", duree: 1500 });
verifie("séance parfaite", r.parfaite && d.parfaites === 1);
verifie("XP : 100 + 20 parfaite + badges premiere et perfection (2×50)", d.xp === 220);
verifie("message récap", r.texte.includes("25 min 00 s — 63 répétitions") && r.texte.includes("Séance PARFAITE"));
r = C.validerSeance(d, { jour: "lundi", res: { Pompes: [12, 10, 10] }, ressenti: "facile", duree: 60 });
verifie("2e séance le même jour : pas d'XP de séance, mais badge Record (+50)", d.xp === 220 + 50 && d.badges.includes("record") && d.records.Pompes === 12 && r.texte.includes("déjà comptée"));
verifie("record battu compté", d.nb_records === 1 && r.texte.includes("📈 Record Pompes : 12 (avant 10)"));

// ---- Fait / Pas fait / Reporter ----
le("2026-11-25", 9); // mercredi matin
verifie("question posée un jour de séance", C.questionBilan(d) !== null);
verifie("Reporter : message", C.reporter(d) === "OK, je te relance dans 2 heures ⏰");
verifie("Reporter : question cachée", C.questionBilan(d) === null);
le("2026-11-25", 11);
verifie("Reporter : la question revient 2 h après", C.questionBilan(d) === "⏰ C'est l'heure ! Tu l'as faite, ta séance ?");
const serieAvant = C.serieEnCours(d);
verifie("série avant = 1", serieAvant === 1);
r = C.marquerRate(d);
verifie("Pas fait : série cassée", r && C.serieEnCours(d) === 0 && d.historique["2026-11-25"] === "rate");
verifie("Pas fait : plus de question", C.questionBilan(d) === null);
verifie("déjà noté : Fait refusé", C.marquerFait(d) === null);
le("2026-11-27", 15); // vendredi
const xp0 = d.xp;
r = C.marquerFait(d);
verifie("Fait : +100 XP + badge Retour en force", r && d.badges.includes("retour") && d.xp === xp0 + 150);
le("2026-11-28", 15); // samedi
verifie("pas de question le samedi", C.questionBilan(d) === null);
verifie("prochaine séance le samedi = lundi", C.prochainJourSeance() === "lundi");

// ---- Poids ----
d = C.donneesVides();
le("2026-11-23");
verifie("poids hors limites refusé", (() => { try { C.lirePoids("251"); return false; } catch (e) { return true; } })());
verifie("virgule acceptée", C.lirePoids("61,2") === 61.2);
C.enregistrerPoids(d, 60);
C.enregistrerPoids(d, 60.5);
verifie("une seule pesée par jour", d.poids.length === 1 && d.poids[0][1] === 60.5);
le("2026-11-30");
r = C.enregistrerPoids(d, 61.5);
verifie("gain depuis le début", C.gainPoids(d) === 1 && d.badges.includes("kilo1"));
verifie("message poids", r.texte.startsWith("⚖️ 61.5 kg enregistré !\nDepuis le début : +1 kg\nEncore 8.5 kg avant tes 70 kg 🎯"));
C.changerObjectif(d, "61");
verifie("objectif atteint", C.objectifAtteint(d));

// ---- Bilan de la semaine ----
d = C.donneesVides(); le("2026-11-29"); d.debut = "2026-11-23";
d.historique = { "2026-11-23": "fait", "2026-11-25": "fait", "2026-11-27": "fait", "2026-11-20": "fait" };
let b = C.bilanSemaine(d);
verifie("bilan : 3 séances sur 7 jours", b.faites === 3 && b.verdict.startsWith("Semaine PARFAITE"));
verifie("bilan : semaine suivante demain", b.prochaine.startsWith("Semaine 2 demain"));
d.historique = {};
verifie("bilan : semaine blanche", C.bilanSemaine(d).verdict.startsWith("Semaine blanche"));
const s = C.stats({ ...d, historique: { a: "fait", b: "fait", c: "rate" } });
verifie("stats : % de réussite", s.taux === 67 && s.faites === 2 && s.ratees === 1);

// ---- Sauvegarde : export / import ----
d = C.donneesVides(); d.prenom = "Élodie 💪"; d.xp = 1234; d.poids = [["2026-11-23", 61.2]]; d.records = { Pompes: 20 };
const code = C.exporterCode(d);
verifie("le code commence par COACHSTREET1:", code.startsWith("COACHSTREET1:"));
const relu = C.importerCode("  " + code.slice(0, 40) + "\n" + code.slice(40) + "  ");
verifie("import = export (accents, emojis, espaces)", JSON.stringify(relu) === JSON.stringify(C.normaliser(d)));
verifie("code invalide refusé", (() => { try { C.importerCode("bonjour"); return false; } catch (e) { return true; } })());
verifie("code abîmé refusé", (() => { try { C.importerCode(code.slice(0, -10)); return false; } catch (e) { return true; } })());
const sale = C.normaliser({ historique: { "2026-02-31": "fait", "2026-11-23": "nimporte" }, xp: "abc", badges: ["premiere", "faux"],
  poids: [["2026-11-23", 500], ["2026-11-24", "61"]], ajustements: { lundi: 99 } });
verifie("données abîmées nettoyées", Object.keys(sale.historique).length === 0 && sale.xp === 0
  && sale.badges.join() === "premiere" && sale.poids.length === 1 && sale.ajustements.lundi === 3);

console.log(`\n${reussis} vérifications réussies, ${rates} ratée(s)`);
process.exit(rates ? 1 : 0);
