import './utils/registerServiceworker';
import { DBHelper } from './utils/dbhelper';

(() => {
  const form = document.getElementById('form');
  const nameInput = document.getElementById('name');
  const ratingInput = document.getElementById('rating');
  const commentsInput = document.getElementById('comments');
  const successDiv = document.getElementById('success');
  const errorDiv = document.getElementById('error');
  const errorMsg = document.getElementById('error-msg');

  const getQueryParams = url => {
    const queryString = url.split('?')[1];
    if (!queryString) return {};

    const paramPairs = queryString.split('&');
    const paramObject = paramPairs.reduce((obj, paramPair) => {
      const [key, val] = paramPair.split('=');
      obj[key] = val;
      return obj;
    }, {});
    return paramObject;
  };

  const createBackButton = id => {
    const btn = document.createElement('a');
    btn.href = `/restaurant.html?id=${id}`;
    btn.textContent = 'Back to restaurant page';
    return btn;
  }
  const showError = (msg) => {
    errorMsg.textContent = msg;
    errorDiv.classList.remove('hide');
  }

  const { restaurant_id: id } = getQueryParams(window.location.href);
  if (!id) return showError('No ID specified in URL.');

  DBHelper.fetchRestaurantById(id, (error, restaurant) => {
    if (error) return showError('Given ID does not match any restaurant.');

    const title = document.getElementById('restaurant-name');
    title.innerHTML += (':<br>' + restaurant.name);

    form.classList.remove('hide');

    form.addEventListener('submit', e => {
      e.preventDefault();

      const formData = {
        restaurant_id: id,
        name: nameInput.value,
        rating: ratingInput.value,
        comments: commentsInput.value,
      };

      DBHelper.addReview(formData, (error, response) => {
        if (error) return console.log(error);

        const back = createBackButton(id);
        successDiv.append(back);

        form.classList.add('hide');

        if (response.type && response.type === 'in_sync') {
          successDiv.querySelector('h3').textContent = `Your review was submitted. In case you're offline, we'll upload it once you have an internet connection!`;
        }
        successDiv.classList.remove('hide');
      })
    })
  })
})();