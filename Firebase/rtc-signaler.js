import {set, get, ref, push, child, getDB, getUID, onChildAdded} from "./firebase-basic.js"

const SESSION_ROOT_KEY = "meetings"
function getSessionRef(sessionID, path) {
  let Database = getDB();
  let sref = null;
  if (Database != null) {
    if (typeof sessionID === "string") {
      sref = ref(Database, SESSION_ROOT_KEY + "/" + sessionID);
      if (typeof path === "string") sref = child(sref, path);
    } else {
      sref = push(ref(Database, SESSION_ROOT_KEY));
    }
  }
  return sref;
}

function usersRef(path) {
  let Database = getDB();
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


let UserType = null;
let CurrentSessionKey = null;
let Listening = false;
let CandidateListener = null;
let DescriptionListener = null;
let messageHandler = () => {};


// remove signaling channel listeners
function removeListeners(){
  Listening = false;
  if (CandidateListener instanceof Function) CandidateListener();
  if (DescriptionListener instanceof Function) DescriptionListener();
}


// add signaling channel listeners
function addListeners(key, userType){
  // Unsubscribe any previous listeners
  removeListeners();

  // Listen to the opisite user type
  let listenTo = userType == "host" ? "participant" : "host"

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


/* Make session creates a new session signaling channel in the database
   returns the new session key
 */
export async function make(){
  let key = null;
  let sessionRef = getSessionRef();
  key = sessionRef.key;
  try {
    await set(child(sessionRef, "hostUID"), getUID());
  } catch (e) {
    console.log(e);
    key = null;
  }

  return key;
}

/* Koin session joins the given session key, if forceParticipant is set true
   the user will join as participant otherwise the user will join as a host
   if they are the host or participant if not.
*/
export async function join(key, onmessage, forceParticipant = false) {
  let hostUID = await getHostUID(key);
  if (hostUID !== null) {
    if (onmessage instanceof Function) messageHandler = onmessage;
    let asParticipant = !((hostUID == getUID()) && (!forceParticipant));

    let userType = asParticipant ? "participant" : "host";
    addListeners(key, userType);
  }
  return hostUID !== null;
}

/* Leave the current session
*/
export function leave(){
  UserType = null;
  CurrentSessionKey = null;
}

/* Send WebRTC descriptions or candiates accros signaling channel
*/
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
