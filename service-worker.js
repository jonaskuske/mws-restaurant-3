const cachename = 'restaurant-reviews-v1';

const assets = [
    '.',
    '/',
    '/index.html',
    '/restaurant.html',
    './css/main.css',
    './css/desktop.css',
    './js/main.js',
    './js/dbhelper.js',
    './js/restaurant_info.js',
    './data/restaurants.json',
    './img/1.jpg',
    './img/2.jpg',
    './img/3.jpg',
    './img/4.jpg',
    './img/5.jpg',
    './img/6.jpg',
    './img/7.jpg',
    './img/8.jpg',
    './img/9.jpg',
    './img/10.jpg',
    './img/bg.jpg',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(cachename).then((cache) => {
            return cache.addAll(assets);
        })
    );
});

self.addEventListener('fetch', (e) => {

    // neccessary for sw to handle requests with query strings ( /restaurant.html?id=1 )
    const request = e.request.url.includes('/restaurant.html') ?
        new Request('/restaurant.html') :
        e.request;

    e.respondWith(
        caches.match(request).then((response) => {
            if (response) {

                // if online: fetch ressource and update cache asynchronously
                if (navigator.onLine) {
                    fetch(request).then((netresponse) => {
                        caches.open(cachename).then((cache) => cache.put(request, netresponse))
                    }).catch((e) => { /* catch DevTools related only-if-cached error */ });
                }

                // immediately return cached response: offline-first 🤘
                return response;

            } else {

                // fetch previously uncached ressource, cache cloned response, return real response
                return fetch(request).then((response) => {
                    const cacheResponse = response.clone();
                    caches.open(cachename).then((cache) => cache.put(request, cacheResponse));

                    return response;
                });

            }
        })
    )
});