import {set, get, ref, push, child, getDB, getUID, onChildAdded, onValue, callFunction, uploadFileToCloud} from "./firebase-basic.js"

const SESSION_ROOT_KEY = "sessions";

let UserType = null;
let CurrentSessionKey = null;
let Listening = false;
let CandidateListener = null;
let DescriptionListener = null;
let HostUIDListener = null;
let ContentListener = null;
let TickIntervalID = null;
let messageHandler = () => {};

async function sendTick(key){
  let res = await callFunction("sendTick", {sid: key})
  if (res.data != null) {
    messageHandler({data: {usage: res.data}});
  }
}

function getSessionRef(sessionID, path) {
  let Database = getDB();
  let sref = null;
  if (Database != null) {
    if (typeof sessionID === "string") {
      sref = ref(SESSION_ROOT_KEY + "/" + sessionID);
      if (typeof path === "string") sref = child(sref, path);
    } else {
      sref = push(ref(SESSION_ROOT_KEY));
    }
  }
  return sref;
}

async function getHostUID(key){
  let uid = null;
  for (let trys = 0; trys < 5; trys++){
    let uidRef = getSessionRef(key, "hostUID");
    if (uidRef == null) {
      throw "Database has not been initialised";
    }
    try{
      uid = (await get(uidRef)).val();
      return uid;
    } catch(e) {
      console.log(e);
    }
  }
  throw "Failed to connect to signaling server.";
}

// remove signaling channel listeners
function removeListeners(){
  Listening = false;
  if (CandidateListener instanceof Function) CandidateListener();
  if (DescriptionListener instanceof Function) DescriptionListener();
  if (HostUIDListener instanceof Function) HostUIDListener();
  if (ContentListener instanceof Function) ContentListener();
  if (TickIntervalID != null) clearInterval(TickIntervalID);
}

const TICK_TIMEOUT_MINUTES = 5;
// add signaling channel listeners
function addListeners(key, userType){
  // Unsubscribe any previous listeners
  removeListeners();

  // Listen to the oposite user type
  let listenTo = userType == "host" ? "participant" : "host"

  sendTick(key);
  TickIntervalID = setInterval(async () => {
    sendTick(key);
  }, TICK_TIMEOUT_MINUTES * 60*1000)

  let hostUIDRef = getSessionRef(key, "hostUID");
  HostUIDListener = onValue(hostUIDRef, (sc) => {
    if (sc.val() == null) {
      messageHandler({data: {
        session_ended: true,
      }})
    }
  });

  let contentRef = getSessionRef(key, "content");
  if (userType == "host") {
    // Get content information once at the start for host
    let gc = async () => {
      let contentInfo = (await get(contentRef)).val();
      if (contentInfo != null) {
        messageHandler({data: {contentInfo}});
      }
    }
    gc();
  } else {
    // Watch content info for the participant
    ContentListener = onValue(contentRef, (sc) => {
      let contentInfo = sc.val();
      messageHandler({data: {contentInfo}})
    })
  }

  let descriptionRef = getSessionRef(key, `${listenTo}/description`);
  DescriptionListener = onChildAdded(descriptionRef, (sc) => {
    messageHandler({
      data: {
        description: new RTCSessionDescription(sc.val())
      }
    })
    set(child(descriptionRef, sc.key), null);
  });

  let candidateRef = getSessionRef(key, `${listenTo}/candidates`);
  CandidateListener = onChildAdded(candidateRef, (sc) => {
    messageHandler({
      data:{
        candidate: new RTCIceCandidate(sc.val())
      }
    })
    set(child(candidateRef, sc.key), null);
  });

  UserType = userType;
  CurrentSessionKey = key;
  Listening = true;
}

// Reomve session
export async function remove(bytes){
  await callFunction("endSession", {sid: CurrentSessionKey, bytes: bytes});
}

export async function waitForHost(key) {
  return new Promise((resolve, reject) => {
    let stopOnValue = onValue(getSessionRef(key, "iceServers"), (sc) => {
      if (sc.val() != null) {
        stopOnValue();
        resolve(sc.val());
      }
    })
  })
}

/* Join session joins the given session key, if forceParticipant is set true
   the user will join as participant otherwise the user will join as a host
   if they are the host or participant if not. */
export async function join(key, onmessage, forceParticipant = false) {
  let hostUID = await getHostUID(key);
  if (hostUID == null) {
    throw "No session exists for this session link."
  }

  let asParticipant = !((hostUID == getUID()) && (!forceParticipant));

  // let time = (await get(getSessionRef(key, "time"))).val();
  // console.log(new Date(time) + "");
  
  let iceServers = (await get(getSessionRef(key, "iceServers"))).val();
  if (iceServers == null) {
    if (asParticipant) {
      let error = new Error("Host has not started the session yet, please wait for the host to begin.");
      error.waitForHost = true;
      throw error;
    } else {
      let {data} = await callFunction("startSession", {sid: key});
      if (data.error != null || data.iceServers == null) {
        let names = "";
        if (data.error.startsWith("Usage exceeded")) names = data.error.replace("Usage exceeded ", "")
        throw `You cannot host a meeting currently, please check your ${names} usage.`
      } 
      iceServers = data.iceServers;
    }
  }

  if (onmessage instanceof Function) messageHandler = onmessage;

  let userType = asParticipant ? "participant" : "host";

  let initialState = {};
  for (let key of ["Video", "Audio"]) {
    let value = (await get(ref(`users/${hostUID}/info/${userType + key}`))).val();
    initialState[key.toLocaleLowerCase()] = value === false;
  }
  
  addListeners(key, userType);

  return {iceServers, initialState};
}

/* Leave the current session */
export function leave(){
  UserType = null;
  CurrentSessionKey = null;
}

/* Send WebRTC descriptions or candiates accros signaling channel */
export async function send({description, candidate}) {
  if (CurrentSessionKey && UserType) {
    let userRef = getSessionRef(CurrentSessionKey, UserType);
    if (description) {
      let descriptionRef = push(child(userRef, "description"));
      await set(descriptionRef, description.toJSON());
    } else if (candidate) {
      let candidateRef = push(child(userRef, "candidates"));
      await set(candidateRef, candidate.toJSON());
    }
  }
}

export async function uploadSessionContent(file, callback) {
  if (file instanceof File || file == null) {
    // upload content
    let contentRef = getSessionRef(getKey(), "content");
    set(contentRef.child("page"), 1);
    if (file == null) {
      set(contentRef, null);
    } else {
      let url = await uploadFileToCloud(file, `/session-content/${getKey()}`, (uts) => {
        if (callback instanceof Function)
          callback(uts.bytesTransferred / uts.totalBytes)
      })
      // set content info
      let type = file.type.indexOf("pdf") == -1 ? "image" : "pdf";
      update(contentRef, {
        url, 
        type,
      })
    }
  }
}

export function changeSessionContentPage(page) {
  let contentRef = getSessionRef(getKey(), "content/page");
  set(contentRef, page);
}

// returns wheather the user is a participant in the current session
export function isPolite(){
  if (UserType == null) return null;
  else return UserType !== "host"
}

export function getKey(){
  return CurrentSessionKey;
}

export function getUserType(){
  return UserType;
}