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
    const request = e.request.url.includes('/restaurant.html') ?
        new Request('/restaurant.html') :
        e.request;

    e.respondWith(
        caches.match(request).then((response) => {
            return response || fetch(request);
        })
    )
});