import idb from './idb';

const checkResponseStatus = r => new Promise((res, rej) => {
  if ((r.status >= 200 && r.status < 300) || r.status === 0) res(r);
  else rej(r.statusText);
})

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
/* update the cached reviews for a given restaurant */
const updateReviewCache = async id => {
  const reviews = await fetch(
    `http://localhost:1337/reviews?restaurant_id=${id}`
  )
    .then(checkResponseStatus)
    .then(r => r.json());

  await putInReviewStore(reviews, id);
}
/* send a review to the server */
const sendReview = data => {
  return fetch('http://localhost:1337/reviews', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  }).then(checkResponseStatus);
}

/* Sends all reviews stored in the outbox to the server */
export const clearOutbox = () => new Promise(async (resolve, reject) => {
  const outbox = await getOutbox();
  if (!outbox || !outbox.length) return resolve(false);


  const affectedIds = outbox.map(({ restaurant_id: id }) => id);
  try {
    for (let i = 0; i < outbox.length; i++) {
      // get a review
      const review = outbox.pop();
      // send it
      await sendReview(review);
      // then remove it from the outbox by overwriting it with the
      // new, updated outbox
      await putInReviewStore(outbox, 'outbox');
    }
    resolve(true);
  } catch (e) {
    reject(e);
  }

  // Update cached reviews for all entries that changed
  Promise
    .all(affectedIds.map(updateReviewCache))
    .catch(() => console.log('Cache update after clearing outbox failed.'));

})