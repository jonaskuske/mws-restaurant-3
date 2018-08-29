import './utils/registerServiceworker';
import { DBHelper } from './utils/dbhelper';
import { clearOutbox } from './utils/outboxSync';

let restaurantGlobal;
var map;

const checkReviews = () => clearOutbox()
    .then(contentUpdated => {
        if (!contentUpdated) return;

        // notify user to reload page -> new reviews
        document.getElementById('new-content').classList.remove('hide');
    })

/* Check for new reviews */
if (navigator.onLine) checkReviews()
window.addEventListener('online', checkReviews);

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
    self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurantGlobal.latlng,
        scrollwheel: false
    });
    self.map.addListener('tilesloaded', () => setTimeout(() => {
        // hide Google Maps missing license popup
        const style = document.createElement('style');
        style.textContent = '#map>div:last-child{display:none;}';
        document.head.appendChild(style);
    }, 250))
    DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
}


/**
 * Get current restaurant from page URL.
 */
const fetchRestaurantFromURL = (callback) => {
    if (self.restaurant) { // restaurant already fetched!
        callback(null, self.restaurant)
        return;
    }
    const id = getParameterByName('id');
    if (!id) { // no id found in URL
        error = 'No restaurant id in URL'
        callback(error, null);
    } else {
        DBHelper.fetchRestaurantById(id, (error, restaurant) => {
            self.restaurant = restaurantGlobal = restaurant;
            if (!restaurant) {
                console.error(error);
                return;
            }
            fillRestaurantHTML(restaurant);
            callback(null, restaurant)
            document.title = `${restaurant.name} | NYC Restaurant Info`;

            // restaurant fetched: fetch and load reviews
            DBHelper.fetchReviewsByRestaurantId(id, (error, reviews) => {
                if (!reviews) {
                    console.error(error);
                    // run function to create 'no reviews yet!' notice
                    fillReviewsHTML(null);
                    return;
                }
                self.reviews = reviews;
                fillReviewsHTML(reviews);
            })
        });
    }
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
 * Create restaurant HTML and add it to the webpage
 */
const fillRestaurantHTML = (restaurant = self.restaurant) => {
    const id = restaurant.id;

    const btnFavorite = document.querySelector('.btn-favorite');
    const name = document.getElementById('restaurant-name');
    name.innerHTML = restaurant.name;

    // handle is_favorite being returned from the server with different types
    let favoriteStatus = restaurant.is_favorite === true || restaurant.is_favorite === 'true';

    // updates HTML depending on whether restaurant currently is favorite or not
    const markFavoriteStatus = status => {
        if (status) {
            name.innerHTML = restaurant.name + ' (favorite)';
            btnFavorite.textContent = '★';
            btnFavorite.classList.add('btn-favorite--is-fav');
            btnFavorite.setAttribute('aria-label', 'Mark as favorite restaurant')
        } else {
            name.innerHTML = restaurant.name;
            btnFavorite.textContent = '☆';
            btnFavorite.classList.remove('btn-favorite--is-fav');
            btnFavorite.setAttribute('aria-label', 'Unmark as favorite restaurant');
        }
    }
    // update the HTML
    markFavoriteStatus(favoriteStatus);

    // status changed server-side? toggle status, then update HTML accordingly
    const handleChange = (err, res) => {
        if (err) return console.error(err);

        favoriteStatus = !favoriteStatus;
        markFavoriteStatus(favoriteStatus);
    }

    function toggleFavoriteState() {
        DBHelper.setRestaurantFavoriteStatus(id, !favoriteStatus, handleChange);
    }

    // toggle state on click on the star-button
    btnFavorite.addEventListener('click', toggleFavoriteState)

    const address = document.getElementById('restaurant-address');
    address.innerHTML = restaurant.address;

    const image = document.getElementById('restaurant-img');

    const picture = createImageHTML({
        alt: restaurant.imageAlt || '',
        src: DBHelper.imageUrlForRestaurant(restaurant),
        sizes: DBHelper.imageSizesForRestaurant(restaurant),
        HtmlSizes: '100vw, (min-width: 750px) 50vw, (min-width: 140px) 30vw',
        className: 'restaurant-img'
    });

    image.parentNode.replaceChild(picture, image);

    const cuisine = document.getElementById('restaurant-cuisine');
    cuisine.innerHTML = restaurant.cuisine_type;

    // fill operating hours
    if (restaurant.operating_hours) {
        fillRestaurantHoursHTML();
    }
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
const fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
    const hours = document.getElementById('restaurant-hours');
    for (let key in operatingHours) {
        const row = document.createElement('tr');

        const currentDay = new Date()
            .toLocaleString('en-us', { weekday: 'long' })
            .replace(/\u200e|&lrm;/, ''); // remove LMR marks, neccessary for Edge

        if (key === currentDay) row.classList.add('current-date');

        const day = document.createElement('td');
        day.innerHTML = key;
        row.appendChild(day);

        const time = document.createElement('td');
        time.innerHTML = operatingHours[key];
        row.appendChild(time);
        row.setAttribute('aria-label', `Open hours on ${key}`);

        hours.appendChild(row);
    }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
const fillReviewsHTML = (reviews = self.reviews) => {
    const restaurantId = self.restaurant.id;

    const container = document.getElementById('reviews-container');

    const addReviewLink = document.querySelector('.add-review');
    addReviewLink.href += `?restaurant_id=${restaurantId}`;

    if (!reviews || !reviews.length) {
        const noReviews = document.createElement('p');
        noReviews.innerHTML = 'No reviews yet!';
        container.appendChild(noReviews);
        return;
    }
    const ul = document.getElementById('reviews-list');
    reviews.forEach(review => {
        ul.appendChild(createReviewHTML(review));
    });
    container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
const createReviewHTML = (review) => {
    const li = document.createElement('li');

    const header = document.createElement('header');
    const body = document.createElement('div');

    const name = document.createElement('p');
    name.innerHTML = review.name;
    header.appendChild(name);

    const date = document.createElement('p');
    const lastUpdate = review.updatedAt;
    const dateObj = new Date(lastUpdate)
    date.innerHTML = dateObj.toLocaleDateString();
    header.appendChild(date);
    li.appendChild(header);

    const rating = document.createElement('p');
    rating.classList.add('review-rating');
    rating.innerHTML = `Rating: ${review.rating}`;
    body.appendChild(rating);

    const comments = document.createElement('p');
    comments.classList.add('review-text');
    comments.innerHTML = review.comments;
    body.appendChild(comments);
    li.appendChild(body);

    return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
const fillBreadcrumb = (restaurant = self.restaurant) => {
    const breadcrumb = document.getElementById('breadcrumb');
    const li = document.createElement('li');
    li.innerHTML = restaurant.name;
    li.setAttribute('aria-current', 'page');
    breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
const getParameterByName = (name, url) => {
    if (!url)
        url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
        results = regex.exec(url);
    if (!results)
        return null;
    if (!results[2])
        return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

const showMapBtn = document.getElementById('btn-show-map');
showMapBtn.addEventListener('click', () => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDjyhk6b_ChJzBMlJV9nLEm-js94-W5Hv4&libraries=places&callback=initMap`;
    document.head.appendChild(script);

    showMapBtn.parentNode.removeChild(showMapBtn);
});

fetchRestaurantFromURL((error) => {
    if (error) console.error(error);
    else {
        fillBreadcrumb();
        // allow loading of Google
        showMapBtn.hidden = false;
    }
})