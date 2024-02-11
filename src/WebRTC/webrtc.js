import {Firebase, RTCSignaler} from "../Firebase/firebase.js"
import { ChunkReceiveBuffer, ChunkSendBuffer } from "./file-share.js";

let initialised = false;
let localStream = null;
let remoteStream = null;
let sendChannel;
let receiveChannel;
let onUpdateHandler = () => {};
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

/* Get Ice Server Provider Configuration Info
*/
async function getIceServers(){
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
      if(xhr.readyState == 4 && xhr.status == 200){
          let res = JSON.parse(xhr.responseText);
          console.log(res)
          resolve({iceServers: [res.v.iceServers]})
      }
    }
    xhr.open("PUT", "https://global.xirsys.net/_turn/squideye", true);
    xhr.setRequestHeader ("Authorization", "Basic " + btoa("GabrielRalph:b67b0d36-8f24-11ee-a574-0242ac130002") );
    xhr.setRequestHeader ("Content-Type", "application/json");
    xhr.send( JSON.stringify({"format": "urls"}) );
  })
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
      if (sendBuffer instanceof ChunkSendBuffer) {
        sendBuffer.reset(getMaxMessageSize());
        sendChunk(0);
      }
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
async function onSignalerReceive({ data: { description, candidate, session_ended } }) {
  try {
    if (session_ended) {
      updateHandler("state", "ended")
      endSession();
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
    case "F":
      loadFileChunk(event.data);
      break;
    case "R":
      onFileChunkResponse(event.data);
      break;
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
let receiveBuffer = null;
let sendBuffer = null;

function getMaxMessageSize(){
  let size = 0;
  if (pc != null) {
    size = pc.sctp.maxMessageSize;
  }
  return size;
}

/* Load file chunk, called when a file chunk is received accros the data channel. Sends the 
   file chunk response. */
function loadFileChunk(data) {
  if (receiveBuffer == null) {
    receiveBuffer = new ChunkReceiveBuffer();
  }

  try {
    let response = receiveBuffer.add(data);
    sendMessage(response);
  } catch (e) {
    // Received a new file, discard old file and store the new chunk
    receiveBuffer = new ChunkReceiveBuffer();
    let response = receiveBuffer.add(data);
    sendMessage(response);
  }
  updateStateListeners({file: {progress: receiveBuffer.progress}});
  if (receiveBuffer.complete) {
    let message = {data: {file: receiveBuffer.result}};
    receiveBuffer = null;
    updateHandler("data", message);
  } 
}

/* Send chunk, sends a file chunk accros the data channel. Sets a timeout such that if a response is not 
   received in 20s then the send process is reset. */
function sendChunk(i = null){
  let message = sendBuffer.get(i);
  sendMessage(message)
}

/* On file chunk response, called when a file chunk response is received accros the data channel
  i.e. the chunk was received successfuly. Send the next chunk if required. */  
function onFileChunkResponse(response) {
  sendBuffer.response(response);
  updateStateListeners({file: {progress: sendBuffer.progress}})
  if (!sendBuffer.complete) {
    sendChunk();
  }
}

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



export function sendFile(buffer, filename) {
  sendBuffer = new ChunkSendBuffer(buffer, filename, getMaxMessageSize());
  if (sessionState == "open") {
    sendBuffer.reset(getMaxMessageSize());
    sendChunk(0);
  }
}

/* Send data across data channel */
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
  await RTCSignaler.join(key, onSignalerReceive, forceParticipant)
  remoteStream = null;
  localStream = stream;
  startMessageChannel();
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }
  updateStateListeners({
    status: "started",
    type: getUserType(),
    local: {
      stream: localStream,
      audio_muted: !localStream.getAudioTracks()[0].enabled,
      video_muted: !localStream.getVideoTracks()[0].enabled,
    }
  })
  updateHandler("status")
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
    await RTCSignaler.remove();
    window.location = "../"
  }
}