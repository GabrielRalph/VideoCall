import {Firebase, RTCSignaler} from "../Firebase/firebase.js"
import * as Webcam from "../Utilities/Webcam.js"
// import { ChunkReceiveBuffer, ChunkSendBuffer } from "./file-share.js";

let initialised = false;
/**
 * @type {MediaStream}
 */
let localStream = null;
let remoteStream = null;
let sendChannel;
let receiveChannel;
let onUpdateHandler = () => {};

/**
 * @type {RTCPeerConnection}
 */
let pc = null;

let remoteContentStatus = {
  video: null,
  audio: null,
  data_send: null,
  data_receive: null,
  ice_state: null,
  sent: null,
  recv: null,
}
let stateListeners = [];
let dataListeners = [];
let sessionState = "closed";
let ended = false;
let makingOffer = false;
let ignoreOffer = false;

/* Log Functions
*/
window.show_rtc_base = true;
function rtc_base_log(str) {
    if (window.show_rtc_base) {
      console.log("%c\t" + str, 'color: #bada55');
    }
}
function rtc_log_state() {
  let {video, audio, data_send, data_receive, ice_state, sent, recv} = remoteContentStatus;
  let cc = (val) => `color: ${val ? "green" : "red"}`
  data_send = data_send == "open";
  data_receive = data_receive == "open";
  ice_state = ice_state == "connected";
  console.log("%cvid %caud %cin %cout %cice %csent %crecv", cc(video), cc(audio), cc(data_receive), cc(data_send), cc(ice_state), cc(sent), cc(recv));
}
function rtc_l1_log(str) {
  console.log("%c" + str, 'color: #00a3fd');
}


function getIceServersTwilio(){
  return {iceServers: [
    {
      url: 'stun:global.stun.twilio.com:3478',
      urls: 'stun:global.stun.twilio.com:3478'
    },
    {
      url: 'turn:global.turn.twilio.com:3478?transport=udp',
      username: 'c84323835421edd034a2fb18c9db112989279a83cf88dcc6bfe66e3d28dcad10',
      urls: 'turn:global.turn.twilio.com:3478?transport=udp',
      credential: 'w6u1Q8UNw0Pvq4MeCP9J0bwkl7PdHJUz5RW1RPTEl50='
    },
    {
      url: 'turn:global.turn.twilio.com:3478?transport=tcp',
      username: 'c84323835421edd034a2fb18c9db112989279a83cf88dcc6bfe66e3d28dcad10',
      urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
      credential: 'w6u1Q8UNw0Pvq4MeCP9J0bwkl7PdHJUz5RW1RPTEl50='
    },
    {
      url: 'turn:global.turn.twilio.com:443?transport=tcp',
      username: 'c84323835421edd034a2fb18c9db112989279a83cf88dcc6bfe66e3d28dcad10',
      urls: 'turn:global.turn.twilio.com:443?transport=tcp',
      credential: 'w6u1Q8UNw0Pvq4MeCP9J0bwkl7PdHJUz5RW1RPTEl50='
    }
  ]}
}

/* Get Ice Server Provider Configuration Info
*/
function getDefaulIceServers(){
  return {iceServers: [
    {urls: "stun:stun.l.google.com:19302"},
    {urls: "stun:stun1.l.google.com:19302"},
    {urls: "stun:stun2.l.google.com:19302"},
    {urls: "stun:stun3.l.google.com:19302"},
    {urls: "stun:stun4.l.google.com:19302"},
    {urls: "stun:stun01.sipphone.com"},
    {urls: "stun:stun.ekiga.net"},
    {urls: "stun:stun.fwdnet.net"},
    {urls: "stun:stun.ideasip.com"},
    {urls: "stun:stun.iptel.org"},
    {urls: "stun:stun.rixtelecom.se"},
    {urls: "stun:stun.schlund.de"},
    {urls: "stun:stunserver.org"},
    {urls: "stun:stun.softjoys.com"},
    {urls: "stun:stun.voiparound.com"},
    {urls: "stun:stun.voipbuster.com"},
    {urls: "stun:stun.voipstunt.com"},
    {urls: "stun:stun.voxgratia.org"},
    {urls: "stun:stun.xten.com"},
    {urls: "stun:stun.xten.com"},
    {urls: "turn:13.239.38.47:80?transport=udp", 
    credential: "key1", username: "username1"},
    {urls: "turn:13.239.38.47:80?transport=tcp", 
    credential: "key1", username: "username1"},
    {urls: "stun:stun.xten.com"},
  ]}
}

async function getIceServersXirsys(){
  const appName = "squidlyapp";
  const appSecret = "joshuaaarons:3bc25f98-cef0-11ee-9e50-0242ac130003";
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
      if(xhr.readyState == 4 && xhr.status == 200){
          let res = JSON.parse(xhr.responseText);
          if (res.s == "error") 
            reject("error")
          else 
            resolve({iceServers: [res.v.iceServers]})
      }
    }
    xhr.open("PUT", "https://global.xirsys.net/_turn/" + appName, true);
    xhr.setRequestHeader ("Authorization", "Basic " + btoa(appSecret) );
    xhr.setRequestHeader ("Content-Type", "application/json");
    xhr.send( JSON.stringify({"format": "urls"}) );
  })
}

async function getIceServersMetered(){
  // Calling the REST API TO fetch the TURN Server Credentials
  let response = await fetch("https://squidly.metered.live/api/v1/turn/credentials?apiKey=90111f9679c2c3b1b3febacf55fc6650aad2");

  // Saving the response in the iceServers array
  let iceServers = await response.json();

  console.log(iceServers);

  return iceServers;
}

async function getIceServers(){
  let iceServers = getDefaulIceServers();
  // let i2 = await getIceServersXirsys(); 
  // console.log(i2);/
  return iceServers;
}

function isStatusReady(){
  let {video, audio, data_send, data_receive, ice_state} = remoteContentStatus;
  return video && audio && data_send == "open" && data_receive == "open" && ice_state == "connected";
}

let last_state_update = null;
function updateStateListeners(state_update) {
  last_state_update = state_update;
  for (let callback of stateListeners) {
    callback(state_update);
  }
}

let last_data = null;
function updateDataListeners(data) {
  last_data = data;
  for (let callback of dataListeners) {
    callback(data);
  }
}

function muteTrackRequest(type) {
  console.log("requested mute " + type);
  let track = localStream[`get${type[0].toUpperCase() + type.slice(1)}Tracks`]()[0];
  if (track.enabled && RTCSignaler.isPolite()) {
    muteTrack(type)
  }
}

/* RTC Update Handler */
function updateHandler(type, data){
  if (ended) return;

  let channel_data = null;
  let state_update = null;
  if (type == "state") {
    if (data == "ended") {
      ended = true;
      state_update = {status: "ended"};
      rtc_l1_log("ended");
    }

    // Session is open and has now started
    // Send message to remote caller telling them we are open
    if (sessionState == "closed" && isStatusReady()) {
      sendMessage({request_status: true});
      remoteContentStatus.sent = true;

    // Session has closed
    } else if (sessionState == "open") {
      sessionState = "closed";
      remoteContentStatus.sent = false;
      remoteContentStatus.recv = false;
      state_update = {status: "closed", remote: {stream: null}};
      rtc_l1_log("closed");
    }
    rtc_log_state();

  // Data has been received from the remote caller
  } else if (type == "data") {
    // If the session is open
    if ("request_status" in data) {
      sendMessage({
        status_result: true,
        audio_muted: !localStream.getAudioTracks()[0].enabled,
        video_muted: !localStream.getVideoTracks()[0].enabled,
      });

    } else if ("status_result" in data) {
      sessionState = "open"
      remoteContentStatus.recv = true;
      state_update = {status: "open", remote: {stream: remoteStream}};
      // if (sendBuffer instanceof ChunkSendBuffer) {
      //   sendBuffer.reset(getMaxMessageSize());
      //   sendChunk(0);
      // }
      rtc_log_state();
      rtc_l1_log("open");
    }


    for (let key of ["video", "audio"]) {
      let wkey = key+"_muted"
      if (wkey in data) {
        if (state_update == null) state_update = {remote: {}};
        state_update.remote[wkey] = data[wkey];
      }
      let rkey = "request_"+wkey;
      if (rkey in data) {
        muteTrackRequest(key);
      }
    }

    if (sessionState == "open" && "data" in data){
      channel_data = data.data;
    }
  }

  updateStateListeners(state_update);
  if (channel_data != null) {
    updateDataListeners(channel_data)
  }
}

// WebRTC negotiation event handlers
async function onSignalerReceive({ data: { description, candidate, session_ended, fieldState, usage } }) {
  try {
    if (session_ended) {
      updateHandler("state", "ended")
      endSession();
    }else if (fieldState){
      if (typeof fieldState === "object" && fieldState !== null) {
        updateStateListeners(fieldState);
      }
    }else if (usage || usage === null){
      updateDataListeners({usage});
    }else if (description) {
      rtc_base_log("description <-- " + description.type);
      rtc_base_log(pc.signalingState);
      const offerCollision =
      description.type === "offer" &&
      (makingOffer || pc.signalingState !== "stable");

      ignoreOffer = !RTCSignaler.isPolite() && offerCollision;
      if (ignoreOffer) {
        // console.log("ignored");
        return;
      }
      try {
        // if (signaler.polite && pc.signalingState == "has-local-")
        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          // console.log("sending");
          await pc.setLocalDescription();
          rtc_base_log("description --> " + pc.localDescription.type);

          RTCSignaler.send({ description: pc.localDescription });
        }
      } catch (e) {

        console.log(e, e.code);
        throw `description failure`
      }

    } else if (candidate) {
      try {
        await pc.addIceCandidate(candidate);
        rtc_base_log("candidate <--");
      } catch (e) {
        if (!ignoreOffer) {
          console.log(e);
          throw 'candidate failure';
        }
      }
    }
  } catch (e) {
  }
}

function onicecandidate(data) {
  rtc_base_log("candidate -->");
  RTCSignaler.send(data);
}

function oniceconnectionstatechange(){
  if (pc.iceConnectionState === "failed") {
    pc.restartIce();
  } else if (pc.iceConnectionState == "connected"){
  } else if (pc.iceConnectionState === "disconnected") {
    sendChannel = null;
  }
  remoteContentStatus.ice_state = pc.iceConnectionState;
  updateHandler("state");
}

async function onnegotiationneeded(){
  rtc_base_log("negotiation needed " );
  try {
    makingOffer = true;
    await pc.setLocalDescription();
    rtc_base_log("description --> " + pc.localDescription.type);
    RTCSignaler.send({ description: pc.localDescription });
  } catch (err) {
    console.error(err);
  } finally {
    makingOffer = false;
  }
}

function ontrackadded({ track, streams }){
  rtc_base_log(`track received ${track.kind} [${streams[0].id.split("-")[0]}]`);
  remoteStream = streams[0];
  track.onunmute = () => {
    rtc_base_log("track unmuted " + track.kind);
    remoteContentStatus[track.kind] = track;
    updateHandler("state");
  };
  track.onmute = () => {
    rtc_base_log("track muted " + track.kind);
    let update = {
      remove_stream: true,
    }
    remoteContentStatus[track.kind] = null;
    updateHandler("state");
  }
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ DATA CHANNEL METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

/* Send message sends a message accros the data channel*/
function sendMessage(message) {
  if (sendChannel && sendChannel.readyState == "open") {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    sendChannel.send(message);
  }
}

/* Send message sends a message accros the data channel*/
function handleReceiveMessage(event) {
  // console.log(event.data, event.data[0]);
  switch (event.data[0]) {
    // case "F":
    //   loadFileChunk(event.data);
    //   break;
    // case "R":
    //   onFileChunkResponse(event.data);
    //   break;
    default:
      updateHandler("data", JSON.parse(event.data));
      break;
  }
}

function receiveChannelCallback(event) {
  if (sendChannel == null) {
    startMessageChannel();
  }
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleReceiveMessage;
  receiveChannel.onopen = handleReceiveChannelStatusChange;
  receiveChannel.onclose = handleReceiveChannelStatusChange;
}

function handleReceiveChannelStatusChange(event) {
  if (receiveChannel) {
    remoteContentStatus.data_receive = receiveChannel.readyState
    updateHandler("state");
  }
}

function handleSendChannelStatusChange(event) {
  if (sendChannel) {
    const state = sendChannel.readyState;
    remoteContentStatus.data_send = state
    if (state == "closed") {
      sendChannel = null;
    }
    updateHandler("state")
  }
}

function startMessageChannel(){
  sendChannel = pc.createDataChannel("sendChannel");
  sendChannel.onopen = handleSendChannelStatusChange;
  sendChannel.onclose = handleSendChannelStatusChange;
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ FILE SEND METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
// let receiveBuffer = null;
// let sendBuffer = null;

// function getMaxMessageSize(){
//   let size = 0;
//   if (pc != null) {
//     size = pc.sctp.maxMessageSize;
//   }
//   return size;
// }

// /* Load file chunk, called when a file chunk is received accros the data channel. Sends the 
//    file chunk response. */
// function loadFileChunk(data) {
//   if (receiveBuffer == null) {
//     receiveBuffer = new ChunkReceiveBuffer();
//   }

//   try {
//     let response = receiveBuffer.add(data);
//     sendMessage(response);
//   } catch (e) {
//     // Received a new file, discard old file and store the new chunk
//     receiveBuffer = new ChunkReceiveBuffer();
//     let response = receiveBuffer.add(data);
//     sendMessage(response);
//   }
//   updateStateListeners({file: {progress: receiveBuffer.progress}});
//   if (receiveBuffer.complete) {
//     let message = {data: {file: receiveBuffer.result}};
//     receiveBuffer = null;
//     updateHandler("data", message);
//   } 
// }

// /* Send chunk, sends a file chunk accros the data channel. Sets a timeout such that if a response is not 
//    received in 20s then the send process is reset. */
// function sendChunk(i = null){
//   let message = sendBuffer.get(i);
//   sendMessage(message)
// }

// /* On file chunk response, called when a file chunk response is received accros the data channel
//   i.e. the chunk was received successfuly. Send the next chunk if required. */  
// function onFileChunkResponse(response) {
//   sendBuffer.response(response);
//   updateStateListeners({file: {progress: sendBuffer.progress}})
//   if (!sendBuffer.complete) {
//     sendChunk();
//   }
// }

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC FUNCTIONS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


/* load instantiates the WebRTC Peer connection object. Initialise the firebase database if it has not been done
    already and retreive the ice server provider config.
    If the boolean parameter "onlyFirebase" is set true then only the firebase database will be initialised 
    i.e. when using the webrtc module to create a session key. */
export async function load(onlyFirebase = false){
  if (initialised) return;
  await Firebase.initialise();
  if (!onlyFirebase) {
    initialised = true;
    let config = await getIceServers();

    pc = new RTCPeerConnection(config);
    pc.ondatachannel = receiveChannelCallback;
    pc.ontrack = ontrackadded
    pc.onnegotiationneeded = onnegotiationneeded;
    pc.oniceconnectionstatechange = oniceconnectionstatechange;
    pc.onicecandidate = onicecandidate;
  }
}


/* makeKeyLink generates a session link from the given key . */
export function makeKeyLink(key, option = null) {
  let {origin, pathname} = window.location;
  if (typeof option === "string") option = `.${option}`;
  else option = "";
  return `${origin}${pathname}?${key}${option}`
}

/** Mute track attempts to mute a given track type for the local or remote stream.
 * @param {String} trackType either audio or video
 * @param {String} source either local or remote, if remote a request to mute is sent to the remote user
 * @param {Boolean} bool to unmute or mute, if null track is toggled
  */
export function muteTrack(trackType = "auido", source = "local", bool = null) {
  let res = null;
  console.log(trackType, bool);
  if (localStream && source == "local") {
    let tracks = localStream[`get${trackType[0].toUpperCase() + trackType.slice(1)}Tracks`]();
    let t = tracks[0];
    if (bool == null) bool = t.enabled;
    t.enabled = !bool;
    let msg = {};
    msg[trackType + "_muted"] = bool;
    updateStateListeners({local: msg})
    sendMessage(msg);
    res = bool;
  } else if (source == "remote" && sessionState == "open") {
    let msg = {};
    msg["request_"+trackType+"_muted"] = true;
    sendMessage(msg);
  }
  return res;
}

/** Adds a state listeners
 * @param {Object, Function} callback, if the callback is an object with a function onStateChange then 
 *                                     that method will be executed on a state change otherwise the state
 *                                     field of the object will be set to the current state change object
 *                                
*/
export function addStateListener(callback) {
  let fnct = null;
  if (callback instanceof Function) {
    fnct = callback;
  } else if (typeof callback === "object" && callback != null) {
    if (callback.onStateChange instanceof Function) {
      fnct = callback.onStateChange
    } else {
      fnct = (e) => callback.state = e;
    }
  }
  if (fnct !== null) {
    stateListeners.push(fnct);
    fnct(last_state_update);
  }
}

/** Adds a data listeners
 * @param {Object, Function} callback, if the callback is an object with a function onData then 
 *                                     that method will be executed when data is received otherwise the data
 *                                     field of the object will be set to the current data received
 *                                
*/
export function addDataListener(callback) {
  let fnct = null;
  if (callback instanceof Function) {
    fnct = callback;
  } else if (typeof callback === "object" && callback != null) {
    if (callback.onStateChange instanceof Function) {
      fnct = callback.onData
    } else {
      fnct = (e) => callback.data = e;
    }
  }
  if (fnct !== null) {
    dataListeners.push(fnct);
    fnct(last_data);
  }
}



// export function sendFile(buffer, filename) {
//   sendBuffer = new ChunkSendBuffer(buffer, filename, getMaxMessageSize());
//   if (sessionState == "open") {
//     sendBuffer.reset(getMaxMessageSize());
//     sendChunk(0);
//   }
// }

// /* Send data across data channel */
export function sendData(data) {
  let message = {data}
  sendMessage(message);
}

/* start call */
export async function start(key, stream, forceParticipant){
  if (!initialised) {
    await load();
  }
  ended = false;
  let {iceServers, initialState} = await RTCSignaler.join(key, onSignalerReceive, forceParticipant);
  pc.setConfiguration({iceServers});
  
  remoteStream = null;
  localStream = stream;
  startMessageChannel();
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }


  let vt = localStream.getVideoTracks()[0];
  let at = localStream.getAudioTracks()[0];
  vt.enabled = !initialState.video
  at.enabled = !initialState.audio

  let state = {
    status: "started",
    type: getUserType(),
    local: {
      stream: localStream,
      audio_muted: !at.enabled,
      video_muted: !vt.enabled,
    }
  }
  if (getUserType() == "host") {
    state.local["name"] = initialState.displayName;
    state.local["photo"] = initialState.displayPhoto;
    state.local["pronouns"] = initialState.pronouns;
  } else {
    state.remote = {name: initialState.displayName, photo: initialState.displayPhoto, pronouns: initialState.pronouns};
  }
  updateStateListeners(state);
  updateHandler("status")
}

/**
 * @returns {Bytes} Mega Bytes used
 */
async function getTotalDataUsage(){
  let stats = await pc.getStats();
  let bytes = 0;
  for (let [id, stat] of stats) {
    if (stat.type == "candidate-pair") {
      if (typeof stat.bytesSent == "number" && !Number.isNaN(stat.bytesSent)) bytes += stat.bytesSent
      if (typeof stat.bytesReceiveds == "number" && !Number.isNaN(stat.bytesReceiveds)) bytes += stat.bytesReceiveds
    }
  }
  return bytes;
}

export async function waitForHost(key){
  return await RTCSignaler.waitForHost(key);
}

export function getUserType(){
  return RTCSignaler.getUserType();
}

export function isPolite(){
  return RTCSignaler.isPolite();
}

export function getKey(){
  return RTCSignaler.getKey();
}

export async function endSession(){
  console.log("end");


  if (isPolite()) {
    window.location = "../SessionEnd";
  } else {
    await RTCSignaler.remove(await getTotalDataUsage());
    window.location = "../"
  }
}

export async function uploadSessionContent(file, callback){
  return await RTCSignaler.uploadSessionContent(file, callback)
}

export function setSessionFieldState(field, value) {
  return RTCSignaler.setSessionStateField(field, value);
}

export function changeSessionContentPage(page){
  return RTCSignaler.changeSessionContentPage(page)
}

let selectedOutput = null;
/**
 * @return {Promise<MediaDeviceInfo[]>}
 */
export async function getTrackSelection() {
  let devices = [...await navigator.mediaDevices.enumerateDevices()];
  let selected = {}
  localStream.getTracks().forEach(t => {selected[t.getSettings().deviceId] = true});
  devices.forEach(d => {
    if (d.kind == "audiooutput" && selectedOutput !== null) {
      if (selectedOutput == d.deviceId) {
        d.selected = true;
      }
    } else if (d.deviceId in selected) d.selected = true
  })
  console.log(devices);
  return devices;
}

let streamConstraints = {
  video: {
    deviceId: "defualt",
    width: { min: 320, ideal: 640, max: 1920 },
    height: { min: 240, ideal: 480, max: 1080 },
    facingMode: "user",
  },
  audio: {deviceId: "default"},
}

export async function selectAudioOutput(id) {
  let videos = document.querySelectorAll("[type = 'remote'] video");
  for (let video of videos) {
    try {
      await video.setSinkId(id);
    } catch(e) {
    }
  }
  selectedOutput = id;
}

/**
 * @param {"audio"|"video"} type
 * @param {String} id
 */
export async function replaceTrack(type, id) {
    streamConstraints[type].deviceId = id;
    let stream =  await navigator.mediaDevices.getUserMedia( streamConstraints );
    if (type == "video") {
      let sc = JSON.parse(JSON.stringify(streamConstraints));
      sc.audio = false;
      let stream2 = await navigator.mediaDevices.getUserMedia( sc );
      Webcam.setStream(stream2);
    }
    let senders = pc.getSenders();
    let stateUpdate = {stream: stream};
    for (let key of ["Video", "Audio"]) {
      let oldTrack = localStream[`get${key}Tracks`]()[0];
      let track = stream[`get${key}Tracks`]()[0];
      track.enabled = oldTrack.enabled;
      stateUpdate[key.toLowerCase() + "_muted"] = !track.enabled;
      let sender = senders.filter(s => s.track.kind == key.toLowerCase())[0];
      sender.replaceTrack(track);
      oldTrack.stop();
    }
    updateStateListeners({local: stateUpdate})
    localStream = stream;
}