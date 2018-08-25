let restaurants,
    neighborhoods,
    cuisines
var map
var markers = []

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
    fetchNeighborhoods();
    fetchCuisines();
});

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
    DBHelper.fetchNeighborhoods((error, neighborhoods) => {
        if (error) { // Got an error
            console.error(error);
        } else {
            self.neighborhoods = neighborhoods;
            fillNeighborhoodsHTML();
        }
    });
}

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
    const select = document.getElementById('neighborhoods-select');
    neighborhoods.forEach(neighborhood => {
        const option = document.createElement('option');
        option.innerHTML = neighborhood;
        option.value = neighborhood;
        select.appendChild(option);
    });
}

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
    DBHelper.fetchCuisines((error, cuisines) => {
        if (error) { // Got an error!
            console.error(error);
        } else {
            self.cuisines = cuisines;
            fillCuisinesHTML();
        }
    });
}

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
    const select = document.getElementById('cuisines-select');

    cuisines.forEach(cuisine => {
        const option = document.createElement('option');
        option.innerHTML = cuisine;
        option.value = cuisine;
        select.appendChild(option);
    });
}

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
    let loc = {
        lat: 40.722216,
        lng: -73.987501
    };
    self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: loc,
        scrollwheel: false,
        keyboardShortcuts: false
    });
    // inspired by https://stackoverflow.com/questions/30531075/remove-the-tabindex-the-google-maps-in-my-page/30532333
    // exclude Google Map from tab navigation by setting all tabindices to -1
    const disableTabForGoogleMap = () => {
        const container = document.getElementById('map');
        container.querySelectorAll('*').forEach(el => el.tabIndex = -1);

        // hide Google Maps missing license popup
        const style = document.createElement('style');
        style.textContent = '#map>div:last-child{display:none;}';
        document.head.appendChild(style);
    }
    // timeout because markup of map is not complete immediately on tilesloaded
    self.map.addListener('tilesloaded', () => setTimeout(disableTabForGoogleMap, 250));
    updateRestaurants();
}

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
    const cSelect = document.getElementById('cuisines-select');
    const nSelect = document.getElementById('neighborhoods-select');

    const cIndex = cSelect.selectedIndex;
    const nIndex = nSelect.selectedIndex;

    const cuisine = cSelect[cIndex].value;
    const neighborhood = nSelect[nIndex].value;

    DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
        if (error) { // Got an error!
            console.error(error);
        } else {
            resetRestaurants(restaurants);
            fillRestaurantsHTML();
        }
    })
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
    // Remove all restaurants
    self.restaurants = [];
    const ul = document.getElementById('restaurants-list');
    ul.innerHTML = '';

    // Remove all map markers
    self.markers.forEach(m => m.setMap(null));
    self.markers = [];
    self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
    const ul = document.getElementById('restaurants-list');
    restaurants.forEach(restaurant => {
        ul.appendChild(createRestaurantHTML(restaurant));
    });

    if (self.map) addMarkersToMap();
}

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
    const li = document.createElement('li');

    const imageSrc = DBHelper.imageUrlForRestaurant(restaurant);
    const imageSizes = DBHelper.imageSizesForRestaurant(restaurant);
    const image = createImageHTML({
        alt: restaurant.imageAlt || '',
        src: imageSrc,
        sizes: imageSizes,
        HtmlSizes: '90vw, (min-width: 600px) 45vw, (min-width: 900px) 27vw, (min-width: 1200px) 20vw',
        className: 'restaurant-img'
    });
    li.appendChild(image);

    const name = document.createElement('h1');
    name.innerHTML = restaurant.name;
    li.appendChild(name);

    const neighborhood = document.createElement('p');
    neighborhood.innerHTML = restaurant.neighborhood;
    li.appendChild(neighborhood);

    const address = document.createElement('p');
    address.innerHTML = restaurant.address;
    li.appendChild(address);

    const more = document.createElement('a');
    more.innerHTML = 'View Details';
    more.setAttribute('aria-label', `View Details about ${restaurant.name}`);
    more.href = DBHelper.urlForRestaurant(restaurant);
    li.appendChild(more)

    return li
}

const extractFirstNumber = str => str.match(/\d+/)[0];
const constructImgURL = (suffix, url) => `/img/${extractFirstNumber(url)}${suffix ? '-' + suffix : ''}.jpg`;
const constructImgSrc = (size, url) => `${constructImgURL(size.name, url)} ${size.width}w`;
const constructSrcSetString = (sizes, url) => sizes.map((size) => constructImgSrc(size, url)).join(', ');

const createImageHTML = ({ src, sizes, HtmlSizes, alt = '', className = '' }) => {

    const picture = document.createElement('picture');
    picture.classList.add(className);

    const source = document.createElement('source');
    source.srcset = constructSrcSetString(sizes, src);
    source.sizes = HtmlSizes;
    picture.appendChild(source);

    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.classList.add(className);
    picture.appendChild(img);

    return picture;
};

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
    restaurants.forEach(restaurant => {
        // Add marker to the map
        const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
        google.maps.event.addListener(marker, 'click', () => {
            window.location.href = marker.url
        });
        self.markers.push(marker);
    });
}

updateRestaurants();
