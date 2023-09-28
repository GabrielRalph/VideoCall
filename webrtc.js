import {RTCSignaler} from "./Firebase/firebase.js"
const config = {
    iceServers: [
      {
        urls: [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
        ],
      },
    ],
    iceCandidatePoolSize: 10,
};

let makingOffer = false;
let ignoreOffer = false;
let remoteContentStatus = {
  video: null,
  audio: null,
  data: null,
}
let sendChannel;
let receiveChannel;

let onUpdateHandler = () => {};

let pc = new RTCPeerConnection(config);
pc.ondatachannel = receiveChannelCallback;
pc.ontrack = ontrackadded
pc.onnegotiationneeded = onnegotiationneeded;
pc.oniceconnectionstatechange = oniceconnectionstatechange;
pc.onicecandidate = onicecandidate;

export async function makeSession() {
  return RTCSignaler.make();
}

export async function start(key, stream, onupdate, forceParticipant){
  let started = false;
  if (await RTCSignaler.join(key, onSignalerReceive, forceParticipant)) {
    if (onupdate instanceof Function) onUpdateHandler = onupdate;
    startMessageChannel();
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }
    started = true;
  } else {
    console.log("signal server not connected");
  }
  return started;
}

export function getUserType(){
  return RTCSignaler.getUserType();
}

function updateHandler(update){
  remoteContentStatus.data = receiveChannel ? receiveChannel.readyState == "open" : false
  onUpdateHandler(update);
}

// WebRTC negotiation event handlers
async function onSignalerReceive({ data: { description, candidate } }) {
  try {
    if (description) {
      console.log("description <-- " + description.type);
      console.log(pc.signalingState);
      const offerCollision =
      description.type === "offer" &&
      (makingOffer || pc.signalingState !== "stable");

      ignoreOffer = !RTCSignaler.isPolite() && offerCollision;
      if (ignoreOffer) {
        console.log("ignored");
        return;
      }
      try {
        // if (signaler.polite && pc.signalingState == "has-local-")
        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          console.log("sending");
          await pc.setLocalDescription();
          console.log("description --> " + pc.localDescription.type);

          RTCSignaler.send({ description: pc.localDescription });
        }
      } catch (e) {

        console.log(e, e.code);
        throw `description failure`
      }

    } else if (candidate) {
      try {
        await pc.addIceCandidate(candidate);
        console.log("candidate <--");
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
  console.log("candidate -->");
  RTCSignaler.send(data);
}

function oniceconnectionstatechange(){
  let update = {
    negotiation_state: pc.iceConnectionState
  }
  updateHandler(update);
  console.log(pc.iceConnectionState);
  if (pc.iceConnectionState === "failed") {
    pc.restartIce();
  } else if (pc.iceConnectionState == "connected"){
  } else if (pc.iceConnectionState === "disconnected") {
    sendChannel = null;
  }
}

async function onnegotiationneeded(){
  console.log("negotiation needed " );
  try {
    makingOffer = true;
    await pc.setLocalDescription();
    console.log("description --> " + pc.localDescription.type);
    RTCSignaler.send({ description: pc.localDescription });
  } catch (err) {
    console.error(err);
  } finally {
    makingOffer = false;
  }
}

function ontrackadded({ track, streams }){
  console.log("track received " + track.kind);
  track.onunmute = () => {
    console.log("track unmuted " + track.kind);
    let update = {
      remote_stream: streams[0],
    };
    remoteContentStatus[track.kind] = track;
    updateHandler(update);
  };
  track.onmute = () => {
    let update = {
      remove_stream: true,
    }
    // console.log("MUTED " + track.kind);
    remoteContentStatus[track.kind] = null;
    updateHandler(update);
  }
}


// WebRTC data channel functions
function receiveChannelCallback(event) {
  if (sendChannel == null) {
    startMessageChannel();
  }
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleReceiveMessage;
  receiveChannel.onopen = handleReceiveChannelStatusChange;
  receiveChannel.onclose = handleReceiveChannelStatusChange;
}

function handleReceiveMessage(event) {
  let update = {
    data: event.data,
  }
  updateHandler(update);
  // console.log(event.data);
}

export function sendMessage(message) {
  if (sendChannel && sendChannel.readyState == "open") {
    sendChannel.send(message);
  }
}

function handleReceiveChannelStatusChange(event) {
  if (receiveChannel) {
    let update = {
      receive_data_channel_state: receiveChannel.readyState,
    }
    remoteContentStatus.data = receiveChannel.readyState == "open"
    updateHandler(update);
  }
}

function handleSendChannelStatusChange(event) {
  if (sendChannel) {
    const state = sendChannel.readyState;
    let update = {
      send_data_channel_state: state,
    }
    if (state == "closed") {
      sendChannel = null;
    }
    updateHandler(update)
  }
}

function startMessageChannel(){
  sendChannel = pc.createDataChannel("sendChannel");
  sendChannel.onopen = handleSendChannelStatusChange;
  sendChannel.onclose = handleSendChannelStatusChange;
}
