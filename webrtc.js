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
  data_send: null,
  data_receive: null,
  ice_state: null,
}
let localStream = null;
let remoteStream = null;

let sendChannel;
let receiveChannel;

let onUpdateHandler = () => {};

let pc = new RTCPeerConnection(config);
pc.ondatachannel = receiveChannelCallback;
pc.ontrack = ontrackadded
pc.onnegotiationneeded = onnegotiationneeded;
pc.oniceconnectionstatechange = oniceconnectionstatechange;
pc.onicecandidate = onicecandidate;


export function muteTrack(track = "auido", bool = null) {
  let res = null;
  if (localStream) {
    let tracks = localStream[`get${track[0].toUpperCase() + track.slice(1)}Tracks`]();
    let t = tracks[0];
    if (bool == null) bool = t.enabled;
    t.enabled = !bool;
    let msg = {};
    msg[track + "_muted"] = bool;
    sendMessage(msg);
    res = bool;
  }
  return res;
}

export async function makeSession() {
  return RTCSignaler.make();
}

export async function start(key, stream, onupdate, forceParticipant){
  console.log("starting session");
  await RTCSignaler.join(key, onSignalerReceive, forceParticipant)
  remoteStream = null;
  localStream = stream;
  if (onupdate instanceof Function) onUpdateHandler = onupdate;
  startMessageChannel();
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }
}

export function getUserType(){
  return RTCSignaler.getUserType();
}

let sessionState = "closed";
let remoteCache = null;
function updateHandler(update, type){
  console.log(remoteContentStatus);
  if (type == "state") {

    let {video, audio, data_send, data_receive, ice_state} = remoteContentStatus;

    // Session is open and has now started
    if (sessionState == "closed" && video && audio && data_send == "open" && data_receive == "open" && ice_state == "connected") {

      // Send message to remote caller telling them we are open
      sessionState = "open";
      sendMessage({
        remote_status: "open",
        audio_muted: !localStream.getAudioTracks()[0].enabled,
        video_muted: !localStream.getVideoTracks()[0].enabled,
      });

      // i.e. An opening message from the caller has been already received
      if (remoteCache != null)  {
        remoteCache.status = "open";
        remoteCache.remote_stream = remoteStream;
        console.log("open 1");
        onUpdateHandler(remoteCache);
        remoteCache = null;
      }

    // Session has closed
    } else {
      if (sessionState == "open") {
        sessionState = "closed";
        // remoteStream = null;
        onUpdateHandler({status: "closed"});
      }
    }

  // Data has been received from the remote caller
  } else if (type == "data") {
    // If the session is open
    if (sessionState == "open") {
      // A message to say that the remote caller is started session
      if (update.remote_status == "open") {
        update.status = "open"; // local session status
        update.remote_stream = remoteStream;
        console.log("open 2");
      }
      onUpdateHandler(update);

    // Session is not open on our end but a message from the remote caller was
    // received to say they are open, in this case we will store the message
    // until we open.
    } else if (update.remote_status == "open") {
      remoteCache = update;
    }
  }
  // console.log(remoteContentStatus, sessionState);
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
        // console.log("ignored");
        return;
      }
      try {
        // if (signaler.polite && pc.signalingState == "has-local-")
        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          // console.log("sending");
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
  if (pc.iceConnectionState === "failed") {
    pc.restartIce();
  } else if (pc.iceConnectionState == "connected"){
  } else if (pc.iceConnectionState === "disconnected") {
    sendChannel = null;
  }
  remoteContentStatus.ice_state = pc.iceConnectionState;
  updateHandler(update, "state");
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
  console.log(streams);
  remoteStream = streams[0];
  track.onunmute = () => {
    console.log("track unmuted " + track.kind);
    console.log(streams);
    // if (remoteStream == null) {
    //   // console.log(remoteStream);
    // }
    let update = {
      remote_stream: streams[0],
    };
    remoteContentStatus[track.kind] = track;
    updateHandler(update, "state");
  };
  track.onmute = () => {
    console.log("track muted " + track.kind);
    let update = {
      remove_stream: true,
    }
    remoteContentStatus[track.kind] = null;
    updateHandler(update, "state");
  }
}


// WebRTC data channel functions
export function sendMessage(message) {
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

function handleReceiveMessage(event) {
  updateHandler(JSON.parse(event.data), "data");
}

function handleReceiveChannelStatusChange(event) {
  if (receiveChannel) {
    let update = {
      receive_data_channel_state: receiveChannel.readyState,
    }
    remoteContentStatus.data_receive = receiveChannel.readyState
    updateHandler(update, "state");
  }
}

function handleSendChannelStatusChange(event) {
  if (sendChannel) {
    const state = sendChannel.readyState;
    let update = {
      send_data_channel_state: state,
    }
    remoteContentStatus.data_send = state
    if (state == "closed") {
      sendChannel = null;
    }
    updateHandler(update, "state")
  }
}

function startMessageChannel(){
  sendChannel = pc.createDataChannel("sendChannel");
  sendChannel.onopen = handleSendChannelStatusChange;
  sendChannel.onclose = handleSendChannelStatusChange;
}
