// =====================================================================
//  sw.js — LE SERVICE WORKER (pour que l'appli marche sans internet)
// ---------------------------------------------------------------------
//  Au premier chargement, il copie tous les fichiers de l'appli dans le
//  téléphone. Ensuite, s'il y a du réseau, il prend toujours la dernière
//  version en ligne (et met la copie à jour) ; sans réseau, il sert la
//  copie du téléphone : l'appli marche donc aussi hors connexion.
//
//  Si tu ajoutes un fichier à l'appli, ajoute-le dans la liste FICHIERS
//  et change le numéro de version de CACHE (v1 → v2).
// =====================================================================

const CACHE = "coach-street-v5";

const FICHIERS = [
  "./",
  "./index.html",
  "./style.css",
  "./coach.js",
  "./figures.js",
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

// Chaque demande de fichier : d'abord internet (dernière version), sinon la copie du téléphone
self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req, { cache: "no-cache" }).then(function (reponse) {
      if (reponse.ok) {
        const copie = reponse.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copie); });
      }
      return reponse;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (enCache) {
        return enCache || caches.match("./index.html");
      });
    })
  );
});
