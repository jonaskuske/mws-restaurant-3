import { clearOutbox } from './src/js/utils/outboxSync';

const CACHE_NAME = 'restaurant-reviews-v2';
const BACKEND_HOST = 'localhost:1337';

const staticAssets = [
    '.',
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

/* get the filenames to cache from the parcel-manifest and add them to cache
see https://michalzalecki.com/progressive-web-apps-with-webpack/ */
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache =>
                fetch('/parcel-manifest.json')
                    .then(response => response.json())
                    .then(assets => {
                        const hashedAssets = Object.entries(assets)
                            // filter out files that are unnecessary to cache
                            .filter(([sourceURL]) => (
                                !sourceURL.includes('webmanifest') &&
                                !sourceURL.includes('favicon') &&
                                !sourceURL.endsWith('.map') &&
                                !sourceURL.includes('src/icons/')))
                            .map(([_, hashedURL]) => hashedURL);

                        return cache.addAll([...staticAssets, ...hashedAssets]);
                    })
            ).then(() => self.skipWaiting())
    );
});

/* delete old caches on activation */
self.addEventListener('activate', event => {
    const allowedCaches = [CACHE_NAME];
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                const cacheDeletePromises = cacheNames
                    .map(cacheName => {
                        if (!allowedCaches.includes(cacheName)) {
                            return caches.delete(cacheName)
                        }
                    });
                return Promise.all(cacheDeletePromises);
            })
    )
})

const checkResponseStatus = r => new Promise((res, rej) => {
    if ((r.status >= 200 && r.status < 300) || r.status === 0) res(r);
    else rej(r.statusText);
})
/* Helper functions to determine whether requests/responses should be cached */
const isRequestCacheable = request => {
    const url = new URL(request.url);
    // don't cache responses from backend as it has its own caching using idb
    if (url.host === BACKEND_HOST) return false;
    if (url.protocol === 'chrome-extension:') return false;

    return true;
}
const isResponseCacheable = response => {
    // don't cache opaque response to prevent exceeding cache size quota
    // see https://cloudfour.com/thinks/when-7-kb-equals-7-mb/
    if (response.status === 0 || response.type === 'opaque') return false;

    return true
}

const requestFailingWith404 = event => {
    return fetch(event.request)
        .catch(() => {
            const body = JSON.stringify({ error: 'Sorry, you\'re offline. Try again once you have a working internet connection.' });
            const headers = { 'Content-Type': 'application/json' };
            return new Response(body, { status: 404, statusText: 'Not Found', headers });
        });
}
const requestThenCache = (event, cache) => {
    return fetch(event.request)
        .then(checkResponseStatus)
        .then(response => {
            if (isResponseCacheable(response)) {
                cache.put(event.request, response.clone());
            }
            return response;
        })
        .catch(() => cache.match(event.request))
}

self.addEventListener('fetch', event => {
    // if request should not be cached: respond with fetch and return
    if (!isRequestCacheable(event.request)) {
        event.respondWith(requestFailingWith404(event));
        return;
    }

    // neccessary for sw to handle requests with query strings
    // like /restaurant.html?id=1
    const requestURL = event.request.url;
    const request = requestURL.includes('?')
        ? new Request(requestURL.substring(requestURL.indexOf('?') + 1))
        : event.request;

    event.respondWith(
        caches.match(request)
            .then(checkResponseStatus)
            .then(response => {
                return caches.open(CACHE_NAME)
                    .then(cache => {
                        if (navigator.onLine) requestThenCache(event, cache);
                        return response;
                    });
            }).catch(() => caches.open(CACHE_NAME)
                .then(cache => requestThenCache(event, cache)))
    )
});



/* register the handler for syncing the outbox */
self.addEventListener('sync', event => {
    if (event.tag === 'sync-outbox') {
        return event.waitUntil(clearOutbox());
    }
})