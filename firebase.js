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
        let descriptionRef = child(userRef, "description");
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
    let hostUID = (await get(getSessionRef(key, "hostUID"))).val();
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

  _add_listeners(key, userType){
    // Unsubscribe any previous listeners
    this.leave();

    this._userType = userType;
    this._sessionKey = key;

    // Add new listeners
    let listenTo = userType == "host" ? "participant" : "host"
    let candidateRef = getSessionRef(key, `${listenTo}/candidates`);
    let descriptionRef = getSessionRef(key, `${listenTo}/description`);
    console.log("listen to ", listenTo);
    let init = true;
    this._description_listener = onValue(descriptionRef, (sc) => {
      let json = sc.val();
      if (json !== null) {
        this._message_handler({
          data: {
            description: new RTCSessionDescription(json)
          }
        })
      }
    });
    if (init) {
      init = false;
      this._candidate_listener = onChildAdded(candidateRef, (sc) => {
        this._message_handler({
          data:{
            candidate: new RTCIceCandidate(sc.val())
          }
        })

      });
      this._listening = true;
    }
  }
  _message_handler(data) {
    // console.log(data);
    if (this.onmessage instanceof Function) this.onmessage(data);
  }
}

//
// export function entrantRef(sessionID, path) {
//   let pref = null;
//   let uid = getUID();
//   if (uid != null) {
//     pref = child(sessionRef(sessionID, "entrants"), uid);
//     if (typeof path === "string") pref = child(pref, path);
//   }
//   return pref;
// }
//
// export async function getSession(sessionID, path) {
//   let sref = sessionRef(sessionID, path);
//   let sc = await get(sref);
//   return sc.val();
// }
// export async function getEntrant(sessionID, path) {
//   let pref = entrantRef(sessionID, path);
//   let sc = await get(pref);
//   return sc.val();
// }
// export async function getUserData(path) {
//   let uref = usersRef(path);
//   let value = null
//   try {
//     let sc = await get(uref);
//     value = sc.val();
//   } catch (e) {}
//   return value;
// }
//
// export async function setSession(sessionID, path, value) {
//   let sref = sessionRef(sessionID, path);
//   await set(sref, value);
// }
// export async function setEntrant(sessionID, path, value) {
//   let pref = entrantRef(sessionID, path);
//   await set(pref, value);
// }
// export async function setUserData(path, value) {
//   let uref = usersRef(path);
//   try {
//     await set(uref, value);
//   } catch (e) {
//   }
// }
//
// export function onValueSession(sessionID, path, value) {
//   let sref = sessionRef(sessionID, path);
//   if (sref == null) return null;
//   return onValue(sref, value);
// }
// export function onValueEntrant(sessionID, path, value) {
//   let pref = entrantRef(sessionID, path);
//   if (pref == null) return null;
//   return onValue(pref, value);
// }
// export function onValueUserData(path, value) {
//   let uref = usersRef(path);
//   if (uref == null) return null;
//   return onValue(uref, value);
// }
//

//
//
// export function login(){
//   const provider = new GoogleAuthProvider();
//   console.log(Auth);
//   signInWithRedirect(Auth, provider);
// }
//
// export function logout(){
//   Auth.signOut();
// }
//
//
// export async function isCreator() {
//   let value = null;
//   try {
//     value = await getUserData("creator");
//   } catch (e) {
//   }
//   return value !== null
// }
//
// export async function isOwner(sessionID) {
//   let res = false;
//   try {
//     let uid = getUID();
//     let owner = await getSession(sessionID, "owner");
//     res = uid === owner && uid !== null;
//   } catch(e) {}
//   return res;
// }
//
// export async function removeCurrentSession() {
//   let session = await getUserData("info/current-session")
//   if (session) {
//     try{
//       await setSession(session, null, null);
//     } catch (e) {
//       // not owner of session
//     }
//     await setUserData("info/current-session", null);
//   }
// }
//
// //
//
// export async function createSession(file, progressCallback, dummy = true) {
//   let uid = getUID();
//   let sessionKey = getNewSessionKey();
//
//   // remove old session
//   try {
//     await removeCurrentSession();
//   } catch(e) {
//     console.log(e);
//     throw 'You do not have the privileges to create a sessions'
//   }
//
//   try {
//     await setSession(sessionKey, null, {
//       owner: uid,
//     });
//     // set users current session
//     await setUserData("info/current-session", sessionKey);
//   } catch (e) {
//     console.log(e);
//     throw 'You do not have the privileges to create a sessions'
//   }
//
//   // upload session content
//   try {
//     let url = "dummy";
//     if (!dummy) {
//       url = await uploadFileToCloud(file, uid, (info) => {
//         let progress = info.bytesTransferred / info.totalBytes;
//         if (progressCallback instanceof Function) {
//           progressCallback(progress);
//         }
//       }, App);
//     }
//     await setSession(sessionKey, 'info/pdf', {
//       url: url,
//       page: 1,
//     });
//   } catch(e) {
//     throw 'The session content failed to upload. Please try again and check your internet connection.'
//   }
//
//   // return session key
//   return sessionKey;
// }
//
// export async function sendRequest(info){
//   try {
//     await setUserData("info", info);
//   } catch(e) {
//     console.log(e);
//   }
// }
//
// // --------------------- session
//
//
// let SID = null;
// let IsCreator = null;
// let Detatchers = [];
// export async function joinSession(sessionID, isCreator = false){
//   let owner = await isOwner(sessionID);
//
//   if (owner === isCreator) {
//     IsCreator = isCreator;
//   } else if (isCreator == true && owner == false) {
//     throw 'You do not have host privileges'
//   }
//
//
//   try {
//     let pdf = await getSession(sessionID, "info/pdf");
//     console.log(pdf);
//     if (pdf == null) throw "Invalid session key"
//   } catch (e) {
//     console.log(e);
//     throw "Invalid session key";
//   }
//
//   SID = sessionID;
//   for (let detatch of Detatchers) detatch();
//
//   let detatchers = [
//     onValueSession(SID, "info/pdf", (sc) => {
//       update("pdf", sc.val());
//     })
//   ];
//
//   if (IsCreator) {
//     let entrantsd = onValueSession(SID, "entrants", (sc) => {
//       update("eyes", sc.val());
//     })
//     detatchers.push(entrantsd)
//   } else {
//     let moused = onValueSession(SID, "info/mouse", (sc) => {
//       update("mouse", sc.val());
//     });
//     detatchers.push(moused);
//   }
//
//   try {
//     setUserData("info/current-session", SID);
//   } catch (e) {
//     console.log(e);
//   }
//
//   Detatchers = detatchers;
// }



initializeFirebase();
