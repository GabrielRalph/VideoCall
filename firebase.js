import {initializeApp} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-app.js'
import {getAuth, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-auth.js'
import {getDatabase, child, push, ref, get, onValue, onChildAdded, onChildChanged, onChildRemoved, set, off} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-database.js'
// import {uploadFileToCloud} from "./fileupload.js"

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

export function addAuthChangeListener(obj) {
  StateListeners.push(obj);
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

const sessionKey = "meetings"
function getSessionRef(sessionID, path) {
  let sref = null;
  if (Database != null) {
    if (typeof sessionID === "string") {
      sref = ref(Database, sessionKey + "/" + sessionID);
      if (typeof path === "string") sref = child(sref, path);
    } else {
      sref = push(ref(Database, sessionKey));
    }
  }
  return sref;
}

function usersRef(path) {
  let uref = null;
  let uid = getUID();
  if (uid != null) {
    uref = ref(Database, 'users/' + uid);
    if (typeof path === "string") uref = child(uref, path);
  }
  return uref;
}

async function getHostUID(key){
  let uid = null;
  for (let trys = 0; trys < 3; trys++){
    try{
      uid = (await get(getSessionRef(key, "hostUID"))).val();
      return uid;
    } catch(e) {
    }
  }
  throw "failed to connect to signaling server"
}


export class SignalingChannel {
  constructor() {
    this._sessionKey = null;
    this._userType = null;
    this._listening = false;
  }

  onmessage(data) {

  }

  async send({description, candidate}) {
    let {userType, key} = this;
    if (key && userType) {
      let userRef = getSessionRef(key, userType);
      if (description) {
        let descriptionRef = push(child(userRef, "description"));
        await set(descriptionRef, description.toJSON());
      } else if (candidate) {
        let candidateRef = push(child(userRef, "candidates"));
        await set(candidateRef, candidate.toJSON());
      }
    }
  }

  async make(){
    let key = null;
    let sessionRef = getSessionRef();
    key = sessionRef.key;
    try {
      await set(child(sessionRef, "hostUID"), getUID());
      this._add_listeners(key, "host");
    } catch (e) {
      console.log(e);
      key = null;
    }

    return key;
  }

  async join(key, asParticipant = false) {
    let hostUID = await getHostUID(key);
    if (hostUID !== null) {
      asParticipant = !((hostUID == getUID()) && (!asParticipant));

      let userType = asParticipant ? "participant" : "host";
      this._add_listeners(key, userType);
    }
    return hostUID !== null;
  }

  leave(){
    this._listening = false;
    this._userType = null;
    this._sessionKey = null;
    if (this._candidate_listener instanceof Function) this._candidate_listener();
    if (this._description_listener instanceof Function) this._description_listener();
  }

  delete(){

  }

  get key(){return this._sessionKey;}

  get userType() {return this._userType;}

  get polite() {return this.userType !== "host"}

  clearInfo(key = this.key, user = this.polite ? "participant" : "host"){
    let candidateRef = getSessionRef(key, `${user}/candidates`);
    let descriptionRef = getSessionRef(key, `${user}/description`);
    set(candidateRef, null);
    set(descriptionRef, null);
  }

  restart(){
    let {key, userType} = this;
    if (this._candidate_listener instanceof Function) this._candidate_listener();
    if (this._description_listener instanceof Function) this._description_listener();
    this._add_listeners(key, userType);
  }
  async _add_listeners(key, userType){
    // Unsubscribe any previous listeners
    this.leave();

    this._userType = userType;
    this._sessionKey = key;

    // Add new listeners
    let listenTo = userType == "host" ? "participant" : "host"
    let candidateRef = getSessionRef(key, `${listenTo}/candidates`);
    let descriptionRef = getSessionRef(key, `${listenTo}/description`);

    // await set(descriptionRef, null);
    // await set(candidateRef, null);

    console.log("listen to ", listenTo);
    let init = true;
    this._description_listener = onChildAdded(descriptionRef, (sc) => {
      let json = sc.val();
      if (json !== null) {
        this._message_handler({
          data: {
            description: new RTCSessionDescription(json)
          }
        })
        set(child(descriptionRef, sc.key), null);
      }
    });
    if (init) {
      init = false;
      this._candidate_listener = onChildAdded(candidateRef, (sc) => {
        let key = sc.key;
        this._message_handler({
          data:{
            candidate: new RTCIceCandidate(sc.val())
          }
        })
        set(child(candidateRef, key), null);
      });
      this._listening = true;
    }
  }
  _message_handler(data) {
    // console.log(data);
    if (this.onmessage instanceof Function) this.onmessage(data);
  }
}


initializeFirebase();
