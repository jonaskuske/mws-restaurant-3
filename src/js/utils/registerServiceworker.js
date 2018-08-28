if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../../../service-worker.js')
    .then(_ => console.log('sw registered'))
    .catch(err => console.warn(`sw failed to register: ${err}`));
}