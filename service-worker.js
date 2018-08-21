const cachename = 'restaurant-reviews-v1';
const BACKEND_HOST = 'localhost:1337';

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

/* Helper functions to dtermine whether requests/responses should be cached */
const isRequestCacheable = request => {
    const url = new URL(request.url);
    // don't cache responses from backend as it has its own caching using idb
    if (url.host === BACKEND_HOST) return false;

    return true;
}
const isResponseCacheable = response => {
    // don't cache opaque response to prevent exceeding cache size quota
    // see https://cloudfour.com/thinks/when-7-kb-equals-7-mb/
    if (response.status === 0 || response.type === 'opaque') return false;

    return true
}

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(cachename).then((cache) => {
            return cache.addAll(assets);
        })
    );
});

self.addEventListener('fetch', (e) => {
    // if request should not be cached: respond with fetch and return
    if (!isRequestCacheable(e.request)) {
        e.respondWith(fetch(e.request));
        return;
    }

    // neccessary for sw to handle requests with query strings
    // like /restaurant.html?id=1
    const request = e.request.url.includes('/restaurant.html') ?
        new Request('/restaurant.html') :
        e.request;

    e.respondWith(
        caches.match(request).then((response) => {
            if (response) {

                // if online: fetch ressource and update cache asynchronously
                if (navigator.onLine) {
                    fetch(request).then((netresponse) => {
                        if (isResponseCacheable(netresponse)) {
                            caches
                                .open(cachename)
                                .then((cache) => cache.put(request, netresponse))
                        }
                    }).catch((e) => {
                        /* catch DevTools related only-if-cached error */
                    });
                }

                // immediately return cached response: offline-first 🤘
                return response;

            } else {

                // fetch previously uncached ressource, cache cloned response, return real response
                return fetch(request).then((response) => {
                    const cacheResponse = response.clone();

                    if (isResponseCacheable(cacheResponse)) {
                        caches
                            .open(cachename)
                            .then((cache) => cache.put(request, cacheResponse));
                    }

                    return response;
                });

            }
        })
    )
});