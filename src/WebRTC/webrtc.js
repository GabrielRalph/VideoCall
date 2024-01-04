import {Firebase, RTCSignaler} from "../Firebase/firebase.js"

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
      state_update = {status: "closed", remote: {stream: null}}
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




// WebRTC data channel functions
function sendMessage(message) {
  if (sendChannel && sendChannel.readyState == "open") {
    sendChannel.send(JSON.stringify(message));
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

let fileBuffer = {

}
let sendFileBuffer = [];
function extractChunk(data) {
  let chunk = [];
  let str = "";
  let delimCount = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === "," && delimCount < 4) {
      chunk.push(str);
      str = "";
      delimCount ++;
    } else {
      str += data[i];
    }
  }
  chunk.push(str);
  return chunk;
}
function loadFileChunk(data) {
  let [key, name, index, length, buffer] = extractChunk(data);
  length = parseInt(length);
  index = parseInt(index);
  let type = key[1]
  // console.log(`\tReceived chunk [${index+1}/${length}]: ${buffer.length}bytes.`);
  if (!(name in fileBuffer)) fileBuffer[name] = {};

  fileBuffer[name][index] = buffer;

  let complete = true;
  for (let i = 0; i < length; i++) {
    if (!(i in fileBuffer[name])) complete = false;
  }

  if (!complete && sendChannel && sendChannel.readyState == "open") {
    sendChannel.send("R");
  } 

  if (complete) {
    let buffer = type == "S" ? "" : [];
    for (let i = 0; i < length; i++) {
      for (let j = 0; j < fileBuffer[name][i].length; j++) {
        if (type == "S") {
          buffer += fileBuffer[name][i][j]
        } else {
          buffer.push(fileBuffer[name][i].charCodeAt(j));
        }
      }
    }

    console.log(`Received file "${name}": ${buffer.length}bytes.`);

    // Cast to array buffer
    if (type == "A") {
      let uint8buffer = new Uint8Array(buffer);
      buffer = uint8buffer.buffer;
      for (let i = 0; i < uint8buffer.length; i++) buffer[i] = uint8buffer[i];
    }

    let message = {data: {file: {name, buffer}}};
    updateHandler("data", message);
  }
}

function sendFileChunk() {
  if (sendFileBuffer.length > 0 && sendChannel && sendChannel.readyState == "open") {
    let chunk = sendFileBuffer.shift();
    // console.log(`\t sending chunk[${chunk[2]+1}/${chunk[3]}]: ${chunk[4].length}bytes.`);
    chunk = chunk.join(",");
    sendChannel.send(chunk);
  }
}

function handleReceiveMessage(event) {
  // console.log(event.data, event.data[0]);
  if (event.data[0] == "F") {
    loadFileChunk(event.data);
  } else if (event.data == "R") {
    sendFileChunk();
  } else {
    updateHandler("data", JSON.parse(event.data));
  }
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

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC FUNCTIONS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

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

/* makeSession, creates new session key */
export async function makeSession() {
  let key = await RTCSignaler.make();
  return key;
}

let maxChunkSize = 15e3;
export function sendFile(buffer, fileName) {
  // prepare file buffer
  let type = "S";
  if (buffer instanceof ArrayBuffer) {
    buffer = new Uint8Array(buffer);
    type = "A";
  }

  console.log(`Sending file "${fileName}": ${buffer.length}bytes.`);

  let chunks = Math.ceil(buffer.length / maxChunkSize);

  let addChunk = (i, str) => {
    sendFileBuffer.push(["F"+type, fileName, i, chunks, str])
  }
  let ci = 0;
  let chunk = ""
  for (let i = 0; i < buffer.length; i++) {
    if (i % maxChunkSize == 0 && i != 0) {
      addChunk(ci, chunk);
      chunk = "";
      ci = ci + 1;
    }
    chunk += type == "S" ? buffer[i] : String.fromCharCode(buffer[i]);
  }
  addChunk(ci, chunk);

  // send first byte
  sendFileChunk();
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

export function endSession(){
  console.log("end");
  if (isPolite()) {
    window.location = "../SessionEnd";
  } else {
    RTCSignaler.remove();
    window.location = "../"
  }
}