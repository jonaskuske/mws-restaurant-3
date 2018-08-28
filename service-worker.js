import idb from './src/js/utils/idb';

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

/* Helper functions to determine whether requests/responses should be cached */
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

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache =>
                fetch('/parcel-manifest.json')
                    .then(response => response.json())
                    .then(assets => {
                        const hashedAssets = Object.entries(assets)
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

self.addEventListener('fetch', (e) => {
    // if request should not be cached: respond with fetch and return
    if (!isRequestCacheable(e.request)) {
        e.respondWith(fetch(e.request));
        return;
    }

    // neccessary for sw to handle requests with query strings
    // like /restaurant.html?id=1
    let request;
    if (e.request.url.includes('/restaurant.html')) request = new Request('/restaurant.html');
    else if (e.request.url.includes('/newreview.html')) request = new Request('/newreview.html');
    else request = e.request;

    e.respondWith(
        caches.match(request).then((response) => {
            if (response) {

                // if online: fetch ressource and update cache asynchronously
                if (navigator.onLine) {
                    fetch(request).then((netresponse) => {
                        if (isResponseCacheable(netresponse)) {
                            caches
                                .open(CACHE_NAME)
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
                            .open(CACHE_NAME)
                            .then((cache) => cache.put(request, cacheResponse));
                    }

                    return response;
                });

            }
        })
    )
});

const dbPromise = idb.open('restaurant-db', 3)
const getOutbox = () => dbPromise.then(async db => {
    const tx = db.transaction('reviews');
    const store = tx.objectStore('reviews');
    const outbox = await store.get('outbox');
    await tx.complete;
    return outbox;
})
const putInReviewStore = (body, key) => dbPromise.then(async db => {
    const tx = db.transaction('reviews', 'readwrite');
    const store = tx.objectStore('reviews');
    await store.put(body, key);
    await tx.complete;
    return;
})
const checkFetchStatus = r => new Promise((res, rej) => {
    if (r.status >= 200 && r.status < 300) res(r);
    else rej(r);
})
const updateReviewCache = async id => {
    const reviews = await fetch(
        `http://localhost:1337/reviews?restaurant_id=${id}`
    )
        .then(checkFetchStatus)
        .then(r => r.json());

    await putInReviewStore(reviews, id);
}
const sendReview = data => {
    return fetch('http://localhost:1337/reviews', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
    }).then(checkFetchStatus);
}

const clearOutbox = () => new Promise(async (resolve, reject) => {
    const outbox = await getOutbox();

    const affectedIds = outbox.map(({ restaurant_id: id }) => id);
    try {
        for (let i = 0; i < outbox.length; i++) {
            const review = outbox.pop();
            await sendReview(review);
            await putInReviewStore(outbox, 'outbox');
        }
        resolve();
    } catch (e) {
        reject(e);
    }

    // Updated cached reviews for all entries that changed
    Promise
        .all(affectedIds.map(updateReviewCache))
        .catch(() => console.log('Cache update after clearing outbox failed.'));

})

self.addEventListener('sync', evt => {
    console.log(evt);
    if (evt.tag === 'sync-outbox') {
        return evt.waitUntil(clearOutbox());
    }
})