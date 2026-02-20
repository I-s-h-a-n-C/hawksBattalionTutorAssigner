var firebaseConfig = {
  // add your own here
};

if (typeof firebase !== 'undefined' && firebase.app && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
