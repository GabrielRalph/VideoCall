import {firebaseConfig, storageURL} from "./firebase-config.js"
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'
import {getAuth, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js'
import {getDatabase, child, push, ref as _ref, get, onValue, onChildAdded, onChildChanged, onChildRemoved, set, off} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js'
import { getFunctions, httpsCallable  } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js'
import { getStorage, ref as sref, uploadBytesResumable, getDownloadURL, getBlob, getMetadata } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js'

let initialised = false;
let App = null;
let Database = null;
let Functions = null;
let Auth = null;
let User = "initialise";
let StateListeners = [];

// Generates a random key to use as the device's unique identifier DUID.
function makeRandomKey(){
  return  (Math.round(Math.random() * 100000)).toString(32) + Math.round(performance.now() * 1000).toString(32) + (Math.round(Math.random() * 100000)).toString(32);
}

/* If a DUID already exists in local storage retreive that key otherwise generate a new key 
   and store in local storage. */ 
let DUID = localStorage.getItem('duid');
if (DUID == null) {
  DUID = makeRandomKey();
  localStorage.setItem('duid', DUID);
}

/* If the user has changed updates the new user and calls all listeners with the new user data.
   If a listener returns the string "remove" then the listener will be removed */
function authChangeHandler(user){
  // If the user has changed
  if (((user == null) != (User == null || typeof User == "string")) || (user != null && User != null && user.uid != user.uid)) {
    // Update the user object
    User = user;
    let newListeners = [];
    // Call listeners with the new user
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
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC FUNCTIONS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/*  Initialize firebase, initializes the firebase app with the given configuration
    after initializing wait for an auth state change and return */
export async function initialise(config = firebaseConfig) {
  if (initialised) return;
  initialised = true;
  App = initializeApp(config);
  Database = getDatabase(App);
  Auth = getAuth();
  Functions = getFunctions(App, "asia-southeast1");

  return new Promise((resolve, reject) => {
    let init = true;
    onAuthStateChanged(Auth, async (userData) => {
      console.log("auth state change: user data", userData);
      if (init) {
        resolve();
        init = false;
      }
      authChangeHandler(userData);
    });
  });
}
  
//  Add an auth state change listener
export function addAuthChangeListener(obj) {
  StateListeners.push(obj);
}

// Get user uid, if none exists then the DUID is returned instead
export function getUID(){
  let uid = DUID;
  if (User != null && typeof User !== "string") {
    uid = User.uid;
  }
  return uid;
}

// Get user data object
export function getUser(){return User;}

// Get App object
export function getApp(){return App;}

// Get Database object
export function getDB(){return Database; }

// Get Ref using database
export function ref(path) {return _ref(Database, path);}

export async function callFunction(name, data) {
  let res = null;
  if (Functions){
    const func = httpsCallable(Functions, name);
    res = await func(data);
  }
  return res;
}

// Upload file to firebase storage bucket
export async function uploadFileToCloud(file, path, statusCallback) {
  let Storage = getStorage(App, storageURL);

  // path = `${path}`
  console.log("uploading file of size", (file.size / 1e6) + "MB");

  if (!(file instanceof File) || typeof path !== 'string') {
      console.log('invalid file');
      return null;
  }

  if (!(statusCallback instanceof Function))
      statusCallback = () => { }

  let sr = sref(Storage, path);

  let uploadTask = uploadBytesResumable(sr, file);
  uploadTask.on('next', statusCallback)
  await uploadTask;

  let url = await getDownloadURL(sr);
  return url;
}

export async function getFile(path) {
  let Storage = getStorage(App, storageURL);
  let sr = sref(Storage, path);
  let data = await getMetadata(sr)
  console.log(data);
  return await getBlob(sr);
}


export {child, get, push, set, onChildAdded, onValue}
