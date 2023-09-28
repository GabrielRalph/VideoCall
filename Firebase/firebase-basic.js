import {initializeApp} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-app.js'
import {getAuth, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-auth.js'
import {getDatabase, child, push, ref, get, onValue, onChildAdded, onChildChanged, onChildRemoved, set, off} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-database.js'

function delay(t) {
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, t);
  });
}
function makeRandomKey(){
  return  (Math.round(Math.random() * 100000)).toString(32) + Math.round(performance.now() * 1000).toString(32) + (Math.round(Math.random() * 100000)).toString(32);
}

let UpdateHandlers = [];
function update(type, value) {
  for (let callback of UpdateHandlers) {
    callback(type, value);
  }
}
export function addUpdateHandler (callback) {
  if (callback instanceof Function) {
    UpdateHandlers.push(callback);
  }
}

const firebaseConfig = {
  apiKey: "AIzaSyChiEAP1Rp1BDNFn7BQ8d0oGR65N3rXQkE",
  authDomain: "eyesee-d0a42.firebaseapp.com",
  databaseURL: "https://eyesee-d0a42-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "eyesee-d0a42",
  storageBucket: "eyesee-d0a42.appspot.com",
  messagingSenderId: "56834287411",
  appId: "1:56834287411:web:999340ed2fd5165fa68046"
};
let App = null;
let Database = null;
let Auth = null;
let User = null;
let DUID = localStorage.getItem('duid');
if (DUID == null) {
  DUID = makeRandomKey();
  localStorage.setItem('duid', DUID);
}

let StateListeners = [];
function initializeFirebase(config = firebaseConfig) {
  App = initializeApp(config);
  Database = getDatabase(App);
  Auth = getAuth();
  onAuthStateChanged(Auth, async (userData) => {
    console.log("auth state change: user data", userData);
    if (!(userData != null && User != null && User.uid === userData.uid))
    authChange(userData);
  });
}

function authChange(user){
  User = user;
  // update("user", null);
  watchUser();

  let newListeners = [];
  for (let obj of StateListeners) {
    if (obj instanceof Function) {
      if (obj(user) != "remove") newListeners.push(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      if (obj.onauthchange instanceof Function) {
        if (obj.onauthchange(user) != "remove") newListeners.push(obj);
      }
    }
  }

  StateListeners = newListeners;
}

let UserDataWatcher = null;
function watchUser(){
  // if (UserDataWatcher instanceof Function) {
    //   UserDataWatcher();
    //   UserDataWatcher = null;
    // }
    // UserDataWatcher = onValueUserData(null, (sc) => {
      //   update("user", sc.val());
      // });
    }

// public functions
export function getUser(){
  return User;
}

export function getUID(){
  let uid = DUID;
  if (User != null) {
    uid = User.uid;
  }
  return uid;
}

function getApp(){return App;}

export function addAuthChangeListener(obj) {
  StateListeners.push(obj);
}

export function getDB(){
  return Database;
}

initializeFirebase();

export {child, ref, get, push, set, onChildAdded, onValue}
