// =====================================================================
//  sw.js — LE SERVICE WORKER (pour que l'appli marche sans internet)
// ---------------------------------------------------------------------
//  Au premier chargement, il copie tous les fichiers de l'appli dans le
//  téléphone. Ensuite, il sert ces copies immédiatement (même hors-ligne)
//  et, s'il y a du réseau, il récupère les nouvelles versions en
//  arrière-plan : tes modifications apparaissent à l'ouverture suivante.
//
//  Si tu ajoutes un fichier à l'appli, ajoute-le dans la liste FICHIERS
//  et change le numéro de version de CACHE (v1 → v2).
// =====================================================================

const CACHE = "street-workout-v4";

const FICHIERS = [
  "./",
  "./index.html",
  "./style.css",
  "./exercices.js",
  "./animations.js",
  "./progression.js",
  "./programme.js",
  "./questionnaire.js",
  "./app.js",
  "./manifest.json",
  "./icones/icone-180.png",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
  "./icones/icone-maskable-512.png",
];

// Installation : on met tous les fichiers en cache
self.addEventListener("install", function (event) {
  // cache: "reload" = on télécharge la vraie dernière version (pas une vieille copie du navigateur)
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(FICHIERS.map(function (f) { return new Request(f, { cache: "reload" }); }));
  }));
  self.skipWaiting();
});

// Activation : on supprime les anciens caches
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Chaque demande de fichier : réponse depuis le cache, mise à jour en arrière-plan
self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (enCache) {
        const reseau = fetch(req).then(function (reponse) {
          if (reponse.ok) cache.put(req, reponse.clone());
          return reponse;
        }).catch(function () { return enCache; });
        return enCache || reseau;
      });
    })
  );
});
