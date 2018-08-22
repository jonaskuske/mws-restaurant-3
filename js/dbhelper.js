/* IndexedDB helpers */

/**
 * Promise resolving to the IndexedDB database
 */
const dbPromise = idb.open('restaurant-db', 2, function (upgradeDb) {
    if (!upgradeDb.objectStoreNames.contains('restaurants')) {
        upgradeDb.createObjectStore('restaurants');
    }
    if ((!upgradeDb.objectStoreNames.contains('reviews'))) {
        upgradeDb.createObjectStore('reviews');
    }
});
/**
 * Creates a function to get values from a specified idb objectStore
 */
const createStoreGetter = storeName => key => {
    return dbPromise.then(async db => {
        const tx = db.transaction(storeName);
        const store = tx.objectStore(storeName);
        const body = await store.get(key);
        await tx.complete;
        return body;
    });
}
/**
 * Creates a function to put values into a specified idb objectStore
 */
const createStorePutter = storeName => (body, key) => {
    return dbPromise.then(async db => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        await store.put(body, key);
        await tx.complete;
        return;
    });
}

/* Helper functions to access the restaurants store */
const getFromRestaurantStore = createStoreGetter('restaurants');
const putInRestaurantStore = createStorePutter('restaurants');
/* Helper functions to access the reviews store */
const getFromReviewsStore = createStoreGetter('reviews');
const putInReviewsStore = createStorePutter('reviews');


/* Fetch helpers */

/**
 * Resolves if status is 200 OK, else rejects.
 */
const checkFetchStatus = response => {
    const { status, statusText } = response;

    return new Promise((resolve, reject) => {
        if (status === 200 && statusText === 'OK') resolve(response);
        else reject(response);
    })
}
/**
 * fetch with added HTTP status check and json parsing
 */
const fetchJson = (...args) => {
    const [url] = args;
    return fetch(...args)
        .then(checkFetchStatus)
        .then(response => response.json())
        .catch(e => {
            const err = e.status
                ? `Failed to fetch from ${url}, received status ${e.status}`
                : `Error while performing fetch: ${e}`;
            throw err;
        })
}

/**
 * Common database helper functions.
 */
class DBHelper {

    /**
     * Database URL.
     * Change this to restaurants.json file location on your server.
     */
    static get URL() {
        const port = 1337 // Change this to your server port
        return {
            get RESTAURANTS() {
                return `http://localhost:${port}/restaurants`;
            },
            get REVIEWS() {
                return `http://localhost:${port}/reviews`;
            }
        }
    }

    /**
     * Fetch all restaurants.
     */
    static async fetchRestaurants(callback) {
        const storedRestaurants = await getFromRestaurantStore('all');
        if (storedRestaurants) {
            // call callback (offline first!), then try to update database
            callback(null, storedRestaurants);
            try {
                const restaurants = await fetchJson(DBHelper.URL.RESTAURANTS)
                putInRestaurantStore(restaurants, 'all')
            } catch (e) {
                console.log(`Couldn't update cached data of restaurants.`)
            }
        } else {
            // fetch data, call callback and update database
            try {
                const restaurants = await fetchJson(DBHelper.URL.RESTAURANTS)
                callback(null, restaurants);
                putInRestaurantStore(restaurants, 'all')
            } catch (e) {
                callback(e, null);
            }
        }
    }

    /**
     * Fetch all reviews for a restaurant with a given ID
     */
    static async fetchReviewsByRestaurantId(restaurantId, callback) {
        const reviewsURL = `${DBHelper.URL.REVIEWS}?restaurant_id=${restaurantId}`;
        const storedReviews = await getFromReviewsStore(restaurantId);
        if (storedReviews) {
            // call callback (offline first!), then try to update database
            callback(null, storedReviews);
            try {
                const reviews = await fetchJson(reviewsURL);
                putInReviewsStore(reviews, restaurantId);
            } catch(e) {
                console.log(`Couldn't update cached reviews.`);
            }
        } else {
            try {
                const reviews = await fetchJson(reviewsURL);
                callback(null, reviews);
                putInReviewsStore(reviews, restaurantId);
            } catch(e) {
                callback(e, null);
            }
        }
    }

    /**
     * Fetch a restaurant by its ID.
     */
    static async fetchRestaurantById(id, callback) {
        const restaurantURL = `${DBHelper.URL.RESTAURANTS}/${id}`;
        const storedRestaurant = await getFromRestaurantStore(id);
        if (storedRestaurant) {
            // call callback (offline first!), then try to update database
            callback(null, storedRestaurant);
            try {
                const restaurant = await fetchJson(restaurantURL);
                putInRestaurantStore(restaurant, id);
            } catch (e) {
                console.log(`Couldn't update cached restaurant data.`)
            }
        } else {
            // fetch data, call callback and update database
            try {
                const restaurant = await fetchJson(restaurantURL)
                callback(null, restaurant);
                putInRestaurantStore(restaurant, id)
            } catch (e) {
                callback(e, null);
            }
        }
    }

    /**
     * Fetch restaurants by a cuisine type with proper error handling.
     */
    static fetchRestaurantByCuisine(cuisine, callback) {
        // Fetch all restaurants  with proper error handling
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Filter restaurants to have only given cuisine type
                const results = restaurants.filter(r => r.cuisine_type == cuisine);
                callback(null, results);
            }
        });
    }

    /**
     * Fetch restaurants by a neighborhood with proper error handling.
     */
    static fetchRestaurantByNeighborhood(neighborhood, callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Filter restaurants to have only given neighborhood
                const results = restaurants.filter(r => r.neighborhood == neighborhood);
                callback(null, results);
            }
        });
    }

    /**
     * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
     */
    static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                let results = restaurants
                if (cuisine != 'all') { // filter by cuisine
                    results = results.filter(r => r.cuisine_type == cuisine);
                }
                if (neighborhood != 'all') { // filter by neighborhood
                    results = results.filter(r => r.neighborhood == neighborhood);
                }
                callback(null, results);
            }
        });
    }

    /**
     * Fetch all neighborhoods with proper error handling.
     */
    static fetchNeighborhoods(callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Get all neighborhoods from all restaurants
                const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
                // Remove duplicates from neighborhoods
                const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
                callback(null, uniqueNeighborhoods);
            }
        });
    }

    /**
     * Fetch all cuisines with proper error handling.
     */
    static fetchCuisines(callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Get all cuisines from all restaurants
                const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
                // Remove duplicates from cuisines
                const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
                callback(null, uniqueCuisines);
            }
        });
    }

    /**
     * Restaurant page URL.
     */
    static urlForRestaurant(restaurant) {
        return (`./restaurant.html?id=${restaurant.id}`);
    }

    /**
     * Restaurant image URL.
     */
    static imageUrlForRestaurant(restaurant) {
        return (`/img/${restaurant.photograph}`);
    }

    /**
     * Array containing name suffix & width of each associated image size
     * @returns { Array<{name: String, width: Number}> } Array of size objects
     */
    static imageSizesForRestaurant(restaurant) {
        const imageSizesObject = restaurant.photograph_sizes;
        const returnSizeObject = ([key, val]) => ({ name: key === 'xl' ? '' : key, width: val });
        return Object.entries(imageSizesObject).map(returnSizeObject);
    }

    /**
     * Map marker for a restaurant.
     */
    static mapMarkerForRestaurant(restaurant, map) {
        const marker = new google.maps.Marker({
            position: restaurant.latlng,
            title: restaurant.name,
            url: DBHelper.urlForRestaurant(restaurant),
            map: map,
            animation: google.maps.Animation.DROP
        });
        return marker;
    }

}